
import React, { useMemo } from 'react';
import { PermitRecord } from '../types';
import { Landmark, Sun, Users, Activity } from 'lucide-react';

interface StatsCardsProps {
  records: PermitRecord[];
  totalDatabaseEmployees: number;
}

const StatsCards: React.FC<StatsCardsProps> = React.memo(({ records, totalDatabaseEmployees }) => {
  const stats = useMemo(() => {
    const paRecords = records.filter(r => r.solicitudType === 'PA');
    const flRecords = records.filter(r => r.solicitudType === 'FL');
    const totalPADays = paRecords.reduce((acc, curr) => acc + curr.cantidadDias, 0);
    const totalFLDays = flRecords.reduce((acc, curr) => acc + curr.cantidadDias, 0);
    const employeesWithRecords = new Set(records.map(r => r.rut)).size;

    return [
    {
      label: 'Decretos PA',
      value: paRecords.length,
      icon: Landmark,
      color: 'text-indigo-700 dark:text-indigo-400',
      bg: 'bg-indigo-50 dark:bg-indigo-900/40',
      sub: `${totalPADays} días`,
      borderColor: 'border-indigo-100 dark:border-indigo-800/50'
    },
    {
      label: 'Feriados FL',
      value: flRecords.length,
      icon: Sun,
      color: 'text-amber-700 dark:text-amber-400',
      bg: 'bg-amber-50 dark:bg-amber-900/40',
      sub: `${totalFLDays} días`,
      borderColor: 'border-amber-100 dark:border-amber-800/50'
    },
    {
      label: 'Base Personal',
      value: totalDatabaseEmployees,
      icon: Users,
      color: 'text-slate-700 dark:text-slate-300',
      bg: 'bg-slate-100 dark:bg-slate-700/50',
      sub: `${employeesWithRecords} con movimientos`,
      borderColor: 'border-slate-200 dark:border-slate-600/50'
    },
    {
      label: 'Total Actos',
      value: records.length,
      icon: Activity,
      color: 'text-emerald-700 dark:text-emerald-400',
      bg: 'bg-emerald-50 dark:bg-emerald-900/40',
      sub: 'PA + FL',
      borderColor: 'border-emerald-100 dark:border-emerald-800/50'
    },
  ];
  }, [records, totalDatabaseEmployees]);

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
      {stats.map((stat, i) => (
        <div
          key={i}
          className={`bg-white dark:bg-slate-800 p-4 sm:p-5 rounded-2xl border ${stat.borderColor} shadow-sm flex items-center gap-3 sm:gap-4 transition-all hover:shadow-md group`}
        >
          <div className={`${stat.bg} ${stat.color} p-2.5 sm:p-3 rounded-xl group-hover:scale-110 transition-transform`}>
            <stat.icon className="w-5 h-5 sm:w-6 sm:h-6" />
          </div>
          <div className="min-w-0">
            <p className="text-slate-400 dark:text-slate-500 text-[10px] sm:text-[11px] font-black uppercase tracking-wider truncate">
              {stat.label}
            </p>
            <p className="text-xl sm:text-2xl font-black text-slate-800 dark:text-white leading-tight">
              {stat.value}
            </p>
            <p className="text-[10px] sm:text-[11px] text-slate-400 dark:text-slate-500 font-bold uppercase truncate">
              {stat.sub}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
});

StatsCards.displayName = 'StatsCards';

export default StatsCards;
