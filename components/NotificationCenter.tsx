import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { PermitRecord, Employee } from '../types';
import { Bell, X, AlertTriangle, Calendar, User, ChevronRight, Clock, TrendingUp, Info, CheckCircle, AlertCircle } from 'lucide-react';

interface Notification {
    id: string;
    type: 'warning' | 'info' | 'success' | 'critical';
    title: string;
    message: string;
    timestamp: Date;
    read: boolean;
    priority: number; // 1 = alta, 2 = media, 3 = baja
    category: 'saldo' | 'deadline' | 'info' | 'suggestion';
    data?: {
        employeeName?: string;
        employeeRut?: string;
        saldo?: number;
        actionType?: string;
    };
}

interface NotificationCenterProps {
    records: PermitRecord[];
    employees: Employee[];
    onViewEmployee?: (rut: string) => void;
}

const NotificationCenter: React.FC<NotificationCenterProps> = ({ records, employees, onViewEmployee }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [hasNewNotifications, setHasNewNotifications] = useState(false);
    const [filter, setFilter] = useState<'all' | 'unread' | 'critical'>('all');

    // === ALERTAS INTELIGENTES ===
    const generateSmartAlerts = useCallback(() => {
        const newNotifications: Notification[] = [];
        const now = new Date();
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();

        // 🔴 1. ALERTAS DE SALDO BAJO Y NEGATIVO
        employees.forEach(emp => {
            // Alertas PA
            const paRecords = records.filter(r =>
                r.rut === emp.rut && r.solicitudType === 'PA'
            ).sort((a, b) => b.createdAt - a.createdAt);

            if (paRecords.length > 0) {
                const lastRecord = paRecords[0];
                const saldo = lastRecord.diasHaber - lastRecord.cantidadDias;

                // Saldo crítico (0 o negativo)
                if (saldo <= 0) {
                    newNotifications.push({
                        id: `critical-pa-${emp.rut}`,
                        type: 'critical',
                        priority: 1,
                        category: 'saldo',
                        title: '⚠️ Saldo Agotado PA',
                        message: `${emp.nombre} no tiene días de permiso disponibles (${saldo.toFixed(1)} días)`,
                        timestamp: now,
                        read: false,
                        data: { employeeName: emp.nombre, employeeRut: emp.rut, saldo }
                    });
                }
                // Saldo bajo (1-2 días)
                else if (saldo < 2) {
                    newNotifications.push({
                        id: `low-pa-${emp.rut}`,
                        type: 'warning',
                        priority: 2,
                        category: 'saldo',
                        title: 'Saldo Bajo PA',
                        message: `${emp.nombre} tiene solo ${saldo.toFixed(1)} días de permiso`,
                        timestamp: now,
                        read: false,
                        data: { employeeName: emp.nombre, employeeRut: emp.rut, saldo }
                    });
                }
            }

            // Alertas FL - Feriado Legal
            const flRecords = records.filter(r =>
                r.rut === emp.rut && r.solicitudType === 'FL'
            ).sort((a, b) => b.createdAt - a.createdAt);

            if (flRecords.length > 0) {
                const lastFL = flRecords[0];
                const saldoFL = (lastFL.saldoDisponibleP1 || 0) - (lastFL.solicitadoP1 || 0);

                if (saldoFL <= 0) {
                    newNotifications.push({
                        id: `critical-fl-${emp.rut}`,
                        type: 'critical',
                        priority: 1,
                        category: 'saldo',
                        title: '⚠️ Feriado Legal Agotado',
                        message: `${emp.nombre} ha utilizado todo su feriado legal`,
                        timestamp: now,
                        read: false,
                        data: { employeeName: emp.nombre, employeeRut: emp.rut, saldo: saldoFL }
                    });
                }
            }
        });

        // 🟡 2. ALERTA DE FIN DE AÑO (Noviembre y Diciembre)
        if (currentMonth >= 10) { // Noviembre o Diciembre
            const daysUntilYearEnd = Math.ceil((new Date(currentYear, 11, 31).getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

            // Funcionarios con PA sin usar
            const employeesWithUnusedPA = employees.filter(emp => {
                const empRecords = records.filter(r =>
                    r.rut === emp.rut &&
                    r.solicitudType === 'PA' &&
                    new Date(r.fechaInicio).getFullYear() === currentYear
                );
                const totalUsed = empRecords.reduce((sum, r) => sum + r.cantidadDias, 0);
                return totalUsed < 3; // Menos de 3 días usados
            });

            if (employeesWithUnusedPA.length > 0 && daysUntilYearEnd <= 60) {
                newNotifications.push({
                    id: `year-end-warning-${currentYear}`,
                    type: 'warning',
                    priority: 1,
                    category: 'deadline',
                    title: '📅 Fin de Año Próximo',
                    message: `${employeesWithUnusedPA.length} funcionarios tienen permisos sin usar. Quedan ${daysUntilYearEnd} días para fin de año.`,
                    timestamp: now,
                    read: false,
                    data: { actionType: 'view-unused' }
                });
            }
        }

        // 🔵 3. INFORMACIÓN DE ACTIVIDAD RECIENTE
        const recentRecords = records.filter(r => {
            const recordDate = new Date(r.createdAt);
            const daysDiff = (now.getTime() - recordDate.getTime()) / (1000 * 60 * 60 * 24);
            return daysDiff <= 1; // Últimas 24 horas
        });

        if (recentRecords.length > 0) {
            newNotifications.push({
                id: `recent-activity-${now.toDateString()}`,
                type: 'info',
                priority: 3,
                category: 'info',
                title: 'Actividad Reciente',
                message: `${recentRecords.length} decreto(s) registrados en las últimas 24 horas`,
                timestamp: now,
                read: false,
            });
        }

        // 🟢 4. SUGERENCIAS INTELIGENTES basadas en patrones
        const thisMonthRecords = records.filter(r => {
            const d = new Date(r.fechaInicio);
            return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
        });

        // Si hay muchos decretos este mes, sugerir revisar
        if (thisMonthRecords.length > 15) {
            newNotifications.push({
                id: `high-volume-${currentMonth}-${currentYear}`,
                type: 'info',
                priority: 3,
                category: 'suggestion',
                title: '📊 Alto Volumen',
                message: `Se han registrado ${thisMonthRecords.length} decretos este mes. Considera revisar el dashboard para análisis.`,
                timestamp: now,
                read: false,
            });
        }

        return newNotifications;
    }, [records, employees]);

    // Calcular y actualizar notificaciones
    useEffect(() => {
        const alerts = generateSmartAlerts();

        if (alerts.length > 0) {
            setNotifications(prev => {
                const existingIds = new Set(prev.map(n => n.id));
                const uniqueNew = alerts.filter(n => !existingIds.has(n.id));

                if (uniqueNew.length > 0) {
                    setHasNewNotifications(true);
                    // Ordenar por prioridad y luego por fecha
                    const combined = [...uniqueNew, ...prev]
                        .sort((a, b) => a.priority - b.priority || b.timestamp.getTime() - a.timestamp.getTime())
                        .slice(0, 30);
                    return combined;
                }
                return prev;
            });
        }
    }, [generateSmartAlerts]);

    // Filtrar notificaciones
    const filteredNotifications = useMemo(() => {
        switch (filter) {
            case 'unread':
                return notifications.filter(n => !n.read);
            case 'critical':
                return notifications.filter(n => n.type === 'critical' || n.type === 'warning');
            default:
                return notifications;
        }
    }, [notifications, filter]);

    const markAsRead = (id: string) => {
        setNotifications(prev =>
            prev.map(n => n.id === id ? { ...n, read: true } : n)
        );
    };

    const markAllAsRead = () => {
        setNotifications(prev => prev.map(n => ({ ...n, read: true })));
        setHasNewNotifications(false);
    };

    const clearAll = () => {
        setNotifications([]);
        setHasNewNotifications(false);
    };

    const handleNotificationClick = (notification: Notification) => {
        markAsRead(notification.id);
        if (notification.data?.employeeRut && onViewEmployee) {
            onViewEmployee(notification.data.employeeRut);
            setIsOpen(false);
        }
    };

    const unreadCount = notifications.filter(n => !n.read).length;
    const criticalCount = notifications.filter(n => n.type === 'critical' && !n.read).length;

    const getNotificationIcon = (notification: Notification) => {
        switch (notification.type) {
            case 'critical':
                return <AlertCircle className="w-4 h-4" />;
            case 'warning':
                return <AlertTriangle className="w-4 h-4" />;
            case 'success':
                return <CheckCircle className="w-4 h-4" />;
            default:
                return <Info className="w-4 h-4" />;
        }
    };

    const getNotificationStyle = (notification: Notification, isRead: boolean) => {
        if (isRead) {
            return 'bg-slate-50 dark:bg-slate-700/30';
        }
        switch (notification.type) {
            case 'critical':
                return 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800';
            case 'warning':
                return 'bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800';
            case 'success':
                return 'bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800';
            default:
                return 'bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800';
        }
    };

    const getIconStyle = (notification: Notification) => {
        switch (notification.type) {
            case 'critical':
                return 'bg-red-100 dark:bg-red-900/50 text-red-600 dark:text-red-400';
            case 'warning':
                return 'bg-amber-100 dark:bg-amber-900/50 text-amber-600 dark:text-amber-400';
            case 'success':
                return 'bg-emerald-100 dark:bg-emerald-900/50 text-emerald-600 dark:text-emerald-400';
            default:
                return 'bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400';
        }
    };

    return (
        <>
            {/* Bell Button */}
            <button
                onClick={() => { setIsOpen(true); setHasNewNotifications(false); }}
                className={`relative p-2.5 bg-white dark:bg-slate-800 border text-slate-400 hover:text-amber-500 dark:hover:text-amber-400 rounded-xl transition-all shadow-sm ${criticalCount > 0
                        ? 'border-red-300 dark:border-red-700'
                        : 'border-slate-200 dark:border-slate-700'
                    }`}
                title="Notificaciones"
            >
                <Bell className="w-4 h-4 sm:w-5 sm:h-5" />

                {/* Badge */}
                {unreadCount > 0 && (
                    <span className={`absolute -top-1 -right-1 w-5 h-5 text-white text-[10px] font-black rounded-full flex items-center justify-center ${criticalCount > 0 ? 'bg-red-600 animate-pulse' : 'bg-amber-500'
                        }`}>
                        {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                )}

                {/* Ping animation for critical */}
                {criticalCount > 0 && (
                    <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-400 rounded-full animate-ping" />
                )}
            </button>

            {/* Notification Panel */}
            {isOpen && (
                <div
                    className="fixed inset-0 z-[200] flex items-start justify-end p-4 sm:p-6"
                    onClick={() => setIsOpen(false)}
                >
                    {/* Backdrop */}
                    <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" />

                    {/* Panel */}
                    <div
                        className="relative w-full max-w-md bg-white dark:bg-slate-800 rounded-3xl shadow-2xl overflow-hidden mt-16 sm:mt-20 animate-in slide-in-from-right duration-300"
                        onClick={e => e.stopPropagation()}
                    >
                        {/* Header */}
                        <div className="bg-gradient-to-r from-slate-900 to-slate-800 dark:from-slate-950 dark:to-slate-900 p-5 text-white">
                            <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-white/20 rounded-xl">
                                        <Bell className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <h3 className="text-sm font-black uppercase tracking-wider">Centro de Alertas</h3>
                                        <p className="text-[10px] font-bold text-white/60 uppercase tracking-wider">
                                            {unreadCount} sin leer {criticalCount > 0 && `• ${criticalCount} críticas`}
                                        </p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setIsOpen(false)}
                                    className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            {/* Filter tabs */}
                            <div className="flex gap-2">
                                {[
                                    { id: 'all', label: 'Todas' },
                                    { id: 'unread', label: 'Sin leer' },
                                    { id: 'critical', label: 'Críticas' },
                                ].map(tab => (
                                    <button
                                        key={tab.id}
                                        onClick={() => setFilter(tab.id as typeof filter)}
                                        className={`px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-colors ${filter === tab.id
                                                ? 'bg-white text-slate-900'
                                                : 'bg-white/10 text-white/70 hover:bg-white/20'
                                            }`}
                                    >
                                        {tab.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Actions bar */}
                        {notifications.length > 0 && (
                            <div className="px-4 py-2 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700 flex justify-end gap-2">
                                <button
                                    onClick={markAllAsRead}
                                    className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 transition-colors"
                                >
                                    Marcar leídas
                                </button>
                                <button
                                    onClick={clearAll}
                                    className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 transition-colors"
                                >
                                    Limpiar todo
                                </button>
                            </div>
                        )}

                        {/* Notifications List */}
                        <div className="max-h-[55vh] overflow-y-auto custom-scrollbar">
                            {filteredNotifications.length > 0 ? (
                                <div className="p-3 space-y-2">
                                    {filteredNotifications.map(notification => (
                                        <div
                                            key={notification.id}
                                            onClick={() => handleNotificationClick(notification)}
                                            className={`group p-4 rounded-2xl cursor-pointer transition-all hover:shadow-md ${getNotificationStyle(notification, notification.read)}`}
                                        >
                                            <div className="flex items-start gap-3">
                                                <div className={`p-2 rounded-xl ${getIconStyle(notification)}`}>
                                                    {getNotificationIcon(notification)}
                                                </div>

                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center justify-between gap-2">
                                                        <p className={`text-xs font-black uppercase tracking-wider ${notification.read
                                                                ? 'text-slate-500 dark:text-slate-400'
                                                                : notification.type === 'critical'
                                                                    ? 'text-red-700 dark:text-red-300'
                                                                    : notification.type === 'warning'
                                                                        ? 'text-amber-700 dark:text-amber-300'
                                                                        : 'text-blue-700 dark:text-blue-300'
                                                            }`}>
                                                            {notification.title}
                                                        </p>
                                                        {!notification.read && (
                                                            <span className={`w-2 h-2 rounded-full flex-shrink-0 ${notification.type === 'critical' ? 'bg-red-500' : 'bg-amber-500'
                                                                }`} />
                                                        )}
                                                    </div>
                                                    <p className="text-[11px] font-medium text-slate-600 dark:text-slate-300 mt-1 line-clamp-2">
                                                        {notification.message}
                                                    </p>
                                                    <div className="flex items-center gap-2 mt-2">
                                                        <Clock className="w-3 h-3 text-slate-400" />
                                                        <p className="text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                                                            {notification.timestamp.toLocaleTimeString()}
                                                        </p>
                                                        {notification.data?.employeeName && (
                                                            <>
                                                                <span className="text-slate-300">•</span>
                                                                <p className="text-[9px] font-bold text-indigo-500 uppercase tracking-wider">
                                                                    Ver funcionario →
                                                                </p>
                                                            </>
                                                        )}
                                                    </div>
                                                </div>

                                                <ChevronRight className="w-4 h-4 text-slate-300 dark:text-slate-600 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="py-16 text-center">
                                    <Bell className="w-12 h-12 text-slate-200 dark:text-slate-700 mx-auto mb-4" />
                                    <p className="text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                                        {filter === 'all' ? 'Sin notificaciones' : `Sin notificaciones ${filter === 'unread' ? 'sin leer' : 'críticas'}`}
                                    </p>
                                    <p className="text-[10px] text-slate-400 dark:text-slate-600 mt-1">
                                        Te notificaremos sobre saldos bajos y fechas importantes
                                    </p>
                                </div>
                            )}
                        </div>

                        {/* Footer */}
                        <div className="p-4 border-t border-slate-100 dark:border-slate-700 bg-gradient-to-r from-slate-50 to-slate-100 dark:from-slate-800/50 dark:to-slate-800/30">
                            <div className="flex items-center justify-center gap-4 text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                                <span className="flex items-center gap-1">
                                    <span className="w-2 h-2 bg-red-500 rounded-full"></span>
                                    Crítico
                                </span>
                                <span className="flex items-center gap-1">
                                    <span className="w-2 h-2 bg-amber-500 rounded-full"></span>
                                    Advertencia
                                </span>
                                <span className="flex items-center gap-1">
                                    <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                                    Info
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

export default NotificationCenter;
