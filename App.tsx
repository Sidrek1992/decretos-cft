
import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import PermitForm from './components/PermitForm';
import PermitTable from './components/PermitTable';
import StatsCards from './components/StatsCards';
import EmployeeListModal from './components/EmployeeListModal';
import ErrorBoundary from './components/ErrorBoundary';
import Dashboard from './components/Dashboard';
import LowBalanceModal from './components/LowBalanceModal';
import DecreeBookModal from './components/DecreeBookModal';
import CalendarView from './components/CalendarView';
import ThemeSelector from './components/ThemeSelector';
import NotificationCenter from './components/NotificationCenter';
import ConfirmModal from './components/ConfirmModal';
import { ToastContainer, useToast } from './components/Toast';
import { useKeyboardShortcuts, ShortcutsHelpModal } from './hooks/useKeyboardShortcuts';
import { ThemeProvider } from './hooks/useTheme';
import { useModals } from './hooks/useModals';
import { PermitRecord, PermitFormData, SolicitudType, Employee } from './types';
import { exportToExcel } from './services/excelExport';
import { useCloudSync } from './hooks/useCloudSync';
import { useEmployeeSync } from './hooks/useEmployeeSync';
import { useDarkMode } from './hooks/useDarkMode';
import { calculateNextCorrelatives } from './utils/formatters';
import { CONFIG } from './config';
import {
  Cloud, FileSpreadsheet, ExternalLink, RefreshCw, LayoutDashboard, BookOpen, BarChart3,
  Database, CheckCircle, Users, AlertCircle, Moon, Sun, Undo2, Keyboard, CalendarDays, Palette, Printer
} from 'lucide-react';

const AppContent: React.FC = () => {
  // Employees sincronizados con Google Sheets
  const {
    employees,
    isSyncing: isEmployeeSyncing,
    addEmployee: handleAddEmployee,
    deleteEmployee: handleDeleteEmployee,
    fetchEmployeesFromCloud
  } = useEmployeeSync(
    () => { }, // onSuccess silencioso para empleados
    (error) => console.warn('Error empleados:', error)
  );

  const [editingRecord, setEditingRecord] = useState<PermitRecord | null>(null);
  const [activeTab, setActiveTab] = useState<SolicitudType | 'ALL'>('ALL');
  const [showDashboard, setShowDashboard] = useState(false);
  const [searchFilter, setSearchFilter] = useState('');
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);

  // Hook centralizado para modales
  const { modals, openModal, closeModal } = useModals();

  const formRef = useRef<HTMLElement>(null);

  const { isDark, toggle: toggleDarkMode } = useDarkMode();
  const { toasts, toast, removeToast } = useToast();

  const {
    records,
    setRecords,
    isSyncing,
    syncError,
    lastSync,
    isOnline,
    syncWarnings,
    pendingSync,
    isRetryScheduled,
    fetchFromCloud,
    syncToCloud,
    undo,
    canUndo
  } = useCloudSync(
    () => toast.success('Sincronizado', 'Datos actualizados correctamente'),
    (error) => toast.error('Error de sincronización', error)
  );

  const lastWarningsRef = useRef('');

  useEffect(() => {
    if (syncWarnings.length === 0) return;
    const key = syncWarnings.join('|');
    if (key === lastWarningsRef.current) return;
    lastWarningsRef.current = key;
    const preview = syncWarnings.slice(0, 3).join(' · ');
    const extra = syncWarnings.length > 3 ? ` (+${syncWarnings.length - 3} más)` : '';
    toast.warning('Datos con formato inesperado', `${preview}${extra}`);
  }, [syncWarnings, toast]);

  // Correlativos independientes para PA y FL
  const nextCorrelatives = useMemo(() => {
    const year = new Date().getFullYear();
    return calculateNextCorrelatives(records, year);
  }, [records]);

  const handleSubmit = (formData: PermitFormData) => {
    let updated: PermitRecord[];
    if (editingRecord) {
      updated = records.map(r =>
        r.id === editingRecord.id ? { ...formData, id: r.id, createdAt: r.createdAt } : r
      );
      setEditingRecord(null);
      toast.success('Decreto actualizado', `${formData.acto} modificado correctamente`);
    } else {
      updated = [...records, { ...formData, id: crypto.randomUUID(), createdAt: Date.now() }];
      toast.success('Decreto emitido', `Resolución ${formData.acto} creada exitosamente`);
    }
    setRecords(updated);
    syncToCloud(updated);
  };

  const handleDelete = (id: string) => {
    setDeleteTargetId(id);
    openModal('confirmDelete');
  };

  const confirmDelete = useCallback(() => {
    if (deleteTargetId) {
      const updated = records.filter(r => r.id !== deleteTargetId);
      setRecords(updated);
      syncToCloud(updated);
      toast.warning('Decreto eliminado', 'Puedes deshacer esta acción');
      setDeleteTargetId(null);
    }
  }, [deleteTargetId, records, setRecords, syncToCloud, toast]);

  const handleUndo = () => {
    undo();
    toast.info('Acción deshecha', 'Se restauró el estado anterior');
  };

  const handleFilterByEmployee = (funcionario: string) => {
    setSearchFilter(funcionario);
    // Scroll to table
    setTimeout(() => {
      document.querySelector('section.space-y-6')?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  const handleQuickDecree = (employee: Employee) => {
    // Preparar el formulario con el empleado seleccionado
    formRef.current?.scrollIntoView({ behavior: 'smooth' });
    toast.info('Nuevo decreto', `Preparando decreto para ${employee.nombre}`);
  };

  // Atajos de teclado (memoizados para evitar re-renders)
  const shortcuts = useMemo(() => [
    { key: 'n', ctrlKey: true, action: () => formRef.current?.scrollIntoView({ behavior: 'smooth' }), description: 'Nuevo decreto' },
    { key: 's', ctrlKey: true, action: () => fetchFromCloud(), description: 'Sincronizar' },
    { key: 'e', ctrlKey: true, action: () => { exportToExcel(records); toast.success('Exportado', 'Excel generado'); }, description: 'Exportar Excel' },
    { key: 'd', ctrlKey: true, action: toggleDarkMode, description: 'Cambiar tema' },
    { key: 'b', ctrlKey: true, action: () => openModal('decreeBook'), description: 'Libro de decretos' },
    { key: 'g', ctrlKey: true, action: () => setShowDashboard(p => !p), description: 'Ver gráficos' },
    { key: 'c', ctrlKey: true, action: () => openModal('calendar'), description: 'Calendario' },
    { key: 'z', ctrlKey: true, action: handleUndo, description: 'Deshacer' },
    { key: '?', action: () => openModal('shortcuts'), description: 'Mostrar atajos' },
  ], [fetchFromCloud, records, toast, toggleDarkMode, openModal, handleUndo]);

  useKeyboardShortcuts(shortcuts);

  const syncStatusLabel = isSyncing
    ? 'Sincronizando...'
    : !isOnline
      ? pendingSync
        ? 'Pendiente (offline)'
        : 'Offline'
      : syncError
        ? 'Error de sincronización'
        : pendingSync
          ? isRetryScheduled
            ? 'Reintentando...'
            : 'Pendiente'
          : 'Sincronizado';

  const syncStatusDotClass = isSyncing
    ? 'bg-indigo-500 animate-ping'
    : pendingSync
      ? 'bg-amber-500'
      : syncError
        ? 'bg-red-500'
        : isOnline
          ? 'bg-emerald-500'
          : 'bg-red-500';

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="sticky top-0 z-[100] w-full border-b border-slate-200 dark:border-slate-700 bg-white/75 dark:bg-slate-900/75 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          {/* Logo y título */}
          <div className="flex items-center gap-3">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-500 ${isSyncing ? 'bg-indigo-600 animate-pulse' : 'bg-slate-900 dark:bg-indigo-600'}`}>
              <Cloud className="text-white w-4 h-4" />
            </div>
            <div className="flex items-center gap-2">
              <h1 className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-white tracking-tight">
                GDP Cloud
              </h1>
              <span className={`w-1.5 h-1.5 rounded-full ${syncStatusDotClass}`} />
            </div>
          </div>

          {/* Acciones */}
          <div className="flex items-center gap-1 sm:gap-1.5">
            {/* Personal - Solo desktop */}
            <button
              onClick={() => openModal('employeeList')}
              className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-bold text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-lg transition-all uppercase tracking-wider"
            >
              <Users className="w-3.5 h-3.5" />
              {employees.length} Personal
            </button>

            {/* Separador */}
            <div className="hidden lg:block w-px h-5 bg-slate-200 dark:bg-slate-700 mx-1" />

            {/* Botones secundarios - Solo desktop */}
            <button
              onClick={() => setShowDashboard(p => !p)}
              className={`hidden sm:flex p-2 rounded-lg transition-all ${showDashboard
                ? 'bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400'
                : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              title="Gráficos"
            >
              <BarChart3 className="w-4 h-4" />
            </button>

            <button
              onClick={() => openModal('decreeBook')}
              className="hidden sm:flex p-2 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
              title="Libro de decretos"
            >
              <BookOpen className="w-4 h-4" />
            </button>

            <button
              onClick={() => openModal('calendar')}
              className="hidden sm:flex p-2 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
              title="Calendario"
            >
              <CalendarDays className="w-4 h-4" />
            </button>

            <button
              onClick={() => window.open(`https://docs.google.com/spreadsheets/d/${CONFIG.DECRETOS_SHEET_ID}`, '_blank')}
              className="hidden md:flex p-2 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
              title="Abrir hoja de cálculo"
            >
              <ExternalLink className="w-4 h-4" />
            </button>

            {/* Separador */}
            <div className="hidden sm:block w-px h-5 bg-slate-200 dark:bg-slate-700 mx-1" />

            {/* Undo */}
            {canUndo && (
              <button
                onClick={handleUndo}
                className="p-2 rounded-lg text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/30 transition-all active:scale-95"
                title="Deshacer"
              >
                <Undo2 className="w-4 h-4" />
              </button>
            )}

            {/* Excel */}
            <button
              onClick={() => {
                exportToExcel(records);
                toast.success('Exportado', 'Archivo Excel generado correctamente');
              }}
              className="p-2 rounded-lg text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 transition-all active:scale-95"
              title="Exportar Excel"
            >
              <FileSpreadsheet className="w-4 h-4" />
            </button>

            {/* Sync */}
            <button
              onClick={() => fetchFromCloud()}
              disabled={isSyncing}
              className={`p-2 rounded-lg transition-all ${isSyncing
                ? 'text-slate-300 dark:text-slate-600'
                : syncError
                  ? 'text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30'
                  : 'text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30'
                }`}
              title="Sincronizar"
            >
              {syncError ? <AlertCircle className="w-4 h-4" /> : <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />}
            </button>

            {/* Dark Mode */}
            <button
              onClick={toggleDarkMode}
              className="p-2 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
              title={isDark ? 'Modo claro' : 'Modo oscuro'}
            >
              {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>

            {/* Temas - Solo desktop */}
            <button
              onClick={() => openModal('themeSelector')}
              className="hidden sm:flex p-2 rounded-lg text-slate-400 hover:text-violet-600 dark:hover:text-violet-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
              title="Tema"
            >
              <Palette className="w-4 h-4" />
            </button>

            {/* Notificaciones */}
            <NotificationCenter records={records} employees={employees} />

            {/* Imprimir - Solo desktop */}
            <button
              onClick={() => window.print()}
              className="hidden md:flex p-2 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
              title="Imprimir"
            >
              <Printer className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Progress bar */}
        {isSyncing && (
          <div className="absolute bottom-0 left-0 w-full h-[3px] bg-indigo-50 dark:bg-indigo-900/50 overflow-hidden">
            <div className="h-full bg-gradient-to-r from-indigo-600 via-sky-400 to-indigo-600 bg-[length:200%_100%] animate-sync-progress" />
          </div>
        )}
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-10 space-y-10 sm:space-y-12">
        <StatsCards records={records} totalDatabaseEmployees={employees.length} />

        {/* Dashboard condicional */}
        {showDashboard && (
          <Dashboard
            records={records}
            employees={employees}
            onViewLowBalance={() => openModal('lowBalance')}
          />
        )}

        <div className="space-y-10 sm:space-y-12">
          {/* Formulario */}
          <section ref={formRef}>
            <PermitForm
              onSubmit={handleSubmit}
              editingRecord={editingRecord}
              onCancelEdit={() => setEditingRecord(null)}
              nextCorrelatives={nextCorrelatives}
              employees={employees}
              records={records}
            />
          </section>

          {/* Tabla */}
          <section className="space-y-6 sm:space-y-8">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 sm:gap-6">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-indigo-100 dark:shadow-indigo-900/50">
                  <LayoutDashboard className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white tracking-tight">
                    Registro de Decretos
                  </h3>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] sm:text-[11px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                      Historial Institucional
                    </span>
                    {lastSync && !isSyncing && (
                      <span className="hidden sm:flex items-center gap-1 px-2 py-0.5 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-800 rounded-full text-[8px] font-black uppercase tracking-tighter">
                        <CheckCircle className="w-2.5 h-2.5" /> Sincronizado
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Tabs de filtro */}
              <div className="flex bg-slate-100/80 dark:bg-slate-800/80 backdrop-blur p-1.5 rounded-2xl gap-1 border border-slate-200/50 dark:border-slate-700 shadow-inner w-full sm:w-auto">
                {(['ALL', 'PA', 'FL'] as const).map(tab => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`flex-1 sm:flex-none px-3 sm:px-6 lg:px-8 py-2 sm:py-2.5 rounded-xl text-[10px] sm:text-[11px] font-black tracking-wider sm:tracking-widest transition-all duration-300 uppercase ${activeTab === tab
                      ? 'bg-white dark:bg-slate-700 text-indigo-600 dark:text-indigo-400 shadow-md ring-1 ring-slate-200 dark:ring-slate-600'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                      }`}
                  >
                    {tab === 'ALL' ? 'Todos' : tab === 'PA' ? 'Permisos' : 'Feriados'}
                  </button>
                ))}
              </div>
            </div>

            <PermitTable
              data={records}
              activeTab={activeTab}
              onDelete={handleDelete}
              onEdit={setEditingRecord}
            />
          </section>
        </div>
      </main>

      {/* Modal de empleados */}
      <EmployeeListModal
        isOpen={modals.employeeList}
        onClose={() => closeModal('employeeList')}
        employees={employees}
        records={records}
        onAddEmployee={handleAddEmployee}
        onDeleteEmployee={handleDeleteEmployee}
        onFilterByEmployee={handleFilterByEmployee}
        onQuickDecree={handleQuickDecree}
      />

      {/* Modal saldo bajo */}
      <LowBalanceModal
        isOpen={modals.lowBalance}
        onClose={() => closeModal('lowBalance')}
        records={records}
      />

      {/* Modal libro de decretos */}
      <DecreeBookModal
        isOpen={modals.decreeBook}
        onClose={() => closeModal('decreeBook')}
        records={records}
      />

      {/* Modal atajos de teclado */}
      <ShortcutsHelpModal
        isOpen={modals.shortcuts}
        onClose={() => closeModal('shortcuts')}
        shortcuts={shortcuts}
      />

      {/* Vista de Calendario */}
      <CalendarView
        isOpen={modals.calendar}
        onClose={() => closeModal('calendar')}
        records={records}
      />

      {/* Modal de confirmación de eliminación */}
      <ConfirmModal
        isOpen={modals.confirmDelete}
        onClose={() => {
          closeModal('confirmDelete');
          setDeleteTargetId(null);
        }}
        onConfirm={confirmDelete}
        title="Eliminar decreto"
        message="¿Estás seguro de que deseas eliminar este decreto? Esta acción se puede deshacer."
        confirmText="Eliminar"
        cancelText="Cancelar"
        variant="danger"
      />

      {/* Footer */}
      <footer className="max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-12 border-t border-slate-200 dark:border-slate-700 mt-16 sm:mt-20">
        <div className="flex flex-col md:flex-row justify-between items-center gap-6 sm:gap-8 opacity-40 grayscale hover:grayscale-0 hover:opacity-100 transition-all duration-500">
          <div className="flex items-center gap-3">
            <Cloud className="w-5 h-5 sm:w-6 sm:h-6 text-indigo-600" />
            <span className="text-[10px] sm:text-[11px] font-black text-slate-600 dark:text-slate-400 uppercase tracking-[0.2em] sm:tracking-[0.3em]">
              GDP Cloud Engine 2026
            </span>
          </div>
          <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-4">
            <button
              onClick={() => openModal('shortcuts')}
              className="hidden sm:flex items-center gap-1.5 text-[9px] font-bold text-slate-400 hover:text-indigo-600 transition-colors uppercase tracking-wider"
            >
              <Keyboard className="w-3 h-3" aria-hidden="true" /> Atajos
            </button>
            <p className="text-[8px] sm:text-[10px] font-bold text-slate-500 dark:text-slate-500 uppercase tracking-[0.1em] sm:tracking-[0.2em] text-center leading-relaxed">
              Herramienta Desarrollada para Gestión de Personas por Maximiliano Guzmán
            </p>
          </div>
        </div>
      </footer>

      {/* Selector de Tema */}
      <ThemeSelector
        isOpen={modals.themeSelector}
        onClose={() => closeModal('themeSelector')}
      />

      {/* Toasts */}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </div>
  );
};

// Wrapper con ErrorBoundary y ThemeProvider
const App: React.FC = () => (
  <ThemeProvider>
    <ErrorBoundary>
      <AppContent />
    </ErrorBoundary>
  </ThemeProvider>
);

export default App;
