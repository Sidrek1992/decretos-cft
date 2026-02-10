import React, { useState, useEffect } from 'react';
import {
    X,
    Settings,
    Users,
    Shield,
    UserPlus,
    Trash2,
    Crown,
    Eye,
    EyeOff,
    Loader2,
    AlertCircle,
    CheckCircle,
    Mail,
    Save,
    KeyRound
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { UserRole, ROLE_LABELS, ROLE_COLORS } from '../types/roles';

interface AdminPanelProps {
    isOpen: boolean;
    onClose: () => void;
}

interface ManagedUser {
    email: string;
    role: UserRole;
    firstName: string;
    lastName: string;
    password: string;
    createdAt?: string;
}

const ROLES_STORAGE_KEY = 'gdp_user_roles';
const USER_PROFILES_STORAGE_KEY = 'gdp_user_profiles';
const USER_PASSWORDS_STORAGE_KEY = 'gdp_user_passwords';

const loadUserRoles = (): Record<string, UserRole> => {
    try {
        const stored = localStorage.getItem(ROLES_STORAGE_KEY);
        if (stored) {
            return JSON.parse(stored);
        }
    } catch (e) {
        console.error('Error loading roles:', e);
    }
    // Por defecto, el admin principal
    return {
        'mguzmanahumada@gmail.com': 'admin'
    };
};

const saveUserRoles = (roles: Record<string, UserRole>) => {
    try {
        localStorage.setItem(ROLES_STORAGE_KEY, JSON.stringify(roles));
    } catch (e) {
        console.error('Error saving roles:', e);
    }
};

type UserProfileMap = Record<string, { firstName: string; lastName: string }>;

const loadUserProfiles = (): UserProfileMap => {
    try {
        const stored = localStorage.getItem(USER_PROFILES_STORAGE_KEY);
        if (!stored) return {};
        const parsed = JSON.parse(stored) as UserProfileMap;
        return Object.entries(parsed).reduce<UserProfileMap>((acc, [email, data]) => {
            acc[email.toLowerCase()] = {
                firstName: String(data?.firstName || '').trim(),
                lastName: String(data?.lastName || '').trim()
            };
            return acc;
        }, {});
    } catch (e) {
        console.error('Error loading user profiles:', e);
        return {};
    }
};

const saveUserProfiles = (profiles: UserProfileMap) => {
    try {
        localStorage.setItem(USER_PROFILES_STORAGE_KEY, JSON.stringify(profiles));
    } catch (e) {
        console.error('Error saving user profiles:', e);
    }
};

type UserPasswordMap = Record<string, string>;

const loadUserPasswords = (): UserPasswordMap => {
    try {
        const stored = localStorage.getItem(USER_PASSWORDS_STORAGE_KEY);
        if (!stored) return {};
        const parsed = JSON.parse(stored) as UserPasswordMap;
        return Object.entries(parsed).reduce<UserPasswordMap>((acc, [email, password]) => {
            acc[email.toLowerCase()] = String(password || '');
            return acc;
        }, {});
    } catch (e) {
        console.error('Error loading user passwords:', e);
        return {};
    }
};

const saveUserPasswords = (passwords: UserPasswordMap) => {
    try {
        localStorage.setItem(USER_PASSWORDS_STORAGE_KEY, JSON.stringify(passwords));
    } catch (e) {
        console.error('Error saving user passwords:', e);
    }
};

export const getUserRole = (email: string): UserRole => {
    const roles = loadUserRoles();
    return roles[email.toLowerCase()] || 'reader';
};

export const isAdminEmail = (email: string): boolean => {
    return getUserRole(email) === 'admin';
};

const AdminPanel: React.FC<AdminPanelProps> = ({ isOpen, onClose }) => {
    const [users, setUsers] = useState<ManagedUser[]>([]);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    const [createFirstName, setCreateFirstName] = useState('');
    const [createLastName, setCreateLastName] = useState('');
    const [createEmail, setCreateEmail] = useState('');
    const [createPassword, setCreatePassword] = useState('');
    const [createRole, setCreateRole] = useState<UserRole>('reader');
    const [showCreatePassword, setShowCreatePassword] = useState(false);
    const [isCreating, setIsCreating] = useState(false);

    const [assignFirstName, setAssignFirstName] = useState('');
    const [assignLastName, setAssignLastName] = useState('');
    const [assignEmail, setAssignEmail] = useState('');
    const [assignRole, setAssignRole] = useState<UserRole>('reader');

    const [isResettingByEmail, setIsResettingByEmail] = useState<Record<string, boolean>>({});
    const [profileDrafts, setProfileDrafts] = useState<Record<string, { firstName: string; lastName: string }>>({});
    const [passwordDrafts, setPasswordDrafts] = useState<Record<string, string>>({});
    const [showPasswordByEmail, setShowPasswordByEmail] = useState<Record<string, boolean>>({});

    useEffect(() => {
        if (isOpen) {
            loadUsers();
        }
    }, [isOpen]);

    const loadUsers = () => {
        const roles = loadUserRoles();
        const profiles = loadUserProfiles();
        const passwords = loadUserPasswords();
        const emails = new Set<string>([
            ...Object.keys(roles),
            ...Object.keys(profiles),
            ...Object.keys(passwords)
        ]);

        const userList: ManagedUser[] = Array.from(emails)
            .map((rawEmail) => {
                const email = rawEmail.toLowerCase();
                const profile = profiles[email] || { firstName: '', lastName: '' };
                return {
                    email,
                    role: roles[email] || 'reader',
                    firstName: profile.firstName,
                    lastName: profile.lastName,
                    password: passwords[email] || ''
                };
            })
            .sort((a, b) => a.email.localeCompare(b.email));

        setUsers(userList);

        const drafts: Record<string, { firstName: string; lastName: string }> = {};
        userList.forEach((user) => {
            drafts[user.email] = {
                firstName: user.firstName,
                lastName: user.lastName
            };
        });
        setProfileDrafts(drafts);

        const passwordMap: Record<string, string> = {};
        userList.forEach((user) => {
            passwordMap[user.email] = user.password;
        });
        setPasswordDrafts(passwordMap);
    };

    const handleCreateUser = async () => {
        if (!createFirstName.trim() || !createLastName.trim() || !createEmail.trim() || !createPassword.trim()) {
            setError('Nombre, apellido, email y contraseña son requeridos');
            return;
        }

        if (createPassword.length < 6) {
            setError('La contraseña debe tener al menos 6 caracteres');
            return;
        }

        setIsCreating(true);
        setError(null);
        setSuccess(null);

        try {
            const email = createEmail.trim().toLowerCase();
            const firstName = createFirstName.trim();
            const lastName = createLastName.trim();

            const { data, error: signUpError } = await supabase.auth.signUp({
                email,
                password: createPassword,
                options: {
                    emailRedirectTo: window.location.origin,
                    data: {
                        role: createRole,
                        first_name: firstName,
                        last_name: lastName,
                        full_name: `${firstName} ${lastName}`.trim()
                    }
                }
            });

            if (signUpError) {
                throw signUpError;
            }

            const roles = loadUserRoles();
            roles[email] = createRole;
            saveUserRoles(roles);

            const profiles = loadUserProfiles();
            profiles[email] = { firstName, lastName };
            saveUserProfiles(profiles);

            const passwords = loadUserPasswords();
            passwords[email] = createPassword;
            saveUserPasswords(passwords);

            loadUsers();

            setSuccess(`Usuario ${email} creado exitosamente como ${ROLE_LABELS[createRole]}`);
            setCreateFirstName('');
            setCreateLastName('');
            setCreateEmail('');
            setCreatePassword('');
            setCreateRole('reader');
            setShowCreatePassword(false);
        } catch (err: any) {
            if (err.message?.includes('already registered')) {
                setError('Este email ya está registrado');
            } else {
                setError(err.message || 'Error al crear usuario');
            }
        } finally {
            setIsCreating(false);
        }
    };

    const handleChangeRole = (email: string, newRole: UserRole) => {
        const roles = loadUserRoles();
        roles[email.toLowerCase()] = newRole;
        saveUserRoles(roles);
        loadUsers();
        setSuccess(`Rol de ${email} cambiado a ${ROLE_LABELS[newRole]}`);
    };

    const handleRemoveUser = (email: string) => {
        if (email.toLowerCase() === 'mguzmanahumada@gmail.com') {
            setError('No puedes eliminar al administrador principal');
            return;
        }

        const roles = loadUserRoles();
        delete roles[email.toLowerCase()];
        saveUserRoles(roles);

        const profiles = loadUserProfiles();
        delete profiles[email.toLowerCase()];
        saveUserProfiles(profiles);

        const passwords = loadUserPasswords();
        delete passwords[email.toLowerCase()];
        saveUserPasswords(passwords);

        loadUsers();
        setSuccess(`Usuario ${email} eliminado de la gestión de roles`);
    };

    const handleAddExistingUser = () => {
        if (!assignEmail.trim()) {
            setError('Ingresa un email');
            return;
        }

        if (!assignFirstName.trim() || !assignLastName.trim()) {
            setError('Ingresa nombre y apellido del usuario');
            return;
        }

        const email = assignEmail.trim().toLowerCase();
        const firstName = assignFirstName.trim();
        const lastName = assignLastName.trim();

        const roles = loadUserRoles();
        if (roles[email]) {
            setError('Este usuario ya está en la lista');
            return;
        }

        roles[email] = assignRole;
        saveUserRoles(roles);

        const profiles = loadUserProfiles();
        profiles[email] = { firstName, lastName };
        saveUserProfiles(profiles);

        const passwords = loadUserPasswords();
        if (!passwords[email]) passwords[email] = '';
        saveUserPasswords(passwords);

        loadUsers();
        setSuccess(`Usuario ${email} añadido como ${ROLE_LABELS[assignRole]}`);
        setAssignFirstName('');
        setAssignLastName('');
        setAssignEmail('');
        setAssignRole('reader');
    };

    const handleProfileDraftChange = (email: string, field: 'firstName' | 'lastName', value: string) => {
        setProfileDrafts((prev) => ({
            ...prev,
            [email]: {
                ...(prev[email] || { firstName: '', lastName: '' }),
                [field]: value
            }
        }));
    };

    const handleSaveProfile = (email: string) => {
        const draft = profileDrafts[email] || { firstName: '', lastName: '' };
        const firstName = draft.firstName.trim();
        const lastName = draft.lastName.trim();

        if (!firstName || !lastName) {
            setError('Nombre y apellido no pueden quedar vacíos');
            return;
        }

        const profiles = loadUserProfiles();
        profiles[email.toLowerCase()] = { firstName, lastName };
        saveUserProfiles(profiles);
        loadUsers();
        setSuccess(`Datos actualizados para ${email}`);
    };

    const handleResetPassword = async (email: string) => {
        const normalized = email.toLowerCase();
        setError(null);
        setSuccess(null);
        setIsResettingByEmail((prev) => ({ ...prev, [normalized]: true }));

        try {
            const { error: resetError } = await supabase.auth.resetPasswordForEmail(normalized, {
                redirectTo: `${window.location.origin}/reset-password`
            });

            if (resetError) {
                throw resetError;
            }

            setSuccess(`Se envió un enlace de restablecimiento de contraseña a ${normalized}`);
        } catch (err: any) {
            setError(err.message || 'No se pudo iniciar el restablecimiento de contraseña');
        } finally {
            setIsResettingByEmail((prev) => ({ ...prev, [normalized]: false }));
        }
    };

    const handlePasswordDraftChange = (email: string, value: string) => {
        setPasswordDrafts((prev) => ({ ...prev, [email]: value }));
    };

    const handleSavePasswordReference = (email: string) => {
        const password = String(passwordDrafts[email] || '').trim();
        if (password.length < 6) {
            setError('La contraseña registrada debe tener al menos 6 caracteres');
            return;
        }

        const passwords = loadUserPasswords();
        passwords[email.toLowerCase()] = password;
        saveUserPasswords(passwords);
        loadUsers();
        setSuccess(`Contraseña registrada actualizada para ${email}`);
    };

    const togglePasswordVisibility = (email: string) => {
        setShowPasswordByEmail((prev) => ({ ...prev, [email]: !prev[email] }));
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-slate-900/80 backdrop-blur-sm"
                onClick={onClose}
            />

            {/* Modal */}
            <div className="relative w-full max-w-2xl max-h-[90vh] bg-white dark:bg-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col">
                {/* Header */}
                <div className="bg-gradient-to-r from-purple-600 to-indigo-600 px-6 py-5 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                            <Settings className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <h2 className="text-lg font-black text-white">Panel de Administración</h2>
                            <p className="text-xs text-white/70">Gestión de usuarios y roles</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-white/20 rounded-lg transition-colors"
                    >
                        <X className="w-5 h-5 text-white" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    {/* Alerts */}
                    {error && (
                        <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl flex items-start gap-3">
                            <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                            <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
                            <button onClick={() => setError(null)} className="ml-auto text-red-400 hover:text-red-600">
                                <X size={16} />
                            </button>
                        </div>
                    )}

                    {success && (
                        <div className="p-4 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-xl flex items-start gap-3">
                            <CheckCircle className="w-5 h-5 text-emerald-500 flex-shrink-0 mt-0.5" />
                            <p className="text-sm text-emerald-700 dark:text-emerald-400">{success}</p>
                            <button onClick={() => setSuccess(null)} className="ml-auto text-emerald-400 hover:text-emerald-600">
                                <X size={16} />
                            </button>
                        </div>
                    )}

                    {/* Crear nuevo usuario */}
                    <div className="bg-slate-50 dark:bg-slate-900/50 rounded-2xl p-5 border border-slate-200 dark:border-slate-700">
                        <div className="flex items-center gap-2 mb-4">
                            <UserPlus className="w-5 h-5 text-indigo-500" />
                            <h3 className="font-black text-slate-900 dark:text-white">Crear Nuevo Usuario</h3>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                                    Nombre
                                </label>
                                <input
                                    type="text"
                                    value={createFirstName}
                                    onChange={(e) => setCreateFirstName(e.target.value)}
                                    placeholder="Ej: Juan"
                                    className="w-full px-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                                    Apellido
                                </label>
                                <input
                                    type="text"
                                    value={createLastName}
                                    onChange={(e) => setCreateLastName(e.target.value)}
                                    placeholder="Ej: Perez"
                                    className="w-full px-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                                    Email
                                </label>
                                <div className="relative">
                                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                    <input
                                        type="email"
                                        value={createEmail}
                                        onChange={(e) => setCreateEmail(e.target.value)}
                                        placeholder="usuario@email.com"
                                        className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                                    Contraseña
                                </label>
                                <div className="relative">
                                    <input
                                        type={showCreatePassword ? 'text' : 'password'}
                                        value={createPassword}
                                        onChange={(e) => setCreatePassword(e.target.value)}
                                        placeholder="Mínimo 6 caracteres"
                                        className="w-full pl-4 pr-11 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowCreatePassword((prev) => !prev)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                                        title={showCreatePassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                                    >
                                        {showCreatePassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                    </button>
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                                    Rol
                                </label>
                                <select
                                    value={createRole}
                                    onChange={(e) => setCreateRole(e.target.value as UserRole)}
                                    className="w-full px-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                >
                                    <option value="reader">Lector</option>
                                    <option value="admin">Administrador</option>
                                </select>
                            </div>

                            <div className="flex items-end">
                                <button
                                    onClick={handleCreateUser}
                                    disabled={isCreating}
                                    className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-400 text-white font-bold rounded-xl transition-colors flex items-center justify-center gap-2"
                                >
                                    {isCreating ? (
                                        <>
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                            Creando...
                                        </>
                                    ) : (
                                        <>
                                            <UserPlus className="w-4 h-4" />
                                            Crear Usuario
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>

                        <p className="text-xs text-slate-400 mt-3">
                            Se creara el usuario con nombre, apellido y rol. Supabase enviara confirmacion por correo si esta habilitada.
                        </p>
                    </div>

                    {/* Lista de usuarios */}
                    <div>
                        <div className="flex items-center gap-2 mb-4">
                            <Users className="w-5 h-5 text-indigo-500" />
                            <h3 className="font-black text-slate-900 dark:text-white">Usuarios Registrados</h3>
                            <span className="px-2 py-0.5 bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-full text-xs font-bold">
                                {users.length}
                            </span>
                        </div>

                        <div className="space-y-2">
                            {users.map((user) => (
                                <div
                                    key={user.email}
                                    className="p-4 bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl space-y-3"
                                >
                                    <div className="flex items-center justify-between gap-3">
                                        <div className="flex items-center gap-3 min-w-0">
                                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${user.role === 'admin'
                                                ? 'bg-purple-100 dark:bg-purple-900/40'
                                                : 'bg-slate-100 dark:bg-slate-800'
                                                }`}>
                                                {user.role === 'admin' ? (
                                                    <Crown className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                                                ) : (
                                                    <Eye className="w-5 h-5 text-slate-500 dark:text-slate-400" />
                                                )}
                                            </div>
                                            <div className="min-w-0">
                                                <p className="font-bold text-sm text-slate-900 dark:text-white truncate">
                                                    {(user.firstName || user.lastName)
                                                        ? `${user.firstName} ${user.lastName}`.trim()
                                                        : 'Sin nombre configurado'}
                                                </p>
                                                <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                                                    {user.email}
                                                </p>
                                                <span className={`inline-flex mt-1 px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider ${ROLE_COLORS[user.role].bg} ${ROLE_COLORS[user.role].text}`}>
                                                    {ROLE_LABELS[user.role]}
                                                </span>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-2">
                                            <select
                                                value={user.role}
                                                onChange={(e) => handleChangeRole(user.email, e.target.value as UserRole)}
                                                disabled={user.email.toLowerCase() === 'mguzmanahumada@gmail.com'}
                                                className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-bold disabled:opacity-50 disabled:cursor-not-allowed"
                                            >
                                                <option value="reader">Lector</option>
                                                <option value="admin">Admin</option>
                                            </select>

                                            {user.email.toLowerCase() !== 'mguzmanahumada@gmail.com' && (
                                                <button
                                                    onClick={() => handleRemoveUser(user.email)}
                                                    className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                                                    title="Eliminar de la gestión"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            )}
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-2">
                                        <input
                                            type="text"
                                            value={profileDrafts[user.email]?.firstName ?? ''}
                                            onChange={(e) => handleProfileDraftChange(user.email, 'firstName', e.target.value)}
                                            placeholder="Nombre"
                                            className="px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm"
                                        />
                                        <input
                                            type="text"
                                            value={profileDrafts[user.email]?.lastName ?? ''}
                                            onChange={(e) => handleProfileDraftChange(user.email, 'lastName', e.target.value)}
                                            placeholder="Apellido"
                                            className="px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm"
                                        />
                                        <button
                                            onClick={() => handleSaveProfile(user.email)}
                                            className="px-3 py-2 bg-slate-800 hover:bg-slate-900 dark:bg-slate-700 dark:hover:bg-slate-600 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1.5"
                                        >
                                            <Save size={13} />
                                            Guardar
                                        </button>
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_auto] gap-2">
                                        <div className="relative">
                                            <input
                                                type={showPasswordByEmail[user.email] ? 'text' : 'password'}
                                                value={passwordDrafts[user.email] ?? ''}
                                                onChange={(e) => handlePasswordDraftChange(user.email, e.target.value)}
                                                placeholder="Contraseña registrada"
                                                className="w-full px-3 py-2 pr-10 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => togglePasswordVisibility(user.email)}
                                                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                                                title={showPasswordByEmail[user.email] ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                                            >
                                                {showPasswordByEmail[user.email] ? <EyeOff size={16} /> : <Eye size={16} />}
                                            </button>
                                        </div>
                                        <button
                                            onClick={() => handleSavePasswordReference(user.email)}
                                            className="px-3 py-2 bg-slate-800 hover:bg-slate-900 dark:bg-slate-700 dark:hover:bg-slate-600 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1.5"
                                        >
                                            <Save size={13} />
                                            Guardar
                                        </button>
                                        <button
                                            onClick={() => handleResetPassword(user.email)}
                                            disabled={Boolean(isResettingByEmail[user.email])}
                                            className="px-3 py-2 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-900/30 dark:hover:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 rounded-lg text-xs font-bold flex items-center gap-2 disabled:opacity-60"
                                        >
                                            {isResettingByEmail[user.email] ? (
                                                <>
                                                    <Loader2 className="w-4 h-4 animate-spin" />
                                                    Enviando...
                                                </>
                                            ) : (
                                                <>
                                                    <KeyRound className="w-4 h-4" />
                                                    Restablecer
                                                </>
                                            )}
                                        </button>
                                    </div>

                                    <div className="flex justify-end">
                                        <p className="text-[11px] text-slate-400 dark:text-slate-500">
                                            El campo de contraseña se guarda en este panel para visualización administrativa.
                                        </p>
                                    </div>
                                </div>
                            ))}

                            {users.length === 0 && (
                                <div className="text-center py-8 text-slate-400">
                                    <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
                                    <p className="text-sm">No hay usuarios registrados</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Añadir usuario existente */}
                    <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-2xl p-5">
                        <div className="flex items-center gap-2 mb-3">
                            <Shield className="w-5 h-5 text-amber-600" />
                            <h3 className="font-black text-amber-800 dark:text-amber-300">Asignar Rol a Usuario Existente</h3>
                        </div>
                        <p className="text-xs text-amber-700 dark:text-amber-400 mb-4">
                            Si el usuario ya tiene cuenta en Supabase, puedes registrarlo en este panel con su nombre, apellido y rol.
                        </p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            <input
                                type="text"
                                value={assignFirstName}
                                onChange={(e) => setAssignFirstName(e.target.value)}
                                placeholder="Nombre"
                                className="px-4 py-2 bg-white dark:bg-slate-800 border border-amber-300 dark:border-amber-700 rounded-lg text-sm"
                            />
                            <input
                                type="text"
                                value={assignLastName}
                                onChange={(e) => setAssignLastName(e.target.value)}
                                placeholder="Apellido"
                                className="px-4 py-2 bg-white dark:bg-slate-800 border border-amber-300 dark:border-amber-700 rounded-lg text-sm"
                            />
                            <input
                                type="email"
                                value={assignEmail}
                                onChange={(e) => setAssignEmail(e.target.value)}
                                placeholder="email@existente.com"
                                className="sm:col-span-2 px-4 py-2 bg-white dark:bg-slate-800 border border-amber-300 dark:border-amber-700 rounded-lg text-sm"
                            />
                        </div>
                        <div className="flex gap-2 mt-2">
                            <select
                                value={assignRole}
                                onChange={(e) => setAssignRole(e.target.value as UserRole)}
                                className="px-3 py-2 bg-white dark:bg-slate-800 border border-amber-300 dark:border-amber-700 rounded-lg text-sm"
                            >
                                <option value="reader">Lector</option>
                                <option value="admin">Admin</option>
                            </select>
                            <button
                                onClick={handleAddExistingUser}
                                className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-lg text-sm"
                            >
                                Anadir
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AdminPanel;
