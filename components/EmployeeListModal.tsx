
import React, { useState, useMemo } from 'react';
import { Employee, PermitRecord } from '../types';
import {
  X, Search, Users, UserCircle, TrendingUp, TrendingDown,
  Calendar, FileText, Plus, Trash2, ChevronDown, ChevronUp,
  ArrowUpDown, Filter, Download, AlertTriangle, CheckCircle,
  Clock, Award, Edit3, Eye, XCircle
} from 'lucide-react';
import { formatNumericDate } from '../utils/formatters';
import { useFocusTrap } from '../hooks/useFocusTrap';
import * as XLSX from 'xlsx';

interface EmployeeListModalProps {
  isOpen: boolean;
  onClose: () => void;
  employees: Employee[];
  records: PermitRecord[];
  onAddEmployee: (employee: Employee) => void;
  onDeleteEmployee: (rut: string) => void;
  onFilterByEmployee?: (funcionario: string) => void;
  onQuickDecree?: (employee: Employee) => void;
}

type SortField = 'nombre' | 'totalDecrees' | 'diasPA' | 'diasFL' | 'saldo';
type SortOrder = 'asc' | 'desc';
type BalanceFilter = 'all' | 'high' | 'medium' | 'low';

interface EmployeeStats {
  totalDecrees: number;
  diasPA: number;
  diasFL: number;
  diasHaber: number;
  saldo: number;
  lastDecree: PermitRecord | null;
  decrees: PermitRecord[];
}

const EmployeeListModal: React.FC<EmployeeListModalProps> = ({
  isOpen,
  onClose,
  employees,
  records,
  onAddEmployee,
  onDeleteEmployee,
  onFilterByEmployee,
  onQuickDecree
}) => {
  const [search, setSearch] = useState('');
  const [sortField, setSortField] = useState<SortField>('nombre');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');
  const [balanceFilter, setBalanceFilter] = useState<BalanceFilter>('all');
  const [expandedEmployee, setExpandedEmployee] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newEmployee, setNewEmployee] = useState({ nombre: '', rut: '' });
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  // Calcular estadísticas por funcionario (ANTES del return condicional para cumplir reglas de hooks)
  const employeeStats = useMemo(() => {
    const stats: Record<string, EmployeeStats> = {};

    employees.forEach(emp => {
      const empRecords = records.filter(r =>
        r.rut === emp.rut || r.funcionario.toLowerCase() === emp.nombre.toLowerCase()
      );

      const diasPA = empRecords
        .filter(r => r.solicitudType === 'PA')
        .reduce((sum, r) => sum + r.cantidadDias, 0);

      const diasFL = empRecords
        .filter(r => r.solicitudType === 'FL')
        .reduce((sum, r) => sum + r.cantidadDias, 0);

      const diasHaber = empRecords.length > 0
        ? empRecords[0].diasHaber
        : 6;

      const sortedDecrees = [...empRecords].sort((a, b) => b.createdAt - a.createdAt);

      stats[emp.rut] = {
        totalDecrees: empRecords.length,
        diasPA,
        diasFL,
        diasHaber,
        saldo: diasHaber - diasPA,
        lastDecree: sortedDecrees[0] || null,
        decrees: sortedDecrees
      };
    });

    return stats;
  }, [employees, records]);

  // Totalizadores globales
  const globalStats = useMemo(() => {
    const totalDecrees = records.length;
    const totalDiasPA = records.filter(r => r.solicitudType === 'PA').reduce((s, r) => s + r.cantidadDias, 0);
    const totalDiasFL = records.filter(r => r.solicitudType === 'FL').reduce((s, r) => s + r.cantidadDias, 0);
    const avgPerEmployee = employees.length > 0 ? (totalDecrees / employees.length).toFixed(1) : '0';
    const lowBalanceCount = Object.values(employeeStats).filter((s: EmployeeStats) => s.saldo < 2).length;

    return { totalDecrees, totalDiasPA, totalDiasFL, avgPerEmployee, lowBalanceCount };
  }, [records, employees, employeeStats]);

  // Filtrar y ordenar
  const filteredEmployees = useMemo(() => {
    return employees
      .filter(e => {
        const matchesSearch =
          e.nombre.toLowerCase().includes(search.toLowerCase()) ||
          e.rut.includes(search);

        if (!matchesSearch) return false;

        const stats = employeeStats[e.rut];
        if (!stats) return true;

        if (balanceFilter === 'high') return stats.saldo >= 4;
        if (balanceFilter === 'medium') return stats.saldo >= 2 && stats.saldo < 4;
        if (balanceFilter === 'low') return stats.saldo < 2;

        return true;
      })
      .sort((a, b) => {
        const statsA = employeeStats[a.rut] || { totalDecrees: 0, diasPA: 0, diasFL: 0, saldo: 6 };
        const statsB = employeeStats[b.rut] || { totalDecrees: 0, diasPA: 0, diasFL: 0, saldo: 6 };

        let valA: string | number;
        let valB: string | number;

        switch (sortField) {
          case 'nombre': valA = a.nombre.toLowerCase(); valB = b.nombre.toLowerCase(); break;
          case 'totalDecrees': valA = statsA.totalDecrees; valB = statsB.totalDecrees; break;
          case 'diasPA': valA = statsA.diasPA; valB = statsB.diasPA; break;
          case 'diasFL': valA = statsA.diasFL; valB = statsB.diasFL; break;
          case 'saldo': valA = statsA.saldo; valB = statsB.saldo; break;
          default: valA = a.nombre; valB = b.nombre;
        }

        if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
        if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
        return 0;
      });
  }, [employees, search, sortField, sortOrder, balanceFilter, employeeStats]);

  // Focus trap para accesibilidad
  const { containerRef, handleKeyDown } = useFocusTrap({
    isActive: isOpen,
    onEscape: onClose,
    initialFocus: '[data-autofocus]',
  });

  // Return condicional DESPUÉS de todos los hooks
  if (!isOpen) return null;

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  const getSaldoColor = (saldo: number) => {
    if (saldo >= 4) return 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30';
    if (saldo >= 2) return 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/30';
    return 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/30';
  };

  const getSaldoIcon = (saldo: number) => {
    if (saldo >= 4) return <TrendingUp size={12} />;
    if (saldo >= 2) return <TrendingDown size={12} />;
    return <AlertTriangle size={12} />;
  };

  const handleAddEmployee = () => {
    if (!newEmployee.nombre.trim() || !newEmployee.rut.trim()) return;

    // Validar RUT duplicado
    if (employees.some(e => e.rut === newEmployee.rut)) {
      alert('Ya existe un funcionario con este RUT');
      return;
    }

    onAddEmployee({
      nombre: newEmployee.nombre.trim().toUpperCase(),
      rut: newEmployee.rut.trim()
    });
    setNewEmployee({ nombre: '', rut: '' });
    setShowAddForm(false);
  };

  const handleDeleteEmployee = (rut: string) => {
    onDeleteEmployee(rut);
    setDeleteConfirm(null);
  };

  const exportEmployeesToExcel = () => {
    const data = filteredEmployees.map(emp => {
      const stats = employeeStats[emp.rut] || { totalDecrees: 0, diasPA: 0, diasFL: 0, saldo: 6, lastDecree: null };
      return {
        'Nombre': emp.nombre,
        'RUT': emp.rut,
        'Total Decretos': stats.totalDecrees,
        'Días PA': stats.diasPA,
        'Días FL': stats.diasFL,
        'Saldo': stats.saldo,
        'Último Decreto': stats.lastDecree ? stats.lastDecree.acto : '-'
      };
    });

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Funcionarios');
    XLSX.writeFile(wb, `funcionarios_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  return (
    <div
      className="fixed inset-0 z-[150] flex items-center justify-center p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="employee-modal-title"
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" />

      {/* Modal */}
      <div
        ref={containerRef}
        onKeyDown={handleKeyDown}
        className="relative w-full max-w-4xl max-h-[90vh] bg-white dark:bg-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header con Stats Globales */}
        <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-900 dark:from-slate-950 dark:via-slate-900 dark:to-indigo-950 p-6 sm:p-8 text-white relative overflow-hidden flex-shrink-0">
          <div className="absolute top-0 right-0 p-4 opacity-5 scale-150 pointer-events-none">
            <Users size={120} />
          </div>

          <div className="flex items-center justify-between z-10 relative mb-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-white/20 rounded-2xl backdrop-blur-md shadow-lg">
                <Users className="w-6 h-6" />
              </div>
              <div>
                <h2 id="employee-modal-title" className="text-lg sm:text-xl font-extrabold uppercase tracking-tight">
                  Gestión de Personal
                </h2>
                <p className="text-[10px] sm:text-[11px] font-bold uppercase opacity-60 tracking-[0.15em] sm:tracking-[0.2em] mt-1">
                  {employees.length} funcionarios registrados
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowAddForm(true)}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-500 hover:bg-emerald-600 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all shadow-lg"
              >
                <Plus size={14} />
                <span className="hidden sm:inline">Añadir</span>
              </button>
              <button
                onClick={onClose}
                className="p-2.5 hover:bg-white/20 rounded-xl transition-all border border-white/20"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-3 border border-white/10">
              <div className="flex items-center gap-2 text-white/60 mb-1">
                <FileText size={12} />
                <span className="text-[9px] font-bold uppercase tracking-wider">Decretos</span>
              </div>
              <p className="text-lg sm:text-xl font-black">{globalStats.totalDecrees}</p>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-3 border border-white/10">
              <div className="flex items-center gap-2 text-white/60 mb-1">
                <Calendar size={12} />
                <span className="text-[9px] font-bold uppercase tracking-wider">Días PA</span>
              </div>
              <p className="text-lg sm:text-xl font-black text-indigo-300">{globalStats.totalDiasPA}</p>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-3 border border-white/10">
              <div className="flex items-center gap-2 text-white/60 mb-1">
                <Award size={12} />
                <span className="text-[9px] font-bold uppercase tracking-wider">Días FL</span>
              </div>
              <p className="text-lg sm:text-xl font-black text-amber-300">{globalStats.totalDiasFL}</p>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-3 border border-white/10">
              <div className="flex items-center gap-2 text-white/60 mb-1">
                <TrendingUp size={12} />
                <span className="text-[9px] font-bold uppercase tracking-wider">Promedio</span>
              </div>
              <p className="text-lg sm:text-xl font-black">{globalStats.avgPerEmployee}</p>
            </div>
            <div className="bg-red-500/20 backdrop-blur-sm rounded-xl p-3 border border-red-400/30 col-span-2 sm:col-span-1">
              <div className="flex items-center gap-2 text-red-300 mb-1">
                <AlertTriangle size={12} />
                <span className="text-[9px] font-bold uppercase tracking-wider">Saldo Bajo</span>
              </div>
              <p className="text-lg sm:text-xl font-black text-red-300">{globalStats.lowBalanceCount}</p>
            </div>
          </div>
        </div>

        {/* Toolbar: Search + Filters */}
        <div className="p-4 sm:p-6 border-b border-slate-100 dark:border-slate-700 flex-shrink-0 space-y-4">
          <div className="flex flex-col sm:flex-row gap-3">
            {/* Search */}
            <div className="relative flex-1">
              <div className="absolute left-4 top-1/2 -translate-y-1/2 p-1.5 bg-indigo-50 dark:bg-indigo-900/50 rounded-lg text-indigo-600 dark:text-indigo-400">
                <Search size={16} />
              </div>
              <input
                placeholder="Buscar por nombre o RUT..."
                className="w-full pl-12 pr-4 py-3.5 bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-2xl outline-none focus:ring-4 focus:ring-indigo-50 dark:focus:ring-indigo-900/50 focus:border-indigo-200 dark:focus:border-indigo-600 transition-all font-bold text-xs uppercase tracking-wider text-slate-700 dark:text-slate-200 placeholder:text-slate-300 dark:placeholder:text-slate-500"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                autoFocus
              />
            </div>

            {/* Filter by Saldo */}
            <div className="flex items-center gap-2">
              <div className="flex bg-slate-100 dark:bg-slate-700 rounded-xl p-1 gap-1">
                {[
                  { key: 'all', label: 'Todos', color: '' },
                  { key: 'high', label: 'Alto', color: 'text-emerald-600' },
                  { key: 'medium', label: 'Medio', color: 'text-amber-600' },
                  { key: 'low', label: 'Bajo', color: 'text-red-600' },
                ].map(f => (
                  <button
                    key={f.key}
                    onClick={() => setBalanceFilter(f.key as BalanceFilter)}
                    className={`px-3 py-2 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${balanceFilter === f.key
                      ? 'bg-white dark:bg-slate-600 shadow-sm ' + f.color
                      : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
                      }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>

              <button
                onClick={exportEmployeesToExcel}
                className="p-3 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-xl hover:bg-emerald-100 dark:hover:bg-emerald-900/50 transition-all"
                title="Exportar a Excel"
              >
                <Download size={16} />
              </button>
            </div>
          </div>

          {/* Sort Buttons */}
          <div className="flex flex-wrap gap-2">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider self-center mr-2">Ordenar:</span>
            {[
              { field: 'nombre', label: 'Nombre' },
              { field: 'totalDecrees', label: 'Decretos' },
              { field: 'diasPA', label: 'Días PA' },
              { field: 'diasFL', label: 'Días FL' },
              { field: 'saldo', label: 'Saldo' },
            ].map(s => (
              <button
                key={s.field}
                onClick={() => handleSort(s.field as SortField)}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all ${sortField === s.field
                  ? 'bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400'
                  : 'bg-slate-100 dark:bg-slate-700 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                  }`}
              >
                {s.label}
                {sortField === s.field && (
                  sortOrder === 'asc' ? <ChevronUp size={12} /> : <ChevronDown size={12} />
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Add Employee Form */}
        {showAddForm && (
          <div className="p-4 sm:p-6 bg-emerald-50 dark:bg-emerald-900/20 border-b border-emerald-100 dark:border-emerald-800 flex-shrink-0">
            <div className="flex items-center gap-2 mb-4">
              <Plus size={16} className="text-emerald-600" />
              <span className="text-xs font-black text-emerald-700 dark:text-emerald-400 uppercase tracking-wider">
                Nuevo Funcionario
              </span>
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <input
                placeholder="Nombre completo"
                value={newEmployee.nombre}
                onChange={e => setNewEmployee({ ...newEmployee, nombre: e.target.value })}
                className="flex-1 px-4 py-3 bg-white dark:bg-slate-700 border border-emerald-200 dark:border-emerald-700 rounded-xl outline-none focus:ring-2 focus:ring-emerald-200 dark:focus:ring-emerald-800 text-xs font-bold uppercase tracking-wide text-slate-700 dark:text-slate-200 placeholder:text-slate-300 dark:placeholder:text-slate-500"
              />
              <input
                placeholder="RUT (ej: 12.345.678-9)"
                value={newEmployee.rut}
                onChange={e => setNewEmployee({ ...newEmployee, rut: e.target.value })}
                className="flex-1 sm:max-w-[200px] px-4 py-3 bg-white dark:bg-slate-700 border border-emerald-200 dark:border-emerald-700 rounded-xl outline-none focus:ring-2 focus:ring-emerald-200 dark:focus:ring-emerald-800 text-xs font-bold tracking-wide text-slate-700 dark:text-slate-200 placeholder:text-slate-300 dark:placeholder:text-slate-500 font-mono"
              />
              <div className="flex gap-2">
                <button
                  onClick={handleAddEmployee}
                  className="flex-1 sm:flex-none px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-[11px] font-black uppercase tracking-wider transition-all shadow-lg"
                >
                  <CheckCircle size={14} className="inline mr-2" />
                  Guardar
                </button>
                <button
                  onClick={() => { setShowAddForm(false); setNewEmployee({ nombre: '', rut: '' }); }}
                  className="px-4 py-3 bg-slate-200 dark:bg-slate-600 text-slate-600 dark:text-slate-300 rounded-xl text-[11px] font-black uppercase tracking-wider transition-all"
                >
                  <XCircle size={14} />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* List */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-4 sm:p-6">
          <div className="grid gap-2">
            {filteredEmployees.map((emp, index) => {
              const stats = employeeStats[emp.rut] || {
                totalDecrees: 0, diasPA: 0, diasFL: 0, saldo: 6, diasHaber: 6, lastDecree: null, decrees: []
              };
              const isExpanded = expandedEmployee === emp.rut;

              return (
                <div key={emp.rut} className="group">
                  {/* Main Row */}
                  <div
                    className={`flex items-center gap-3 sm:gap-4 p-3 sm:p-4 rounded-xl sm:rounded-2xl transition-all cursor-pointer ${isExpanded
                      ? 'bg-indigo-50 dark:bg-indigo-900/30 ring-2 ring-indigo-200 dark:ring-indigo-700'
                      : 'bg-slate-50 dark:bg-slate-700/50 hover:bg-indigo-50 dark:hover:bg-indigo-900/20'
                      }`}
                    onClick={() => setExpandedEmployee(isExpanded ? null : emp.rut)}
                  >
                    {/* Avatar */}
                    <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center shadow-sm transition-all ${isExpanded
                      ? 'bg-indigo-600 text-white'
                      : 'bg-white dark:bg-slate-600 text-slate-300 dark:text-slate-400 group-hover:bg-indigo-100 dark:group-hover:bg-indigo-900/50 group-hover:text-indigo-500'
                      }`}>
                      <UserCircle size={24} />
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <p className={`text-xs sm:text-sm font-black uppercase tracking-tight truncate transition-colors ${isExpanded ? 'text-indigo-700 dark:text-indigo-300' : 'text-slate-800 dark:text-white group-hover:text-indigo-700 dark:group-hover:text-indigo-300'
                        }`}>
                        {emp.nombre}
                      </p>
                      <p className="text-[10px] sm:text-[11px] font-bold text-slate-400 dark:text-slate-500 font-mono tracking-tighter">
                        RUT: {emp.rut}
                      </p>
                    </div>

                    {/* Stats Pills */}
                    <div className="hidden md:flex items-center gap-2">
                      <span className="px-2 py-1 bg-slate-100 dark:bg-slate-600 rounded-lg text-[10px] font-black text-slate-500 dark:text-slate-300">
                        <FileText size={10} className="inline mr-1" />
                        {stats.totalDecrees}
                      </span>
                      <span className="px-2 py-1 bg-indigo-50 dark:bg-indigo-900/40 rounded-lg text-[10px] font-black text-indigo-600 dark:text-indigo-400">
                        PA: {stats.diasPA}
                      </span>
                      <span className="px-2 py-1 bg-amber-50 dark:bg-amber-900/40 rounded-lg text-[10px] font-black text-amber-600 dark:text-amber-400">
                        FL: {stats.diasFL}
                      </span>
                    </div>

                    {/* Saldo Badge */}
                    <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-black ${getSaldoColor(stats.saldo)}`}>
                      {getSaldoIcon(stats.saldo)}
                      <span>{stats.saldo.toFixed(1)}</span>
                    </div>

                    {/* Number */}
                    <div className="text-[9px] sm:text-[10px] font-black text-slate-300 dark:text-slate-600 uppercase tracking-widest">
                      #{(index + 1).toString().padStart(2, '0')}
                    </div>

                    {/* Expand Icon */}
                    <div className="text-slate-400">
                      {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </div>
                  </div>

                  {/* Expanded Details */}
                  {isExpanded && (
                    <div className="mt-2 ml-4 sm:ml-16 p-4 bg-white dark:bg-slate-700 rounded-xl border border-slate-200 dark:border-slate-600 space-y-4 animate-in slide-in-from-top-2 duration-200">
                      {/* Quick Stats */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <div className="bg-slate-50 dark:bg-slate-600 rounded-lg p-3">
                          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">Total Decretos</p>
                          <p className="text-lg font-black text-slate-700 dark:text-white">{stats.totalDecrees}</p>
                        </div>
                        <div className="bg-indigo-50 dark:bg-indigo-900/30 rounded-lg p-3">
                          <p className="text-[9px] font-bold text-indigo-400 uppercase tracking-wider mb-1">Días PA Usados</p>
                          <p className="text-lg font-black text-indigo-600 dark:text-indigo-400">{stats.diasPA}</p>
                        </div>
                        <div className="bg-amber-50 dark:bg-amber-900/30 rounded-lg p-3">
                          <p className="text-[9px] font-bold text-amber-400 uppercase tracking-wider mb-1">Días FL Usados</p>
                          <p className="text-lg font-black text-amber-600 dark:text-amber-400">{stats.diasFL}</p>
                        </div>
                        <div className={`rounded-lg p-3 ${getSaldoColor(stats.saldo)}`}>
                          <p className="text-[9px] font-bold opacity-70 uppercase tracking-wider mb-1">Saldo Disponible</p>
                          <p className="text-lg font-black">{stats.saldo.toFixed(1)} / {stats.diasHaber}</p>
                        </div>
                      </div>

                      {/* Last Decree */}
                      {stats.lastDecree && (
                        <div className="bg-slate-50 dark:bg-slate-600 rounded-lg p-3">
                          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1">
                            <Clock size={10} /> Último Decreto
                          </p>
                          <div className="flex items-center justify-between">
                            <div>
                              <span className="text-sm font-black text-indigo-600 dark:text-indigo-400">{stats.lastDecree.acto}</span>
                              <span className="ml-2 text-[10px] text-slate-500 dark:text-slate-400">
                                {stats.lastDecree.solicitudType} · {stats.lastDecree.cantidadDias} día(s)
                              </span>
                            </div>
                            <span className="text-[10px] font-bold text-slate-400">
                              {formatNumericDate(stats.lastDecree.fechaInicio)}
                            </span>
                          </div>
                        </div>
                      )}

                      {/* Recent Decrees List */}
                      {stats.decrees.length > 1 && (
                        <div>
                          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                            Historial Reciente ({Math.min(stats.decrees.length, 5)} de {stats.decrees.length})
                          </p>
                          <div className="space-y-1 max-h-32 overflow-y-auto custom-scrollbar">
                            {stats.decrees.slice(0, 5).map(d => (
                              <div key={d.id} className="flex items-center justify-between py-1.5 px-2 bg-slate-50 dark:bg-slate-600/50 rounded-lg text-[10px]">
                                <div className="flex items-center gap-2">
                                  <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${d.solicitudType === 'PA'
                                    ? 'bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400'
                                    : 'bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400'
                                    }`}>
                                    {d.solicitudType}
                                  </span>
                                  <span className="font-bold text-slate-700 dark:text-slate-200">{d.acto}</span>
                                </div>
                                <div className="flex items-center gap-3 text-slate-400">
                                  <span>{d.cantidadDias}d</span>
                                  <span>{formatNumericDate(d.fechaInicio)}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Actions */}
                      <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-100 dark:border-slate-600">
                        {onQuickDecree && (
                          <button
                            onClick={(e) => { e.stopPropagation(); onQuickDecree(emp); onClose(); }}
                            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-[10px] font-black uppercase tracking-wider transition-all"
                          >
                            <Plus size={12} /> Nuevo Decreto
                          </button>
                        )}
                        {onFilterByEmployee && (
                          <button
                            onClick={(e) => { e.stopPropagation(); onFilterByEmployee(emp.nombre); onClose(); }}
                            className="flex items-center gap-2 px-4 py-2 bg-slate-100 dark:bg-slate-600 hover:bg-slate-200 dark:hover:bg-slate-500 text-slate-700 dark:text-slate-200 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all"
                          >
                            <Eye size={12} /> Ver Decretos
                          </button>
                        )}
                        <button
                          onClick={(e) => { e.stopPropagation(); setDeleteConfirm(emp.rut); }}
                          className="flex items-center gap-2 px-4 py-2 bg-red-50 dark:bg-red-900/30 hover:bg-red-100 dark:hover:bg-red-900/50 text-red-600 dark:text-red-400 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all ml-auto"
                        >
                          <Trash2 size={12} /> Eliminar
                        </button>
                      </div>

                      {/* Delete Confirmation */}
                      {deleteConfirm === emp.rut && (
                        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 animate-in fade-in duration-200">
                          <p className="text-xs font-bold text-red-700 dark:text-red-400 mb-3">
                            ¿Eliminar a {emp.nombre}? Esta acción no se puede deshacer.
                          </p>
                          <div className="flex gap-2">
                            <button
                              onClick={(e) => { e.stopPropagation(); handleDeleteEmployee(emp.rut); }}
                              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-[10px] font-black uppercase tracking-wider"
                            >
                              Sí, eliminar
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); setDeleteConfirm(null); }}
                              className="px-4 py-2 bg-slate-200 dark:bg-slate-600 text-slate-600 dark:text-slate-300 rounded-lg text-[10px] font-black uppercase tracking-wider"
                            >
                              Cancelar
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}

            {filteredEmployees.length === 0 && (
              <div className="py-12 sm:py-16 text-center">
                <Users className="w-12 h-12 text-slate-200 dark:text-slate-700 mx-auto mb-4" />
                <p className="text-[11px] sm:text-xs font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">
                  {search ? `Sin resultados para "${search}"` : 'No hay funcionarios registrados'}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 sm:p-6 border-t border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 flex-shrink-0">
          <div className="flex items-center justify-between">
            <p className="text-[9px] sm:text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">
              Mostrando {filteredEmployees.length} de {employees.length} funcionarios
            </p>
            <p className="text-[9px] sm:text-[10px] font-bold text-slate-300 dark:text-slate-600 uppercase tracking-widest">
              Clic para expandir detalles
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default EmployeeListModal;
