
import React, { useMemo, useState } from 'react';
import { PermitRecord } from '../types';
import {
    AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    PieChart, Pie, Cell, Legend, BarChart, Bar
} from 'recharts';
import { TrendingUp, TrendingDown, Users, Calendar, AlertTriangle, ChevronRight, FileDown, Loader2, Activity, Clock } from 'lucide-react';
import { exportDashboardToPDF } from '../services/batchPdfGenerator';
import { CONFIG } from '../config';

interface DashboardProps {
    records: PermitRecord[];
    employees: { nombre: string; rut: string }[];
    onViewLowBalance: () => void;
}

const COLORS = {
    PA: '#6366f1',
    FL: '#f59e0b',
    positive: '#10b981',
    negative: '#ef4444',
    neutral: '#64748b',
    paLight: '#6366f120',
    flLight: '#f59e0b20'
};

// ---------------------------------------------------------------------------
// Componentes auxiliares reutilizables
// ---------------------------------------------------------------------------

interface KpiCardProps {
    label: string;
    value: string | number;
    sub?: string;
    icon: React.ComponentType<{ className?: string }>;
    iconBg: string;
    iconColor: string;
    borderColor?: string;
    trend?: { value: number; label: string };
    onClick?: () => void;
    highlight?: boolean;
}

const KpiCard: React.FC<KpiCardProps> = ({ label, value, sub, icon: Icon, iconBg, iconColor, borderColor = 'border-slate-200 dark:border-slate-700', trend, onClick, highlight }) => (
    <div
        onClick={onClick}
        className={`bg-white dark:bg-slate-800 rounded-2xl p-4 border ${borderColor} transition-all hover:shadow-md ${onClick ? 'cursor-pointer group' : ''} ${highlight ? 'ring-2 ring-amber-400/60' : ''}`}
    >
        <div className="flex items-start justify-between">
            <div className={`${iconBg} ${iconColor} p-2.5 rounded-xl ${onClick ? 'group-hover:scale-110 transition-transform' : ''}`}>
                <Icon className="w-5 h-5" />
            </div>
            {trend && (
                <div className={`flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded-full ${trend.value >= 0 ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400' : 'bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400'}`}>
                    {trend.value >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                    {trend.label}
                </div>
            )}
        </div>
        <div className="mt-3">
            <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-wider">{label}</p>
            <div className="flex items-center gap-2 mt-0.5">
                <p className="text-2xl font-black text-slate-900 dark:text-white">{value}</p>
                {onClick && <ChevronRight className="w-4 h-4 text-slate-300 group-hover:translate-x-1 transition-transform" />}
            </div>
            {sub && <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 mt-0.5">{sub}</p>}
        </div>
    </div>
);

// Tooltip personalizado para gráficos
interface CustomTooltipProps {
    active?: boolean;
    payload?: Array<{ name: string; value: number; color: string }>;
    label?: string;
}

const CustomTooltip: React.FC<CustomTooltipProps> = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    return (
        <div className="bg-slate-900 dark:bg-slate-700 border border-slate-700 dark:border-slate-600 rounded-xl p-3 shadow-xl">
            <p className="text-[11px] font-black text-slate-300 mb-2 uppercase tracking-wider">{label}</p>
            {payload.map((entry, i) => (
                <div key={i} className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-1.5">
                        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: entry.color }} />
                        <span className="text-[11px] font-bold text-slate-400">{entry.name}</span>
                    </div>
                    <span className="text-[11px] font-black text-white">{entry.value} días</span>
                </div>
            ))}
        </div>
    );
};

// ---------------------------------------------------------------------------
// Dashboard principal
// ---------------------------------------------------------------------------

const Dashboard: React.FC<DashboardProps> = ({ records, employees, onViewLowBalance }) => {
    const [isExporting, setIsExporting] = useState(false);
    const [yearFilter, setYearFilter] = useState<number>(() => new Date().getFullYear());
    const [topFilter, setTopFilter] = useState<'todos' | 'PA' | 'FL'>('todos');

    const handleExportPDF = async () => {
        setIsExporting(true);
        try {
            await exportDashboardToPDF('dashboard-content', 'Reporte GDP Cloud - Dashboard Analytics');
        } catch (error) {
            console.error('Error al exportar Dashboard:', error);
        } finally {
            setIsExporting(false);
        }
    };

    // Años disponibles para filtro
    const availableYears = useMemo(() => {
        const years = new Set<number>();
        records.forEach(r => {
            if (r.fechaInicio) {
                const y = new Date(r.fechaInicio + 'T12:00:00').getFullYear();
                if (y) years.add(y);
            }
        });
        years.add(new Date().getFullYear());
        return [...years].sort((a, b) => b - a);
    }, [records]);

    // ---------------------------------------------------------------------------
    // Cálculos centralizados
    // ---------------------------------------------------------------------------
    const stats = useMemo(() => {
        const monthNames = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
        const now = new Date();
        const currentMonth = now.getMonth();
        const currentYear = now.getFullYear();

        // Filtrar por año seleccionado
        const filtered = records.filter(r => {
            if (!r.fechaInicio) return false;
            return new Date(r.fechaInicio + 'T12:00:00').getFullYear() === yearFilter;
        });

        // --- Mensuales (12 meses del año filtrado) ---
        const months: Record<string, { PA: number; FL: number; total: number }> = {};
        for (let m = 0; m < 12; m++) {
            months[`${monthNames[m]}`] = { PA: 0, FL: 0, total: 0 };
        }
        filtered.forEach(r => {
            const m = new Date(r.fechaInicio + 'T12:00:00').getMonth();
            const key = monthNames[m];
            months[key][r.solicitudType] += r.cantidadDias;
            months[key].total += r.cantidadDias;
        });
        const monthlyData = Object.entries(months).map(([name, data]) => ({ name, ...data }));

        // --- Este mes (siempre sobre datos reales, no filtro de año) ---
        const thisMonthRecords = records.filter(r => {
            if (!r.fechaInicio) return false;
            const d = new Date(r.fechaInicio + 'T12:00:00');
            return d.getFullYear() === currentYear && d.getMonth() === currentMonth;
        });
        const lastMonthRecords = records.filter(r => {
            if (!r.fechaInicio) return false;
            const d = new Date(r.fechaInicio + 'T12:00:00');
            const prevMonth = currentMonth === 0 ? 11 : currentMonth - 1;
            const prevYear = currentMonth === 0 ? currentYear - 1 : currentYear;
            return d.getFullYear() === prevYear && d.getMonth() === prevMonth;
        });

        // --- Conteos globales (sin filtro de año, para KPIs principales) ---
        let paCount = 0, flCount = 0, totalDays = 0;
        const uniqueRuts = new Set<string>();
        const byEmployee: Record<string, { nombre: string; diasPA: number; diasFL: number; totalDias: number }> = {};

        // Último registro por RUT por tipo → para saldo
        const lastByRutPA: Record<string, PermitRecord> = {};
        const lastByRutFL: Record<string, PermitRecord> = {};
        const sortedByCreated = [...records].sort((a, b) => b.createdAt - a.createdAt);

        sortedByCreated.forEach(r => {
            if (r.solicitudType === 'PA') {
                paCount++;
                if (!lastByRutPA[r.rut]) lastByRutPA[r.rut] = r;
            } else {
                flCount++;
                if (!lastByRutFL[r.rut]) lastByRutFL[r.rut] = r;
            }
            totalDays += r.cantidadDias;
            uniqueRuts.add(r.rut);

            if (!byEmployee[r.rut]) byEmployee[r.rut] = { nombre: r.funcionario, diasPA: 0, diasFL: 0, totalDias: 0 };
            if (r.solicitudType === 'PA') byEmployee[r.rut].diasPA += r.cantidadDias;
            else byEmployee[r.rut].diasFL += r.cantidadDias;
            byEmployee[r.rut].totalDias += r.cantidadDias;
        });

        // --- Top funcionarios con saldo (sin slice — se filtra después según topFilter) ---
        const allFuncionarios = Object.entries(byEmployee)
            .map(([rut, emp]) => {
                const lastPA = lastByRutPA[rut];
                const lastFL = lastByRutFL[rut];
                const saldoPA = lastPA ? (lastPA.diasHaber - lastPA.cantidadDias) : null;
                const saldoFL = lastFL
                    ? (lastFL.periodo2 && lastFL.periodo2.trim() !== '' ? (lastFL.saldoFinalP2 ?? null) : (lastFL.saldoFinalP1 ?? null))
                    : null;
                return { ...emp, rut, saldoPA, saldoFL };
            })
            .sort((a, b) => b.totalDias - a.totalDias);

        // --- Saldo bajo (<2 días) ---
        const lowBalance: Array<{ nombre: string; rut: string; saldo: number; tipo: string }> = [];
        Object.entries(lastByRutPA).forEach(([rut, r]) => {
            const saldo = r.diasHaber - r.cantidadDias;
            if (saldo < 2) {
                lowBalance.push({ nombre: r.funcionario, rut, saldo, tipo: 'PA' });
            }
        });
        Object.entries(lastByRutFL).forEach(([rut, r]) => {
            const tiene2 = r.periodo2 && r.periodo2.trim() !== '';
            const saldo = tiene2 ? (r.saldoFinalP2 || 0) : (r.saldoFinalP1 || 0);
            if (saldo < 2) {
                lowBalance.push({ nombre: r.funcionario, rut, saldo, tipo: 'FL' });
            }
        });
        lowBalance.sort((a, b) => a.saldo - b.saldo);

        // --- Distribución por tipo (para pie) ---
        const typeDistribution = [
            { name: 'Permisos Admin.', value: paCount, color: COLORS.PA },
            { name: 'Feriados Legales', value: flCount, color: COLORS.FL }
        ];

        // --- Comparativa PA vs FL por empleado (top 5, barras horizontales) ---
        const comparativaEmpleados = Object.values(byEmployee)
            .sort((a, b) => b.totalDias - a.totalDias)
            .slice(0, 5)
            .map(e => ({ nombre: e.nombre.split(' ')[0], PA: e.diasPA, FL: e.diasFL }));

        // --- Tendencia mes vs mes ---
        const thisMonthDays = thisMonthRecords.reduce((a, r) => a + r.cantidadDias, 0);
        const lastMonthDays = lastMonthRecords.reduce((a, r) => a + r.cantidadDias, 0);
        const monthTrend = lastMonthDays === 0 ? 0 : ((thisMonthDays - lastMonthDays) / lastMonthDays) * 100;

        // --- % uso saldo PA (promedio sobre empleados con registros PA) ---
        const paEmployees = Object.keys(lastByRutPA);
        let totalUsagePercent = 0;
        paEmployees.forEach(rut => {
            const last = lastByRutPA[rut];
            const base = CONFIG.BASE_DAYS.PA;
            const used = base - last.diasHaber;
            totalUsagePercent += base > 0 ? (used / base) * 100 : 0;
        });
        const avgUsagePercent = paEmployees.length > 0 ? totalUsagePercent / paEmployees.length : 0;

        return {
            monthlyData,
            typeDistribution,
            allFuncionarios,
            lowBalance,
            comparativaEmpleados,
            paCount,
            flCount,
            totalDays,
            activeEmployees: uniqueRuts.size,
            averageDaysPerRequest: records.length === 0 ? '0' : (totalDays / records.length).toFixed(1),
            thisMonthCount: thisMonthRecords.length,
            thisMonthDays,
            monthTrend,
            avgUsagePercent
        };
    }, [records, yearFilter]);

    const {
        monthlyData, typeDistribution, allFuncionarios,
        lowBalance, comparativaEmpleados,
        totalDays, activeEmployees, averageDaysPerRequest,
        thisMonthCount, thisMonthDays, monthTrend, avgUsagePercent
    } = stats;

    // Filtrado del Top según topFilter — se recalcula solo cuando cambia el filtro
    const { topFuncionarios, maxDias } = useMemo(() => {
        const filtered = allFuncionarios.filter(emp => {
            if (topFilter === 'PA') return emp.diasPA > 0;
            if (topFilter === 'FL') return emp.diasFL > 0;
            return true; // 'todos'
        }).sort((a, b) => {
            if (topFilter === 'PA') return b.diasPA - a.diasPA;
            if (topFilter === 'FL') return b.diasFL - a.diasFL;
            return b.totalDias - a.totalDias;
        }).slice(0, 6);

        const max = filtered.length > 0
            ? Math.max(...filtered.map(e => topFilter === 'PA' ? e.diasPA : topFilter === 'FL' ? e.diasFL : e.totalDias))
            : 1;

        return { topFuncionarios: filtered, maxDias: max };
    }, [allFuncionarios, topFilter]);

    // ---------------------------------------------------------------------------
    // Render
    // ---------------------------------------------------------------------------
    return (
        <div id="dashboard-content" className="space-y-6">

            {/* ─── Header ─── */}
            <div className="flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center text-white shadow-lg">
                        <TrendingUp className="w-5 h-5" />
                    </div>
                    <div>
                        <h2 className="text-lg font-black text-slate-900 dark:text-white">Panel de Analytics</h2>
                        <p className="text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                            Estadísticas y tendencias
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    {/* Filtro de año */}
                    <select
                        value={yearFilter}
                        onChange={e => setYearFilter(Number(e.target.value))}
                        className="bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-200 text-xs font-black px-3 py-2 rounded-xl outline-none focus:border-indigo-500 cursor-pointer"
                    >
                        {availableYears.map(y => (
                            <option key={y} value={y}>{y}</option>
                        ))}
                    </select>

                    {/* Exportar PDF */}
                    <button
                        onClick={handleExportPDF}
                        disabled={isExporting}
                        className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white rounded-xl text-xs font-black transition-colors shadow-lg"
                    >
                        {isExporting ? (
                            <><Loader2 size={16} className="animate-spin" /> Exportando...</>
                        ) : (
                            <><FileDown size={16} /> Exportar PDF</>
                        )}
                    </button>
                </div>
            </div>

            {/* ─── KPIs Row (6 cards, 3 cols en mobile, 6 en desktop) ─── */}
            <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
                <KpiCard
                    label="Solicitudes este mes"
                    value={thisMonthCount}
                    sub={`${thisMonthDays} días solicitados`}
                    icon={Calendar}
                    iconBg="bg-indigo-50 dark:bg-indigo-900/40"
                    iconColor="text-indigo-600 dark:text-indigo-400"
                    trend={{ value: monthTrend, label: `${monthTrend >= 0 ? '+' : ''}${monthTrend.toFixed(0)}% vs mes anterior` }}
                />
                <KpiCard
                    label="Funcionarios activos"
                    value={activeEmployees}
                    sub={`de ${employees.length} en base`}
                    icon={Users}
                    iconBg="bg-slate-100 dark:bg-slate-700/50"
                    iconColor="text-slate-600 dark:text-slate-300"
                />
                <KpiCard
                    label="Total días otorgados"
                    value={totalDays}
                    sub={`Promedio ${averageDaysPerRequest} días/solicitud`}
                    icon={Activity}
                    iconBg="bg-emerald-50 dark:bg-emerald-900/40"
                    iconColor="text-emerald-600 dark:text-emerald-400"
                />
                <KpiCard
                    label="Uso saldo PA"
                    value={`${avgUsagePercent.toFixed(0)}%`}
                    sub={`Base: ${CONFIG.BASE_DAYS.PA} días`}
                    icon={Clock}
                    iconBg="bg-purple-50 dark:bg-purple-900/40"
                    iconColor="text-purple-600 dark:text-purple-400"
                    trend={{ value: 100 - avgUsagePercent, label: `${(100 - avgUsagePercent).toFixed(0)}% libre` }}
                />
                <KpiCard
                    label="Permisos Admin."
                    value={stats.paCount}
                    sub="Total registros PA"
                    icon={Activity}
                    iconBg="bg-indigo-50 dark:bg-indigo-900/40"
                    iconColor="text-indigo-600 dark:text-indigo-400"
                />
                <KpiCard
                    label="Saldo bajo"
                    value={lowBalance.length}
                    sub="Menos de 2 días"
                    icon={AlertTriangle}
                    iconBg={lowBalance.length > 0 ? 'bg-amber-50 dark:bg-amber-900/40' : 'bg-slate-100 dark:bg-slate-700/50'}
                    iconColor={lowBalance.length > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-slate-500'}
                    borderColor={lowBalance.length > 0 ? 'border-amber-200 dark:border-amber-800' : 'border-slate-200 dark:border-slate-700'}
                    highlight={lowBalance.length > 0}
                    onClick={onViewLowBalance}
                />
            </div>

            {/* ─── Gráficos principales: Area (tendencia) + Pie (distribución) ─── */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                {/* Area chart — Tendencia mensual */}
                <div className="lg:col-span-2 bg-white dark:bg-slate-800 rounded-2xl p-6 border border-slate-200 dark:border-slate-700">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-sm font-black text-slate-700 dark:text-slate-200 uppercase tracking-wider">
                            Días otorgados por mes — {yearFilter}
                        </h3>
                        <div className="flex gap-3">
                            {[{ key: 'PA', label: 'Permisos', color: COLORS.PA }, { key: 'FL', label: 'Feriados', color: COLORS.FL }].map(t => (
                                <div key={t.key} className="flex items-center gap-1.5">
                                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: t.color }} />
                                    <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase">{t.label}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                    <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={monthlyData} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
                                <defs>
                                    <linearGradient id="gradPA" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor={COLORS.PA} stopOpacity={0.25} />
                                        <stop offset="95%" stopColor={COLORS.PA} stopOpacity={0} />
                                    </linearGradient>
                                    <linearGradient id="gradFL" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor={COLORS.FL} stopOpacity={0.25} />
                                        <stop offset="95%" stopColor={COLORS.FL} stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                                <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={{ stroke: '#e2e8f0' }} tickLine={false} />
                                <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                                <Tooltip content={<CustomTooltip />} />
                                <Area type="monotone" dataKey="PA" name="Permisos" stroke={COLORS.PA} strokeWidth={2.5} fill="url(#gradPA)" />
                                <Area type="monotone" dataKey="FL" name="Feriados" stroke={COLORS.FL} strokeWidth={2.5} fill="url(#gradFL)" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Pie — Distribución PA vs FL */}
                <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 border border-slate-200 dark:border-slate-700 flex flex-col">
                    <h3 className="text-sm font-black text-slate-700 dark:text-slate-200 mb-2 uppercase tracking-wider">
                        Distribución por tipo
                    </h3>
                    <div className="flex-1 flex flex-col items-center justify-center">
                        <div className="h-44 w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={typeDistribution}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={44}
                                        outerRadius={68}
                                        paddingAngle={4}
                                        dataKey="value"
                                        strokeWidth={0}
                                    >
                                        {typeDistribution.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={entry.color} />
                                        ))}
                                    </Pie>
                                    <Tooltip content={<CustomTooltip />} />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                        {/* Leyenda con porcentajes */}
                        <div className="flex gap-6 mt-1">
                            {typeDistribution.map((item, i) => {
                                const total = typeDistribution.reduce((s, d) => s + d.value, 0);
                                const pct = total > 0 ? ((item.value / total) * 100).toFixed(0) : '0';
                                return (
                                    <div key={i} className="flex items-center gap-2">
                                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                                        <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase">
                                            {item.name}
                                        </span>
                                        <span className="text-[10px] font-black text-slate-700 dark:text-slate-200">
                                            {item.value} ({pct}%)
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </div>

            {/* ─── Fila inferior: Top Funcionarios + Comparativa PA vs FL ─── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

                {/* Top Funcionarios con saldo y barra de progreso */}
                <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 border border-slate-200 dark:border-slate-700">
                    {/* Header + filtros */}
                    <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
                        <div className="flex items-center gap-3">
                            <Users className="w-5 h-5 text-indigo-500" />
                            <h3 className="text-sm font-black text-slate-700 dark:text-slate-200 uppercase tracking-wider">
                                Top funcionarios
                            </h3>
                        </div>
                        {/* Filtro PA / FL / Todos */}
                        <div className="flex bg-slate-100 dark:bg-slate-700 rounded-lg p-0.5 gap-0.5">
                            {(['todos', 'PA', 'FL'] as const).map(opt => {
                                const labels: Record<string, string> = { todos: 'PA + FL', PA: 'Solo PA', FL: 'Solo FL' };
                                const active = topFilter === opt;
                                const colors: Record<string, string> = {
                                    todos: active ? 'bg-white dark:bg-slate-600 text-slate-800 dark:text-white shadow-sm' : '',
                                    PA: active ? 'bg-indigo-600 text-white shadow-sm' : '',
                                    FL: active ? 'bg-amber-500 text-white shadow-sm' : ''
                                };
                                return (
                                    <button
                                        key={opt}
                                        type="button"
                                        onClick={() => setTopFilter(opt)}
                                        className={`px-3 py-1 rounded-md text-[10px] font-black transition-all ${colors[opt]} ${!active ? 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200' : ''}`}
                                    >
                                        {labels[opt]}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Header de la tabla mini — adaptativo según filtro */}
                    {topFilter === 'todos' ? (
                        <div className="grid grid-cols-[24px_1fr_60px_60px_60px] gap-x-3 items-center px-1 mb-2">
                            <span />
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Nombre</span>
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest text-center">PA</span>
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest text-center">FL</span>
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest text-center">Saldo</span>
                        </div>
                    ) : (
                        <div className="grid grid-cols-[24px_1fr_80px_80px] gap-x-3 items-center px-1 mb-2">
                            <span />
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Nombre</span>
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest text-center">Días</span>
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest text-center">Saldo</span>
                        </div>
                    )}

                    <div className="space-y-2.5">
                        {topFuncionarios.map((emp, i) => {
                            // Días y barra según filtro activo
                            const diasMostrar = topFilter === 'PA' ? emp.diasPA : topFilter === 'FL' ? emp.diasFL : emp.totalDias;
                            const barPercent = maxDias > 0 ? (diasMostrar / maxDias) * 100 : 0;
                            const barColor = topFilter === 'PA' ? COLORS.PA : topFilter === 'FL' ? COLORS.FL : `linear-gradient(90deg, ${COLORS.PA}, ${COLORS.FL})`;
                            const barStyle = topFilter === 'todos'
                                ? { background: barColor }
                                : { backgroundColor: barColor };

                            // Saldo según filtro
                            const saldoPA = emp.saldoPA !== null ? emp.saldoPA.toFixed(1) : '—';
                            const saldoFL = emp.saldoFL !== null ? emp.saldoFL.toFixed(1) : '—';
                            const saldoLabel = topFilter === 'PA' ? saldoPA
                                : topFilter === 'FL' ? saldoFL
                                : (emp.saldoPA !== null && emp.saldoFL !== null ? `${saldoPA} / ${saldoFL}` : emp.saldoPA !== null ? saldoPA : saldoFL);
                            const saldoNum = topFilter === 'PA' ? emp.saldoPA : topFilter === 'FL' ? emp.saldoFL : Math.min(emp.saldoPA ?? 999, emp.saldoFL ?? 999);
                            const saldoColor = saldoNum !== null && saldoNum < 2 ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400';

                            const rankColors = ['bg-amber-500', 'bg-slate-400', 'bg-amber-700', 'bg-slate-300', 'bg-slate-300', 'bg-slate-300'];

                            return (
                                <div key={emp.rut} className="group">
                                    {topFilter === 'todos' ? (
                                        <div className="grid grid-cols-[24px_1fr_60px_60px_60px] gap-x-3 items-center px-1">
                                            <div className={`w-6 h-6 ${rankColors[i]} rounded-md flex items-center justify-center text-white text-[9px] font-black`}>
                                                {i + 1}
                                            </div>
                                            <p className="text-sm font-bold text-slate-800 dark:text-white truncate">{emp.nombre}</p>
                                            <p className="text-sm font-black text-indigo-600 dark:text-indigo-400 text-center">{emp.diasPA}</p>
                                            <p className="text-sm font-black text-amber-600 dark:text-amber-400 text-center">{emp.diasFL}</p>
                                            <p className={`text-sm font-black text-center ${saldoColor}`}>{saldoLabel}</p>
                                        </div>
                                    ) : (
                                        <div className="grid grid-cols-[24px_1fr_80px_80px] gap-x-3 items-center px-1">
                                            <div className={`w-6 h-6 ${rankColors[i]} rounded-md flex items-center justify-center text-white text-[9px] font-black`}>
                                                {i + 1}
                                            </div>
                                            <p className="text-sm font-bold text-slate-800 dark:text-white truncate">{emp.nombre}</p>
                                            <p className={`text-sm font-black text-center ${topFilter === 'PA' ? 'text-indigo-600 dark:text-indigo-400' : 'text-amber-600 dark:text-amber-400'}`}>{diasMostrar}</p>
                                            <p className={`text-sm font-black text-center ${saldoColor}`}>{saldoLabel}</p>
                                        </div>
                                    )}
                                    {/* Barra de progreso */}
                                    <div className="mt-1.5 ml-7 h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                                        <div
                                            className="h-full rounded-full transition-all duration-500"
                                            style={{ width: `${barPercent}%`, ...barStyle }}
                                        />
                                    </div>
                                </div>
                            );
                        })}
                        {topFuncionarios.length === 0 && (
                            <p className="text-center text-sm text-slate-400 py-6">Sin datos disponibles para este filtro</p>
                        )}
                    </div>

                    {/* Nota del saldo */}
                    <p className="text-[9px] text-slate-400 dark:text-slate-500 mt-4 px-1">
                        Saldo: {topFilter === 'todos' ? 'PA / FL' : topFilter}. Valor amarillo = menos de 2 días disponibles.
                    </p>
                </div>

                {/* Comparativa PA vs FL por empleado — BarChart horizontal */}
                <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 border border-slate-200 dark:border-slate-700">
                    <div className="flex items-center gap-3 mb-4">
                        <Activity className="w-5 h-5 text-emerald-500" />
                        <h3 className="text-sm font-black text-slate-700 dark:text-slate-200 uppercase tracking-wider">
                            Comparativa PA vs FL
                        </h3>
                    </div>
                    <div className="h-56">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={comparativaEmpleados} layout="vertical" margin={{ top: 0, right: 10, left: 40, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
                                <XAxis type="number" tick={{ fontSize: 10, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                                <YAxis type="category" dataKey="nombre" tick={{ fontSize: 11, fill: '#64748b', fontWeight: 700 }} axisLine={false} tickLine={false} width={38} />
                                <Tooltip content={<CustomTooltip />} />
                                <Bar dataKey="PA" name="Permisos" fill={COLORS.PA} radius={[0, 4, 4, 0]} barSize={10} />
                                <Bar dataKey="FL" name="Feriados" fill={COLORS.FL} radius={[0, 4, 4, 0]} barSize={10} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                    <div className="flex justify-center gap-6 mt-2">
                        <div className="flex items-center gap-1.5">
                            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS.PA }} />
                            <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase">PA</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS.FL }} />
                            <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase">FL</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Dashboard;
