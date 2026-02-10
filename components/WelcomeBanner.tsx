import React, { useMemo, useState, useEffect } from 'react';
import { Sparkles, X, ChevronRight, Calendar, Shield, TrendingUp, Clock } from 'lucide-react';

interface WelcomeBannerProps {
    userName?: string;
    totalRecords: number;
    totalEmployees: number;
    criticalAlerts: number;
}

const WelcomeBanner: React.FC<WelcomeBannerProps> = ({
    userName,
    totalRecords,
    totalEmployees,
    criticalAlerts,
}) => {
    const [isDismissed, setIsDismissed] = useState(false);
    const [isAnimating, setIsAnimating] = useState(false);

    // Check if already dismissed today
    useEffect(() => {
        const key = `gdp-banner-dismissed-${new Date().toDateString()}`;
        if (localStorage.getItem(key)) {
            setIsDismissed(true);
        }
    }, []);

    const dismiss = () => {
        setIsAnimating(true);
        const key = `gdp-banner-dismissed-${new Date().toDateString()}`;
        localStorage.setItem(key, 'true');
        setTimeout(() => setIsDismissed(true), 300);
    };

    const greeting = useMemo(() => {
        const hour = new Date().getHours();
        if (hour < 12) return 'Buenos días';
        if (hour < 18) return 'Buenas tardes';
        return 'Buenas noches';
    }, []);

    const todayStr = useMemo(() => {
        const now = new Date();
        return now.toLocaleDateString('es-CL', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
            year: 'numeric'
        });
    }, []);

    const displayName = userName?.trim() || null;

    if (isDismissed) return null;

    return (
        <div className={`relative overflow-hidden rounded-2xl p-5 page-fade-in ${isAnimating ? 'toast-exit' : ''}`}>
            {/* Background gradient */}
            <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/5 via-purple-500/5 to-pink-500/5 dark:from-indigo-500/10 dark:via-purple-500/10 dark:to-pink-500/10" />
            <div className="absolute inset-0 border border-indigo-100/50 dark:border-indigo-800/30 rounded-2xl" />

            <div className="relative flex items-start justify-between gap-4">
                <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                        <Sparkles className="w-4 h-4 text-indigo-500" />
                        <span className="text-[10px] font-black text-indigo-500/70 dark:text-indigo-400/70 uppercase tracking-widest">
                            {todayStr}
                        </span>
                    </div>

                    <h2 className="text-base sm:text-lg font-black text-slate-800 dark:text-white tracking-tight">
                        {greeting}{displayName ? `, ${displayName}` : ''}
                    </h2>

                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed max-w-lg">
                        {criticalAlerts > 0
                            ? `Tienes ${criticalAlerts} alerta${criticalAlerts > 1 ? 's' : ''} que requiere${criticalAlerts > 1 ? 'n' : ''} atención.`
                            : 'Todo en orden. Los saldos y registros están actualizados.'
                        }
                    </p>

                    {/* Quick stats pills */}
                    <div className="flex flex-wrap gap-2 mt-3">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white/80 dark:bg-slate-800/80 border border-slate-200/50 dark:border-slate-700/50 rounded-lg text-[10px] font-bold text-slate-600 dark:text-slate-300">
                            <TrendingUp className="w-3 h-3 text-indigo-500" />
                            {totalRecords} decretos
                        </span>
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-white/80 dark:bg-slate-800/80 border border-slate-200/50 dark:border-slate-700/50 rounded-lg text-[10px] font-bold text-slate-600 dark:text-slate-300">
                            <Shield className="w-3 h-3 text-emerald-500" />
                            {totalEmployees} funcionarios
                        </span>
                        {criticalAlerts > 0 && (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-red-50 dark:bg-red-900/20 border border-red-200/50 dark:border-red-800/50 rounded-lg text-[10px] font-bold text-red-600 dark:text-red-400">
                                <Clock className="w-3 h-3" />
                                {criticalAlerts} urgente{criticalAlerts > 1 ? 's' : ''}
                            </span>
                        )}
                    </div>
                </div>

                <button
                    onClick={dismiss}
                    className="p-1.5 rounded-lg hover:bg-slate-200/50 dark:hover:bg-slate-700/50 transition-colors text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 shrink-0"
                    aria-label="Cerrar banner"
                >
                    <X className="w-4 h-4" />
                </button>
            </div>
        </div>
    );
};

export default WelcomeBanner;
