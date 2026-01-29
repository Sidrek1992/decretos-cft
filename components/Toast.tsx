import React, { useEffect, useState } from 'react';
import { CheckCircle, XCircle, AlertTriangle, Info, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastMessage {
    id: string;
    type: ToastType;
    title: string;
    message?: string;
    duration?: number;
}

interface ToastProps {
    toast: ToastMessage;
    onRemove: (id: string) => void;
}

const Toast: React.FC<ToastProps> = React.memo(({ toast, onRemove }) => {
    const [isExiting, setIsExiting] = useState(false);

    useEffect(() => {
        const duration = toast.duration || 4000;
        const timer = setTimeout(() => {
            setIsExiting(true);
            setTimeout(() => onRemove(toast.id), 300);
        }, duration);
        return () => clearTimeout(timer);
    }, [toast, onRemove]);

    const handleClose = () => {
        setIsExiting(true);
        setTimeout(() => onRemove(toast.id), 300);
    };

    const icons = {
        success: CheckCircle,
        error: XCircle,
        warning: AlertTriangle,
        info: Info
    };

    const styles = {
        success: 'bg-emerald-50 dark:bg-emerald-950 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200',
        error: 'bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800 text-red-800 dark:text-red-200',
        warning: 'bg-amber-50 dark:bg-amber-950 border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200',
        info: 'bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-200'
    };

    const iconStyles = {
        success: 'text-emerald-600 dark:text-emerald-400',
        error: 'text-red-600 dark:text-red-400',
        warning: 'text-amber-600 dark:text-amber-400',
        info: 'text-blue-600 dark:text-blue-400'
    };

    const Icon = icons[toast.type];

    return (
        <div
            className={`
        flex items-start gap-3 p-4 rounded-2xl border shadow-xl backdrop-blur-sm
        ${styles[toast.type]}
        ${isExiting ? 'animate-slide-out' : 'animate-slide-in'}
        transition-all duration-300
      `}
        >
            <Icon className={`w-5 h-5 flex-shrink-0 mt-0.5 ${iconStyles[toast.type]}`} />
            <div className="flex-1 min-w-0">
                <p className="text-sm font-bold">{toast.title}</p>
                {toast.message && (
                    <p className="text-xs mt-1 opacity-80">{toast.message}</p>
                )}
            </div>
            <button
                onClick={handleClose}
                className="p-1 rounded-lg hover:bg-black/10 dark:hover:bg-white/10 transition-colors flex-shrink-0"
                aria-label="Cerrar notificación"
            >
                <X className="w-4 h-4" aria-hidden="true" />
            </button>
        </div>
    );
});

Toast.displayName = 'Toast';

// Container de Toasts
interface ToastContainerProps {
    toasts: ToastMessage[];
    onRemove: (id: string) => void;
}

export const ToastContainer: React.FC<ToastContainerProps> = React.memo(({ toasts, onRemove }) => {
    return (
        <div 
            className="fixed bottom-6 right-6 z-[200] flex flex-col gap-3 max-w-sm w-full pointer-events-none"
            role="region"
            aria-label="Notificaciones"
            aria-live="polite"
        >
            {toasts.map(toast => (
                <div key={toast.id} className="pointer-events-auto">
                    <Toast toast={toast} onRemove={onRemove} />
                </div>
            ))}
        </div>
    );
});

ToastContainer.displayName = 'ToastContainer';

// Hook para manejar toasts
export const useToast = () => {
    const [toasts, setToasts] = useState<ToastMessage[]>([]);

    const addToast = (type: ToastType, title: string, message?: string, duration?: number) => {
        const id = crypto.randomUUID();
        setToasts(prev => [...prev, { id, type, title, message, duration }]);
        return id;
    };

    const removeToast = (id: string) => {
        setToasts(prev => prev.filter(t => t.id !== id));
    };

    const toast = {
        success: (title: string, message?: string) => addToast('success', title, message),
        error: (title: string, message?: string) => addToast('error', title, message, 6000),
        warning: (title: string, message?: string) => addToast('warning', title, message),
        info: (title: string, message?: string) => addToast('info', title, message)
    };

    return { toasts, toast, removeToast };
};

export default Toast;
