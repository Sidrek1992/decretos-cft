import React, { useState, useEffect } from 'react';
import { X, Settings, Users, Shield, UserPlus, Trash2, Crown, Eye, Loader2, AlertCircle, CheckCircle, Mail } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { UserRole, ROLE_LABELS, ROLE_COLORS } from '../types/roles';

interface AdminPanelProps {
    isOpen: boolean;
    onClose: () => void;
}

interface ManagedUser {
    email: string;
    role: UserRole;
    createdAt?: string;
}

// ★ Clave de localStorage para guardar roles
const ROLES_STORAGE_KEY = 'gdp_user_roles';

// ★ Cargar roles desde localStorage
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

// ★ Guardar roles en localStorage
const saveUserRoles = (roles: Record<string, UserRole>) => {
    try {
        localStorage.setItem(ROLES_STORAGE_KEY, JSON.stringify(roles));
    } catch (e) {
        console.error('Error saving roles:', e);
    }
};

// ★ Exportar función para obtener rol de un email
export const getUserRole = (email: string): UserRole => {
    const roles = loadUserRoles();
    return roles[email.toLowerCase()] || 'reader';
};

// ★ Exportar función para verificar si es admin
export const isAdminEmail = (email: string): boolean => {
    return getUserRole(email) === 'admin';
};

const AdminPanel: React.FC<AdminPanelProps> = ({ isOpen, onClose }) => {
    const [users, setUsers] = useState<ManagedUser[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    // Formulario para nuevo usuario
    const [newEmail, setNewEmail] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [newRole, setNewRole] = useState<UserRole>('reader');
    const [isCreating, setIsCreating] = useState(false);

    // Cargar usuarios al abrir
    useEffect(() => {
        if (isOpen) {
            loadUsers();
        }
    }, [isOpen]);

    const loadUsers = () => {
        const roles = loadUserRoles();
        const userList: ManagedUser[] = Object.entries(roles).map(([email, role]) => ({
            email,
            role
        }));
        setUsers(userList);
    };

    const handleCreateUser = async () => {
        if (!newEmail.trim() || !newPassword.trim()) {
            setError('Email y contraseña son requeridos');
            return;
        }

        if (newPassword.length < 6) {
            setError('La contraseña debe tener al menos 6 caracteres');
            return;
        }

        setIsCreating(true);
        setError(null);
        setSuccess(null);

        try {
            // Crear usuario en Supabase Auth
            const { data, error: signUpError } = await supabase.auth.signUp({
                email: newEmail.trim(),
                password: newPassword,
                options: {
                    emailRedirectTo: window.location.origin,
                    data: { role: newRole }
                }
            });

            if (signUpError) {
                throw signUpError;
            }

            // Guardar rol del nuevo usuario
            const roles = loadUserRoles();
            roles[newEmail.trim().toLowerCase()] = newRole;
            saveUserRoles(roles);

            // Actualizar lista
            loadUsers();

            setSuccess(`Usuario ${newEmail} creado exitosamente como ${ROLE_LABELS[newRole]}`);
            setNewEmail('');
            setNewPassword('');
            setNewRole('reader');
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
        // No permitir eliminar el admin principal
        if (email.toLowerCase() === 'mguzmanahumada@gmail.com') {
            setError('No puedes eliminar al administrador principal');
            return;
        }

        const roles = loadUserRoles();
        delete roles[email.toLowerCase()];
        saveUserRoles(roles);
        loadUsers();
        setSuccess(`Usuario ${email} eliminado de la gestión de roles`);
    };

    const handleAddExistingUser = () => {
        if (!newEmail.trim()) {
            setError('Ingresa un email');
            return;
        }

        const roles = loadUserRoles();
        if (roles[newEmail.trim().toLowerCase()]) {
            setError('Este usuario ya está en la lista');
            return;
        }

        roles[newEmail.trim().toLowerCase()] = newRole;
        saveUserRoles(roles);
        loadUsers();
        setSuccess(`Usuario ${newEmail} añadido como ${ROLE_LABELS[newRole]}`);
        setNewEmail('');
        setNewRole('reader');
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
                                    Email
                                </label>
                                <div className="relative">
                                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                    <input
                                        type="email"
                                        value={newEmail}
                                        onChange={(e) => setNewEmail(e.target.value)}
                                        placeholder="usuario@email.com"
                                        className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                                    Contraseña
                                </label>
                                <input
                                    type="password"
                                    value={newPassword}
                                    onChange={(e) => setNewPassword(e.target.value)}
                                    placeholder="Mínimo 6 caracteres"
                                    className="w-full px-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                                    Rol
                                </label>
                                <select
                                    value={newRole}
                                    onChange={(e) => setNewRole(e.target.value as UserRole)}
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
                            El usuario recibirá un email de confirmación para activar su cuenta.
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
                                    className="flex items-center justify-between p-4 bg-white dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl"
                                >
                                    <div className="flex items-center gap-3">
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
                                        <div>
                                            <p className="font-bold text-sm text-slate-900 dark:text-white">
                                                {user.email}
                                            </p>
                                            <span className={`inline-flex px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider ${ROLE_COLORS[user.role].bg} ${ROLE_COLORS[user.role].text}`}>
                                                {ROLE_LABELS[user.role]}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-2">
                                        {/* Cambiar rol */}
                                        <select
                                            value={user.role}
                                            onChange={(e) => handleChangeRole(user.email, e.target.value as UserRole)}
                                            disabled={user.email.toLowerCase() === 'mguzmanahumada@gmail.com'}
                                            className="px-3 py-1.5 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-bold disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            <option value="reader">Lector</option>
                                            <option value="admin">Admin</option>
                                        </select>

                                        {/* Eliminar */}
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
                            Si el usuario ya tiene cuenta en Supabase, añádelo aquí para asignarle un rol.
                        </p>
                        <div className="flex gap-2">
                            <input
                                type="email"
                                value={newEmail}
                                onChange={(e) => setNewEmail(e.target.value)}
                                placeholder="email@existente.com"
                                className="flex-1 px-4 py-2 bg-white dark:bg-slate-800 border border-amber-300 dark:border-amber-700 rounded-lg text-sm"
                            />
                            <select
                                value={newRole}
                                onChange={(e) => setNewRole(e.target.value as UserRole)}
                                className="px-3 py-2 bg-white dark:bg-slate-800 border border-amber-300 dark:border-amber-700 rounded-lg text-sm"
                            >
                                <option value="reader">Lector</option>
                                <option value="admin">Admin</option>
                            </select>
                            <button
                                onClick={handleAddExistingUser}
                                className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-lg text-sm"
                            >
                                Añadir
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AdminPanel;
