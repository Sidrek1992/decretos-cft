import React, { useState, useMemo } from 'react';
import { PermitRecord } from '../types';
import { ChevronLeft, ChevronRight, Calendar, X, FileText, Search, RotateCcw } from 'lucide-react';

interface CalendarViewProps {
    isOpen: boolean;
    onClose: () => void;
    records: PermitRecord[];
}

type TypeFilter = 'todos' | 'PA' | 'FL';

const CalendarView: React.FC<CalendarViewProps> = ({ isOpen, onClose, records }) => {
    const today = new Date();
    const [currentDate, setCurrentDate] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
    const [selectedDay, setSelectedDay] = useState<number | null>(null);
    const [typeFilter, setTypeFilter] = useState<TypeFilter>('todos');
    const [employeeSearch, setEmployeeSearch] = useState('');

    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
        'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    const dayNames = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstDayOfMonth = new Date(year, month, 1).getDay();

    // Años disponibles
    const availableYears = useMemo(() => {
        const years = new Set<number>();
        records.forEach(r => {
            if (r.fechaInicio) years.add(new Date(r.fechaInicio + 'T12:00:00').getFullYear());
        });
        years.add(today.getFullYear());
        return [...years].sort((a, b) => b - a);
    }, [records]);

    // Filtrar registros según tipo + búsqueda de empleado
    const filteredRecords = useMemo(() => {
        return records.filter(r => {
            if (typeFilter !== 'todos' && r.solicitudType !== typeFilter) return false;
            if (employeeSearch.trim()) {
                const q = employeeSearch.trim().toLowerCase();
                if (!r.funcionario.toLowerCase().includes(q) && !r.rut.includes(q)) return false;
            }
            return true;
        });
    }, [records, typeFilter, employeeSearch]);

    // Agrupar por día con info de rango
    const decreesByDay = useMemo(() => {
        const grouped: Record<number, { record: PermitRecord; isStart: boolean; isEnd: boolean; isMid: boolean; dayNumber: number }[]> = {};

        filteredRecords.forEach(r => {
            if (!r.fechaInicio) return;
            const startDate = new Date(r.fechaInicio + 'T12:00:00');
            // Para FL usar fechaTermino si existe para calcular rango real
            let calendarDays: number;
            if (r.solicitudType === 'FL' && r.fechaTermino) {
                const end = new Date(r.fechaTermino + 'T12:00:00');
                calendarDays = Math.round((end.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
            } else {
                calendarDays = Math.max(Math.ceil(r.cantidadDias || 1), 1);
            }

            for (let i = 0; i < calendarDays; i++) {
                const d = new Date(startDate);
                d.setDate(startDate.getDate() + i);
                if (d.getFullYear() === year && d.getMonth() === month) {
                    const day = d.getDate();
                    if (!grouped[day]) grouped[day] = [];
                    grouped[day].push({
                        record: r,
                        isStart: i === 0,
                        isEnd: i === calendarDays - 1,
                        isMid: i > 0 && i < calendarDays - 1,
                        dayNumber: i + 1
                    });
                }
            }
        });
        return grouped;
    }, [filteredRecords, year, month]);

    // Resumen mensual
    const monthlySummary = useMemo(() => {
        let totalPA = 0, totalFL = 0, countPA = 0, countFL = 0;
        const seen = new Set<string>();
        filteredRecords.forEach(r => {
            if (!r.fechaInicio) return;
            const d = new Date(r.fechaInicio + 'T12:00:00');
            if (d.getFullYear() !== year || d.getMonth() !== month) return;
            const key = r.id || `${r.funcionario}-${r.fechaInicio}-${r.solicitudType}`;
            if (seen.has(key)) return;
            seen.add(key);
            if (r.solicitudType === 'PA') { totalPA += r.cantidadDias; countPA++; }
            else { totalFL += r.cantidadDias; countFL++; }
        });
        return { totalPA, totalFL, countPA, countFL };
    }, [filteredRecords, year, month]);

    // Nav
    const prevMonth = () => { setCurrentDate(new Date(year, month - 1, 1)); setSelectedDay(null); };
    const nextMonth = () => { setCurrentDate(new Date(year, month + 1, 1)); setSelectedDay(null); };
    const goToday = () => { setCurrentDate(new Date(today.getFullYear(), today.getMonth(), 1)); setSelectedDay(null); };

    const isWeekend = (day: number) => {
        const d = new Date(year, month, day);
        return d.getDay() === 0 || d.getDay() === 6;
    };
    const isToday = (day: number) =>
        day === today.getDate() && month === today.getMonth() && year === today.getFullYear();

    // Badge de rango: esquinas según posición
    const badgeRadius = (isStart: boolean, isEnd: boolean) => {
        if (isStart && isEnd) return 'rounded-md';
        if (isStart) return 'rounded-l-md';
        if (isEnd) return 'rounded-r-md';
        return 'rounded-none';
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4" onClick={onClose}>
            <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" />
            <div className="relative w-full max-w-5xl max-h-[92vh] bg-white dark:bg-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>

                {/* ─── Header ─── */}
                <div className="bg-gradient-to-r from-indigo-600 to-purple-600 p-5 sm:p-6 text-white">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="bg-white/20 backdrop-blur p-2 rounded-xl">
                                <Calendar className="w-5 h-5" />
                            </div>
                            <div>
                                <h2 className="text-base sm:text-lg font-black">Calendario de Permisos</h2>
                                <p className="text-[11px] opacity-70 font-bold uppercase tracking-wider">Vista mensual de decretos</p>
                            </div>
                        </div>
                        <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-xl transition-colors">
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* ─── Filtros + Búsqueda ─── */}
                <div className="px-4 sm:px-6 pt-4 pb-2 border-b border-slate-200 dark:border-slate-700 space-y-3">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                        {/* Filtro tipo */}
                        <div className="flex bg-slate-100 dark:bg-slate-700 rounded-lg p-0.5 gap-0.5">
                            {(['todos', 'PA', 'FL'] as const).map(opt => {
                                const labels: Record<string, string> = { todos: 'Todos', PA: 'PA', FL: 'FL' };
                                const active = typeFilter === opt;
                                const colors: Record<string, string> = {
                                    todos: active ? 'bg-white dark:bg-slate-600 text-slate-800 dark:text-white shadow-sm' : '',
                                    PA: active ? 'bg-indigo-600 text-white shadow-sm' : '',
                                    FL: active ? 'bg-amber-500 text-white shadow-sm' : ''
                                };
                                return (
                                    <button
                                        key={opt}
                                        type="button"
                                        onClick={() => { setTypeFilter(opt); setSelectedDay(null); }}
                                        className={`px-3 py-1 rounded-md text-[10px] font-black transition-all ${colors[opt]} ${!active ? 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200' : ''}`}
                                    >
                                        {labels[opt]}
                                    </button>
                                );
                            })}
                        </div>

                        {/* Búsqueda empleado */}
                        <div className="relative">
                            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                            <input
                                type="text"
                                placeholder="Buscar empleado..."
                                value={employeeSearch}
                                onChange={e => { setEmployeeSearch(e.target.value); setSelectedDay(null); }}
                                className="pl-7 pr-3 py-1.5 bg-slate-100 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-[11px] font-bold text-slate-700 dark:text-slate-200 placeholder-slate-400 outline-none focus:border-indigo-400 w-44"
                            />
                        </div>
                    </div>
                </div>

                {/* ─── Resumen mensual ─── */}
                <div className="px-4 sm:px-6 py-3 flex items-center gap-3 sm:gap-5 border-b border-slate-100 dark:border-slate-700 flex-wrap">
                    <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full bg-indigo-500" />
                        <span className="text-[11px] font-black text-slate-500 dark:text-slate-400">PA:</span>
                        <span className="text-[11px] font-black text-indigo-600 dark:text-indigo-400">{monthlySummary.countPA} decretos</span>
                        <span className="text-[10px] text-slate-400">({monthlySummary.totalPA} días)</span>
                    </div>
                    <div className="w-px h-4 bg-slate-200 dark:bg-slate-600" />
                    <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                        <span className="text-[11px] font-black text-slate-500 dark:text-slate-400">FL:</span>
                        <span className="text-[11px] font-black text-amber-600 dark:text-amber-400">{monthlySummary.countFL} decretos</span>
                        <span className="text-[10px] text-slate-400">({monthlySummary.totalFL} días)</span>
                    </div>
                    <div className="w-px h-4 bg-slate-200 dark:bg-slate-600" />
                    <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500">
                        Total: {monthlySummary.totalPA + monthlySummary.totalFL} días este mes
                    </span>
                </div>

                {/* ─── Navigación mes/año ─── */}
                <div className="flex items-center justify-between px-4 sm:px-6 py-3 border-b border-slate-200 dark:border-slate-700">
                    <div className="flex items-center gap-1">
                        <button onClick={prevMonth} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors">
                            <ChevronLeft className="w-4 h-4 text-slate-600 dark:text-slate-300" />
                        </button>
                        <button onClick={nextMonth} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors">
                            <ChevronRight className="w-4 h-4 text-slate-600 dark:text-slate-300" />
                        </button>
                    </div>

                    <h3 className="text-base font-black text-slate-900 dark:text-white">
                        {monthNames[month]} {year}
                    </h3>

                    <div className="flex items-center gap-2">
                        {/* Selector de año */}
                        <select
                            value={year}
                            onChange={e => { setCurrentDate(new Date(Number(e.target.value), month, 1)); setSelectedDay(null); }}
                            className="bg-slate-100 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-200 text-[11px] font-black px-2 py-1 rounded-lg outline-none focus:border-indigo-400 cursor-pointer"
                        >
                            {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
                        </select>
                        {/* Botón Hoy */}
                        <button
                            onClick={goToday}
                            className="flex items-center gap-1 px-2.5 py-1 bg-indigo-50 dark:bg-indigo-900/30 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 rounded-lg transition-colors"
                        >
                            <RotateCcw className="w-3 h-3" />
                            <span className="text-[10px] font-black">Hoy</span>
                        </button>
                    </div>
                </div>

                {/* ─── Grid del calendario ─── */}
                <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-3">
                    {/* Headers días */}
                    <div className="grid grid-cols-7 gap-1 mb-1.5 sticky top-0 bg-white dark:bg-slate-800 pb-1 z-10">
                        {dayNames.map((name, i) => (
                            <div key={name} className={`text-center py-1.5 text-[10px] font-black uppercase tracking-wider ${i === 0 || i === 6 ? 'text-red-400' : 'text-slate-400 dark:text-slate-500'}`}>
                                {name}
                            </div>
                        ))}
                    </div>

                    {/* Celdas */}
                    <div className="grid grid-cols-7 gap-1">
                        {/* Celldas vacías antes del 1 */}
                        {Array.from({ length: firstDayOfMonth }).map((_, i) => (
                            <div key={`empty-${i}`} className="h-24 bg-slate-50 dark:bg-slate-800/40 rounded-lg" />
                        ))}

                        {Array.from({ length: daysInMonth }).map((_, i) => {
                            const day = i + 1;
                            const dayRecords = decreesByDay[day] || [];
                            const hasRecords = dayRecords.length > 0;
                            const weekend = isWeekend(day);
                            const isSelected = selectedDay === day;

                            return (
                                <div
                                    key={day}
                                    onClick={() => hasRecords ? setSelectedDay(isSelected ? null : day) : setSelectedDay(null)}
                                    className={[
                                        'min-h-24 p-1.5 rounded-lg border transition-all',
                                        isToday(day) ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20' : weekend ? 'border-transparent bg-red-50/40 dark:bg-red-900/8' : 'border-transparent bg-slate-50 dark:bg-slate-800/40',
                                        hasRecords ? 'cursor-pointer hover:border-indigo-300 dark:hover:border-indigo-700 hover:shadow-md' : '',
                                        isSelected ? 'ring-2 ring-indigo-500 border-indigo-400' : ''
                                    ].join(' ')}
                                >
                                    {/* Número del día */}
                                    <div className={[
                                        'text-[11px] font-black mb-0.5 px-0.5',
                                        isToday(day) ? 'text-indigo-600 dark:text-indigo-400' : weekend ? 'text-red-400' : 'text-slate-600 dark:text-slate-300'
                                    ].join(' ')}>
                                        {isToday(day) ? (
                                            <span className="inline-flex items-center justify-center w-5 h-5 bg-indigo-600 text-white rounded-full text-[10px]">{day}</span>
                                        ) : day}
                                    </div>

                                    {/* Badges de permisos */}
                                    {hasRecords && (
                                        <div className="space-y-0.5">
                                            {dayRecords.slice(0, 3).map((entry, idx) => {
                                                const isPA = entry.record.solicitudType === 'PA';
                                                const bg = isPA ? 'bg-indigo-100 dark:bg-indigo-900/50' : 'bg-amber-100 dark:bg-amber-900/50';
                                                const txt = isPA ? 'text-indigo-700 dark:text-indigo-300' : 'text-amber-700 dark:text-amber-300';
                                                const radius = badgeRadius(entry.isStart, entry.isEnd);
                                                // Si es medio de rango, añadir borde izquierdo coloreado
                                                const midBorder = entry.isMid ? (isPA ? 'border-l-2 border-l-indigo-400' : 'border-l-2 border-l-amber-400') : '';

                                                return (
                                                    <div
                                                        key={idx}
                                                        className={`${bg} ${txt} ${radius} ${midBorder} text-[9px] px-1.5 py-0.5 truncate font-bold flex items-center gap-0.5`}
                                                    >
                                                        {entry.isStart && <span className="text-[7px] opacity-70">●</span>}
                                                        {entry.isMid && <span className="text-[7px] opacity-50">─</span>}
                                                        {entry.isEnd && !entry.isStart && <span className="text-[7px] opacity-70">◆</span>}
                                                        <span className="truncate">{entry.record.funcionario.split(' ')[0]}</span>
                                                    </div>
                                                );
                                            })}
                                            {dayRecords.length > 3 && (
                                                <div className="text-[9px] text-slate-400 dark:text-slate-500 font-black px-1">
                                                    +{dayRecords.length - 3} más
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* ─── Panel detalle del día seleccionado ─── */}
                {selectedDay && decreesByDay[selectedDay] && (
                    <div className="border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60">
                        {/* Header del panel */}
                        <div className="flex items-center justify-between px-4 sm:px-6 pt-3 pb-2">
                            <h4 className="text-sm font-black text-slate-900 dark:text-white flex items-center gap-2">
                                <FileText className="w-4 h-4 text-indigo-500" />
                                {dayNames[new Date(year, month, selectedDay).getDay()]} {selectedDay} de {monthNames[month]}
                            </h4>
                            <span className="text-[10px] font-black text-slate-400 bg-slate-200 dark:bg-slate-700 px-2 py-0.5 rounded-full">
                                {decreesByDay[selectedDay].length} permiso{decreesByDay[selectedDay].length !== 1 ? 's' : ''}
                            </span>
                        </div>

                        {/* Lista de permisos */}
                        <div className="px-4 sm:px-6 pb-4 space-y-2 max-h-48 overflow-y-auto">
                            {decreesByDay[selectedDay].map((entry, idx) => {
                                const isPA = entry.record.solicitudType === 'PA';
                                return (
                                    <div key={idx} className="flex items-start justify-between bg-white dark:bg-slate-700 p-3 rounded-xl shadow-sm border border-slate-100 dark:border-slate-600">
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <p className="text-sm font-black text-slate-900 dark:text-white">{entry.record.funcionario}</p>
                                                <span className={`text-[9px] font-black px-2 py-0.5 rounded-full ${isPA ? 'bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300' : 'bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300'}`}>
                                                    {entry.record.solicitudType}
                                                </span>
                                                {!entry.isStart && (
                                                    <span className="text-[9px] font-bold bg-slate-100 dark:bg-slate-600 text-slate-500 dark:text-slate-400 px-2 py-0.5 rounded-full">
                                                        Día {entry.dayNumber}
                                                    </span>
                                                )}
                                            </div>
                                            <div className="mt-1 flex items-center gap-2 flex-wrap">
                                                <span className="text-[11px] text-slate-500 dark:text-slate-400 font-bold">{entry.record.acto}</span>
                                                <span className="text-slate-300 dark:text-slate-600">•</span>
                                                <span className="text-[11px] text-slate-500 dark:text-slate-400 font-bold">{entry.record.cantidadDias} día{entry.record.cantidadDias !== 1 ? 's' : ''}</span>
                                                <span className="text-slate-300 dark:text-slate-600">•</span>
                                                <span className="text-[11px] text-slate-500 dark:text-slate-400 font-bold">{entry.record.tipoJornada}</span>
                                                {entry.record.fechaTermino && (
                                                    <>
                                                        <span className="text-slate-300 dark:text-slate-600">•</span>
                                                        <span className="text-[11px] text-slate-500 dark:text-slate-400 font-bold">Hasta {entry.record.fechaTermino}</span>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* ─── Leyenda ─── */}
                <div className="px-4 sm:px-6 py-2.5 border-t border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800 flex items-center gap-4 flex-wrap">
                    <div className="flex items-center gap-1.5">
                        <div className="w-3 h-3 rounded bg-indigo-100 dark:bg-indigo-900/50 border border-indigo-200 dark:border-indigo-800" />
                        <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400">Permiso Admin.</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <div className="w-3 h-3 rounded bg-amber-100 dark:bg-amber-900/50 border border-amber-200 dark:border-amber-800" />
                        <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400">Feriado Legal</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <div className="w-3 h-3 rounded bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-900/30" />
                        <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400">Fin de semana</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <div className="w-5 h-5 rounded-full bg-indigo-600 flex items-center justify-center">
                            <span className="text-[8px] text-white font-black">1</span>
                        </div>
                        <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400">Hoy</span>
                    </div>
                    <div className="flex items-center gap-1.5 ml-auto">
                        <span className="text-[9px] text-slate-400 dark:text-slate-500">● inicio</span>
                        <span className="text-[9px] text-slate-400 dark:text-slate-500">─ medio</span>
                        <span className="text-[9px] text-slate-400 dark:text-slate-500">◆ fin</span>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CalendarView;
