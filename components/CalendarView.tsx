import React, { useState, useMemo } from 'react';
import { PermitRecord } from '../types';
import { ChevronLeft, ChevronRight, Calendar, X, FileText } from 'lucide-react';

interface CalendarViewProps {
    isOpen: boolean;
    onClose: () => void;
    records: PermitRecord[];
}

const CalendarView: React.FC<CalendarViewProps> = ({ isOpen, onClose, records }) => {
    const [currentDate, setCurrentDate] = useState(new Date());
    const [selectedDay, setSelectedDay] = useState<number | null>(null);

    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
        'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    const dayNames = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstDayOfMonth = new Date(year, month, 1).getDay();

    // Agrupar decretos por día - expandir a todos los días que cubre cada permiso
    const decreesByDay = useMemo(() => {
        const grouped: Record<number, { record: PermitRecord; isStart: boolean; isEnd: boolean; dayNumber: number }[]> = {};

        records.forEach(r => {
            if (!r.fechaInicio) return;

            const startDate = new Date(r.fechaInicio + 'T12:00:00');
            // Calcular días reales (media jornada = 0.5 días, pero sigue siendo 1 día de calendario)
            const calendarDays = Math.ceil(r.cantidadDias || 1);

            // Expandir a todos los días del rango
            for (let i = 0; i < calendarDays; i++) {
                const currentDate = new Date(startDate);
                currentDate.setDate(startDate.getDate() + i);

                // Solo incluir si está en el mes/año actual
                if (currentDate.getFullYear() === year && currentDate.getMonth() === month) {
                    const day = currentDate.getDate();
                    if (!grouped[day]) grouped[day] = [];
                    grouped[day].push({
                        record: r,
                        isStart: i === 0,
                        isEnd: i === calendarDays - 1,
                        dayNumber: i + 1
                    });
                }
            }
        });

        return grouped;
    }, [records, year, month]);

    const prevMonth = () => {
        setCurrentDate(new Date(year, month - 1, 1));
        setSelectedDay(null);
    };

    const nextMonth = () => {
        setCurrentDate(new Date(year, month + 1, 1));
        setSelectedDay(null);
    };

    const isWeekend = (day: number) => {
        const date = new Date(year, month, day);
        return date.getDay() === 0 || date.getDay() === 6;
    };

    const today = new Date();
    const isToday = (day: number) =>
        day === today.getDate() && month === today.getMonth() && year === today.getFullYear();

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4" onClick={onClose}>
            <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" />
            <div className="relative w-full max-w-4xl max-h-[90vh] bg-white dark:bg-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>

                {/* Header */}
                <div className="bg-gradient-to-r from-indigo-600 to-purple-600 p-6 text-white flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <Calendar className="w-6 h-6" />
                        <div>
                            <h2 className="text-lg font-bold">Calendario de Permisos</h2>
                            <p className="text-xs opacity-80">Vista mensual de decretos</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-xl transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Navigation */}
                <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700">
                    <button onClick={prevMonth} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-colors">
                        <ChevronLeft className="w-5 h-5" />
                    </button>
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                        {monthNames[month]} {year}
                    </h3>
                    <button onClick={nextMonth} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-colors">
                        <ChevronRight className="w-5 h-5" />
                    </button>
                </div>

                {/* Calendar Grid */}
                <div className="flex-1 overflow-auto p-4">
                    {/* Day Headers */}
                    <div className="grid grid-cols-7 gap-1 mb-2">
                        {dayNames.map((name, i) => (
                            <div key={name} className={`text-center py-2 text-xs font-bold uppercase tracking-wider ${i === 0 || i === 6 ? 'text-red-400' : 'text-slate-400'
                                }`}>
                                {name}
                            </div>
                        ))}
                    </div>

                    {/* Day Cells */}
                    <div className="grid grid-cols-7 gap-1">
                        {/* Empty cells for days before the first of the month */}
                        {Array.from({ length: firstDayOfMonth }).map((_, i) => (
                            <div key={`empty-${i}`} className="h-24 bg-slate-50 dark:bg-slate-800/50 rounded-lg" />
                        ))}

                        {/* Actual days */}
                        {Array.from({ length: daysInMonth }).map((_, i) => {
                            const day = i + 1;
                            const dayRecords = decreesByDay[day] || [];
                            const hasRecords = dayRecords.length > 0;
                            const weekend = isWeekend(day);

                            return (
                                <div
                                    key={day}
                                    onClick={() => hasRecords && setSelectedDay(selectedDay === day ? null : day)}
                                    className={`h-24 p-2 rounded-lg border transition-all cursor-pointer ${isToday(day)
                                        ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/30'
                                        : weekend
                                            ? 'border-transparent bg-red-50/50 dark:bg-red-900/10'
                                            : 'border-transparent bg-slate-50 dark:bg-slate-800/50'
                                        } ${hasRecords ? 'hover:border-indigo-300 hover:shadow-md' : ''} ${selectedDay === day ? 'ring-2 ring-indigo-500' : ''
                                        }`}
                                >
                                    <div className={`text-sm font-bold ${isToday(day) ? 'text-indigo-600 dark:text-indigo-400' :
                                        weekend ? 'text-red-400' : 'text-slate-700 dark:text-slate-300'
                                        }`}>
                                        {day}
                                    </div>
                                    {hasRecords && (
                                        <div className="mt-1 space-y-0.5">
                                            {dayRecords.slice(0, 2).map((entry, idx) => (
                                                <div key={idx} className={`text-[9px] px-1.5 py-0.5 rounded truncate font-medium flex items-center gap-1 ${entry.record.solicitudType === 'PA'
                                                    ? 'bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300'
                                                    : 'bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300'
                                                    }`}>
                                                    {!entry.isStart && <span className="opacity-60">→</span>}
                                                    {entry.record.funcionario.split(' ')[0]}
                                                    {entry.record.cantidadDias > 1 && (
                                                        <span className="opacity-60 text-[7px]">
                                                            {entry.dayNumber}/{Math.ceil(entry.record.cantidadDias)}
                                                        </span>
                                                    )}
                                                </div>
                                            ))}
                                            {dayRecords.length > 2 && (
                                                <div className="text-[9px] text-slate-400 font-medium">
                                                    +{dayRecords.length - 2} más
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Selected Day Details */}
                {selectedDay && decreesByDay[selectedDay] && (
                    <div className="border-t border-slate-200 dark:border-slate-700 p-4 bg-slate-50 dark:bg-slate-800/50">
                        <h4 className="text-sm font-bold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
                            <FileText className="w-4 h-4" />
                            Permisos del {selectedDay} de {monthNames[month]}
                        </h4>
                        <div className="space-y-2 max-h-32 overflow-y-auto">
                            {decreesByDay[selectedDay].map((entry, idx) => (
                                <div key={idx} className="flex items-center justify-between bg-white dark:bg-slate-700 p-3 rounded-xl shadow-sm">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2">
                                            <p className="text-sm font-bold text-slate-900 dark:text-white">{entry.record.funcionario}</p>
                                            {!entry.isStart && (
                                                <span className="text-[9px] px-1.5 py-0.5 bg-slate-200 dark:bg-slate-600 rounded text-slate-500 dark:text-slate-400">
                                                    Día {entry.dayNumber} de {Math.ceil(entry.record.cantidadDias)}
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-xs text-slate-500">{entry.record.acto} • {entry.record.cantidadDias} día(s) • {entry.record.tipoJornada}</p>
                                    </div>
                                    <span className={`px-2 py-1 rounded-lg text-[10px] font-bold ${entry.record.solicitudType === 'PA'
                                        ? 'bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300'
                                        : 'bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300'
                                        }`}>
                                        {entry.record.solicitudType}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Legend */}
                <div className="px-4 pb-4 flex items-center gap-4 text-[10px] text-slate-400">
                    <div className="flex items-center gap-1">
                        <div className="w-3 h-3 rounded bg-indigo-100 dark:bg-indigo-900/50" />
                        <span>PA</span>
                    </div>
                    <div className="flex items-center gap-1">
                        <div className="w-3 h-3 rounded bg-amber-100 dark:bg-amber-900/50" />
                        <span>FL</span>
                    </div>
                    <div className="flex items-center gap-1">
                        <div className="w-3 h-3 rounded bg-red-50 dark:bg-red-900/10" />
                        <span>Fin de semana</span>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CalendarView;
