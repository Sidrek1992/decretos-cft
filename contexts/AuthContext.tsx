import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { User, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut as firebaseSignOut, sendPasswordResetEmail } from 'firebase/auth';
import { collection, query, where, getDocs, limit } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { UserRole, Permissions, getPermissions, hasPermission, ROLE_LABELS, ROLE_COLORS } from '../types/roles';
import { appendAuditLog } from '../utils/audit';
import { getUserSecurityByEmail, isMandatoryAdminEmail, loadUserRoles, touchUserLastAccess, updateUserSecurity } from '../utils/userAdminStorage';
import { subscribeToProfileChanges } from '../services/realtimeSync';
import { logger } from '../utils/logger';

const log = logger.create('Auth');

interface UserProfile {
    id: string;
    email: string;
    role: UserRole;
    firstName: string;
    lastName: string;
    created_at: string;
}

interface AuthContextType {
    user: User | null;
    session: any | null; // deprecated in firebase architecture for this app, kept for compabibility
    profile: UserProfile | null;
    role: UserRole;
    permissions: Permissions;
    loading: boolean;
    signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
    signUp: (email: string, password: string) => Promise<{ error: Error | null }>;
    signOut: () => Promise<void>;
    resetPassword: (email: string) => Promise<{ error: Error | null }>;
    hasPermission: (permission: keyof Permissions) => boolean;
    roleLabel: string;
    roleColors: { bg: string; text: string };
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth debe usarse dentro de un AuthProvider');
    }
    return context;
};

interface AuthProviderProps {
    children: React.ReactNode;
}

const getEnforcedRoleByEmail = (email: string | null | undefined): UserRole | null => {
    if (!email) return null;
    return isMandatoryAdminEmail(email) ? 'admin' : null;
};

const getRoleFromEmail = (email: string | null | undefined): UserRole => {
    if (!email) return 'reader';
    const roles = loadUserRoles();
    return roles[email.toLowerCase()] || 'reader';
};

const resolveRoleFromMetadata = (metadata: Record<string, unknown> | null | undefined): UserRole | null => {
    if (!metadata) return null;
    const rawRole = String(metadata.role || '').toLowerCase();
    if (rawRole === 'admin' || rawRole === 'editor' || rawRole === 'reader') return rawRole as UserRole;
    return null;
};

const clearWelcomeBannerDismissals = (): void => {
    try {
        const keysToRemove = Object.keys(localStorage).filter(key => key.startsWith('gdp-banner-dismissed-'));
        keysToRemove.forEach(key => localStorage.removeItem(key));
    } catch {
        // ignore storage errors in non-browser or restricted contexts
    }
};

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [loading, setLoading] = useState(true);

    // Calcular rol basado en el perfil o email
    const role: UserRole =
        getEnforcedRoleByEmail(user?.email) ||
        profile?.role ||
        getRoleFromEmail(user?.email);
    const permissions = getPermissions(role);
    const roleLabel = ROLE_LABELS[role];
    const roleColors = ROLE_COLORS[role];

    const checkPermission = (permission: keyof Permissions): boolean => {
        return hasPermission(role, permission);
    };

    // Cargar perfil desde Firestore para persistir rol entre dispositivos
    const loadProfile = useCallback(async (userId: string, email?: string | null): Promise<void> => {
        const normalizedEmail = email?.trim().toLowerCase();
        if (!normalizedEmail) {
            setProfile(null);
            return;
        }

        try {
            // Consulta Firestore para obtener el perfil
            const q = query(
                collection(db, 'profiles'),
                where('email', '==', normalizedEmail),
                limit(1)
            );
            
            const querySnapshot = await getDocs(q);

            if (!querySnapshot.empty) {
                const docSnap = querySnapshot.docs[0];
                const data = docSnap.data();
                
                const dbRole = String(data.role || '').toLowerCase();
                const normalizedRole: UserRole = dbRole === 'admin' || dbRole === 'editor' || dbRole === 'reader'
                    ? (dbRole as UserRole)
                    : 'reader';

                setProfile({
                    id: userId,
                    email: data.email,
                    role: normalizedRole,
                    firstName: String(data.first_name || '').trim(),
                    lastName: String(data.last_name || '').trim(),
                    created_at: String(data.created_at || new Date().toISOString())
                });
                log.debug('Perfil cargado exitosamente desde DB (Firestore)');
                return;
            }
            log.warn('No se encontró perfil en Firestore');
        } catch (err) {
            log.warn('No se pudo cargar perfil remoto (usando fallback local):', err);
        }

        setProfile(null);
    }, []);

    useEffect(() => {
        log.debug('Iniciando verificación de sesión con Firebase...');
        
        const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
            log.debug('Cambio de estado detectado:', currentUser ? 'Logueado' : 'Desconectado');
            try {
                if (currentUser?.email && getUserSecurityByEmail(currentUser.email).blocked) {
                    log.warn('Usuario bloqueado:', currentUser.email);
                    await firebaseSignOut(auth);
                    setUser(null);
                    setProfile(null);
                    setLoading(false);
                    return;
                }

                setUser(currentUser);

                if (currentUser) {
                    log.debug('Sesión encontrada para', currentUser.email, '- Cargando perfil...');
                    await loadProfile(currentUser.uid, currentUser.email);
                } else {
                    setProfile(null);
                    clearWelcomeBannerDismissals();
                }
            } catch (err) {
                log.error('Error crítico en AuthStateChange:', err);
            } finally {
                setLoading(false);
                log.debug('Verificación de sesión finalizada.');
            }
        });

        return () => {
            unsubscribe();
        };
    }, [loadProfile]);

    useEffect(() => {
        if (!user?.uid || !user?.email) return;

        const unsubscribe = subscribeToProfileChanges({
            channelKey: 'auth-context',
            email: user.email,
            onChange: () => {
                void loadProfile(user.uid, user.email);
            }
        });

        return () => {
            unsubscribe();
        };
    }, [user?.uid, user?.email, loadProfile]);

    const signIn = async (email: string, password: string) => {
        const normalizedEmail = email.trim().toLowerCase();
        const securityBeforeSignIn = getUserSecurityByEmail(normalizedEmail);
        if (securityBeforeSignIn.blocked) {
            return {
                error: new Error('Tu cuenta está bloqueada. Contacta al administrador.')
            };
        }

        try {
            const userCredential = await signInWithEmailAndPassword(auth, email, password);
            touchUserLastAccess(normalizedEmail);
            appendAuditLog({
                scope: 'auth',
                action: 'login_success',
                actor: normalizedEmail,
                target: normalizedEmail,
                details: 'Inicio de sesión exitoso via Firebase'
            });

            const security = getUserSecurityByEmail(normalizedEmail);
            if (security.forcePasswordChange) {
                await firebaseSignOut(auth);
                await sendPasswordResetEmail(auth, normalizedEmail);

                appendAuditLog({
                    scope: 'auth',
                    action: 'force_password_change_triggered',
                    actor: normalizedEmail,
                    target: normalizedEmail,
                    details: 'Se forzó cambio de contraseña con email de recuperación'
                });

                return {
                    error: new Error('Debes cambiar tu contraseña antes de ingresar. Revisa tu correo para continuar.')
                };
            }
            return { error: null };
        } catch (error: any) {
            return { error: new Error(error.message || 'Error de autenticación') };
        }
    };

    const signUp = async (email: string, password: string) => {
        try {
            await createUserWithEmailAndPassword(auth, email, password);
            return { error: null };
        } catch (error: any) {
            return { error: new Error(error.message || 'Error al registrar') };
        }
    };

    const signOut = async () => {
        if (user?.email) {
            appendAuditLog({
                scope: 'auth',
                action: 'logout',
                actor: user.email,
                target: user.email,
                details: 'Cierre de sesión via Firebase'
            });
        }
        setProfile(null);
        clearWelcomeBannerDismissals();
        await firebaseSignOut(auth);
    };

    const resetPassword = async (email: string) => {
        try {
            await sendPasswordResetEmail(auth, email);
            updateUserSecurity(email, { forcePasswordChange: false });
            return { error: null };
        } catch (error: any) {
            return { error: new Error(error.message || 'Error enviando reseteo de clave.') };
        }
    };

    const value: AuthContextType = {
        user,
        session: null, // Legacy compatibility
        profile,
        role,
        permissions,
        loading,
        signIn,
        signUp,
        signOut,
        resetPassword,
        hasPermission: checkPermission,
        roleLabel,
        roleColors,
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
};

