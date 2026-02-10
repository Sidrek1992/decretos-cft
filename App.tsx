
import React, { useState, useMemo, useRef, useEffect, useCallback, lazy, Suspense } from 'react';
import PermitForm from './components/PermitForm';
import PermitTable from './components/PermitTable';
import StatsCards from './components/StatsCards';
import ErrorBoundary from './components/ErrorBoundary';
import NotificationCenter from './components/NotificationCenter';
import ConfirmModal from './components/ConfirmModal';
import LoginPage from './components/LoginPage';
import AdminPanel from './components/AdminPanel';
import CommandPalette from './components/CommandPalette';
import ScrollToTop from './components/ScrollToTop';
import WelcomeBanner from './components/WelcomeBanner';
import { AuthProvider, useAuth } from './contexts/AuthContext';

// Lazy load heavy modals for better initial performance
const EmployeeListModal = lazy(() => import('./components/EmployeeListModal'));
const Dashboard = lazy(() => import('./components/Dashboard'));
const LowBalanceModal = lazy(() => import('./components/LowBalanceModal'));
const DecreeBookModal = lazy(() => import('./components/DecreeBookModal'));
const CalendarView = lazy(() => import('./components/CalendarView'));
const ThemeSelector = lazy(() => import('./components/ThemeSelector'));

// Loading fallback component
const ModalLoader = () => (
  <div className="fixed inset-0 z-[150] flex items-center justify-center bg-slate-900/50 backdrop-blur-md notification-backdrop-enter">
    <div className="bg-white dark:bg-slate-800 p-8 rounded-3xl shadow-2xl page-fade-in">
      <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center mx-auto shadow-lg">
        <div className="animate-spin w-5 h-5 border-2 border-white border-t-transparent rounded-full" />
      </div>
      <p className="text-sm font-bold text-slate-600 dark:text-slate-300 mt-4 text-center">Cargando</p>
      <div className="flex justify-center gap-1.5 mt-2">
        <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full loading-dot" />
        <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full loading-dot" />
        <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full loading-dot" />
      </div>
    </div>
  </div>
);
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
import { getFLSaldoFinal } from './utils/flBalance';
import { appendAuditLog } from './utils/audit';
import { CONFIG } from './config';
import {
  Cloud, FileSpreadsheet, ExternalLink, RefreshCw, LayoutDashboard, BookOpen, BarChart3,
  Database, CheckCircle, Users, AlertCircle, Moon, Sun, Undo2, Keyboard, CalendarDays, Palette, Printer, LogOut, Settings
} from 'lucide-react';

const AppContent: React.FC = () => {
  const USER_PROFILES_STORAGE_KEY = 'gdp_user_profiles';

  // ★ Autenticación y Permisos
  const { user, signOut, permissions, role, roleLabel, roleColors } = useAuth();

  // Employees sincronizados con Google Sheets
  const {
    employees,
    isSyncing: isEmployeeSyncing,
    addEmployee: handleAddEmployee,
    updateEmployee: handleUpdateEmployee,
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
  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [requestedSolicitudType, setRequestedSolicitudType] = useState<SolicitudType | null>(null);

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
    moduleSync,
    fetchFromCloud,
    fetchModuleFromCloud,
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

  // Conteo de alertas críticas para el WelcomeBanner
  const notifications_criticalCount = useMemo(() => {
    let count = 0;
    employees.forEach(emp => {
      const paRecs = records.filter(r => r.rut === emp.rut && r.solicitudType === 'PA');
      if (paRecs.length > 0) {
        const sorted = [...paRecs].sort((a, b) => b.createdAt - a.createdAt);
        const saldo = sorted[0].diasHaber - sorted[0].cantidadDias;
        if (saldo <= 0) count++;
      }
      const flRecs = records.filter(r => r.rut === emp.rut && r.solicitudType === 'FL');
      if (flRecs.length > 0) {
        const sorted = [...flRecs].sort((a, b) => b.createdAt - a.createdAt);
        const saldoFL = getFLSaldoFinal(sorted[0], 0);
        if (saldoFL <= 0) count++;
      }
    });
    return count;
  }, [records, employees]);

  const handleSubmit = (formData: PermitFormData) => {
    const actor = user?.email || 'sistema';
    let updated: PermitRecord[];
    if (editingRecord) {
      updated = records.map(r =>
        r.id === editingRecord.id ? { ...formData, id: r.id, createdAt: r.createdAt } : r
      );
      setEditingRecord(null);
      toast.success('Decreto actualizado', `${formData.acto} modificado correctamente`);
      appendAuditLog({
        scope: 'decree',
        action: 'update_decree',
        actor,
        target: `${formData.solicitudType} ${formData.acto}`,
        details: `Funcionario: ${formData.funcionario}`
      });
    } else {
      updated = [...records, { ...formData, id: crypto.randomUUID(), createdAt: Date.now() }];
      toast.success('Decreto emitido', `Resolución ${formData.acto} creada exitosamente`);
      appendAuditLog({
        scope: 'decree',
        action: 'create_decree',
        actor,
        target: `${formData.solicitudType} ${formData.acto}`,
        details: `Funcionario: ${formData.funcionario}`
      });
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
      const deleted = records.find(r => r.id === deleteTargetId);
      const updated = records.filter(r => r.id !== deleteTargetId);
      setRecords(updated);
      syncToCloud(updated);
      toast.warning('Decreto eliminado', 'Puedes deshacer esta acción');
      appendAuditLog({
        scope: 'decree',
        action: 'delete_decree',
        actor: user?.email || 'sistema',
        target: deleted ? `${deleted.solicitudType} ${deleted.acto}` : deleteTargetId,
        details: deleted ? `Funcionario: ${deleted.funcionario}` : 'Eliminado por ID'
      });
      setDeleteTargetId(null);
    }
  }, [deleteTargetId, records, setRecords, syncToCloud, toast, user?.email]);

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

  const handleViewEmployeeFromNotification = (rut: string) => {
    const match = employees.find(e => e.rut === rut);
    setSearchFilter(match?.nombre || rut);
    openModal('employeeList');
  };

  const handleQuickDecree = (employee: Employee) => {
    // Preparar el formulario con el empleado seleccionado
    formRef.current?.scrollIntoView({ behavior: 'smooth' });
    toast.info('Nuevo decreto', `Preparando decreto para ${employee.nombre}`);
  };

  const handleViewDecreesFromWelcome = useCallback(() => {
    document.querySelector('section.space-y-6')?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  const handleViewEmployeesFromWelcome = useCallback(() => {
    openModal('employeeList');
  }, [openModal]);

  const handleViewUrgentFromWelcome = useCallback(() => {
    openModal('lowBalance');
  }, [openModal]);

  const handleExportData = useCallback(async () => {
    if (!permissions.canExportExcel) {
      toast.warning('Sin permiso', 'Tu rol no permite exportar a Excel');
      return;
    }
    const result = await exportToExcel(records);
    if (result.success) {
      toast.success('Exportado', 'Excel generado');
    } else {
      toast.error('Error', result.error || 'No se pudo exportar');
    }
  }, [permissions.canExportExcel, records, toast]);

  const handleNewDecreeFromPalette = (type?: SolicitudType) => {
    if (!permissions.canCreateDecree) {
      toast.warning('Sin permiso', 'Tu rol no permite crear decretos');
      return;
    }
    if (type) {
      setRequestedSolicitudType(type);
    }
    formRef.current?.scrollIntoView({ behavior: 'smooth' });
    toast.info('Nuevo decreto', type ? `Preparando ${type === 'PA' ? 'Permiso Administrativo' : 'Feriado Legal'}` : 'Preparando nuevo decreto');
  };

  const handleSelectRecordFromPalette = (record: PermitRecord) => {
    setActiveTab(record.solicitudType);
    setSearchFilter(record.acto || record.funcionario);
    setTimeout(() => {
      document.querySelector('section.space-y-6')?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  // Atajos de teclado (memoizados para evitar re-renders)
  const shortcuts = useMemo(() => [
    { key: 'n', ctrlKey: true, action: () => formRef.current?.scrollIntoView({ behavior: 'smooth' }), description: 'Nuevo decreto' },
    { key: 's', ctrlKey: true, action: () => fetchFromCloud(), description: 'Sincronizar' },
    { key: 'e', ctrlKey: true, action: handleExportData, description: 'Exportar Excel' },
    { key: 'd', ctrlKey: true, action: toggleDarkMode, description: 'Cambiar tema' },
    { key: 'b', ctrlKey: true, action: () => openModal('decreeBook'), description: 'Libro de decretos' },
    { key: 'g', ctrlKey: true, action: () => setShowDashboard(p => !p), description: 'Ver gráficos' },
    { key: 'c', ctrlKey: true, action: () => openModal('calendar'), description: 'Calendario' },
    { key: 'z', ctrlKey: true, action: handleUndo, description: 'Deshacer' },
    { key: 'k', ctrlKey: true, action: () => setCommandPaletteOpen(true), description: 'Buscar comandos' },
    { key: '?', action: () => openModal('shortcuts'), description: 'Mostrar atajos' },
  ], [fetchFromCloud, handleExportData, toggleDarkMode, openModal, handleUndo]);

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

  const welcomeUserName = useMemo(() => {
    const metadata = user?.user_metadata as Record<string, unknown> | undefined;
    const firstFromMetadata = String(metadata?.first_name || '').trim();
    const lastFromMetadata = String(metadata?.last_name || '').trim();
    const fullFromMetadata = `${firstFromMetadata} ${lastFromMetadata}`.trim();
    if (fullFromMetadata) return fullFromMetadata;

    const email = user?.email?.toLowerCase();
    if (!email) return undefined;

    try {
      const raw = localStorage.getItem(USER_PROFILES_STORAGE_KEY);
      if (raw) {
        const profiles = JSON.parse(raw) as Record<string, { firstName?: string; lastName?: string }>;
        const profile = profiles[email];
        const firstName = String(profile?.firstName || '').trim();
        const lastName = String(profile?.lastName || '').trim();
        const fullName = `${firstName} ${lastName}`.trim();
        if (fullName) return fullName;
      }
    } catch {
      // ignore invalid local data
    }

    return user?.email;
  }, [user]);

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

          {/* ═══════════════════════════════════════════════════════════════════
               BARRA DE ACCIONES - Organizada en grupos lógicos
              ═══════════════════════════════════════════════════════════════════ */}
          <div className="flex items-center gap-1 sm:gap-1.5">

            {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
                GRUPO 1: DATOS (Sync, Undo) - Acciones de datos principales
               ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
            <div className="flex items-center gap-1 bg-slate-100/50 dark:bg-slate-800/50 rounded-lg px-1 py-0.5">
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
                title="Sincronizar datos"
              >
                {syncError ? <AlertCircle className="w-4 h-4" /> : <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />}
              </button>

              {/* Undo - Solo aparece cuando hay algo para deshacer */}
              {canUndo && (
                <button
                  onClick={handleUndo}
                  className="p-2 rounded-lg text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-900/30 transition-all active:scale-95"
                  title="Deshacer última acción"
                >
                  <Undo2 className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Separador */}
            <div className="hidden sm:block w-px h-5 bg-slate-200 dark:bg-slate-700 mx-1" />

            {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
                GRUPO 2: VISTAS (Dashboard, Libro, Calendario, Personal)
               ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
            <div className="hidden sm:flex items-center gap-1">
              {/* Dashboard */}
              <button
                onClick={() => setShowDashboard(p => !p)}
                className={`p-2 rounded-lg transition-all ${showDashboard
                  ? 'bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400'
                  : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                title="Panel de estadísticas"
              >
                <BarChart3 className="w-4 h-4" />
              </button>

              {/* Libro de decretos */}
              <button
                onClick={() => openModal('decreeBook')}
                className="p-2 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
                title="Libro de decretos"
              >
                <BookOpen className="w-4 h-4" />
              </button>

              {/* Calendario */}
              <button
                onClick={() => openModal('calendar')}
                className="p-2 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
                title="Calendario de ausencias"
              >
                <CalendarDays className="w-4 h-4" />
              </button>

              {/* Personal */}
              <button
                onClick={() => openModal('employeeList')}
                className="hidden lg:flex items-center gap-1.5 px-2 py-1.5 text-[10px] font-bold text-slate-500 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-lg transition-all uppercase tracking-wider"
              >
                <Users className="w-3.5 h-3.5" />
                {employees.length}
              </button>
            </div>

            {/* Separador */}
            <div className="hidden md:block w-px h-5 bg-slate-200 dark:bg-slate-700 mx-1" />

            {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
                GRUPO 3: EXPORTACIÓN (Excel, Sheets, Imprimir)
               ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
            <div className="hidden md:flex items-center gap-1 bg-emerald-50/50 dark:bg-emerald-900/20 rounded-lg px-1 py-0.5">
              {/* Excel */}
              <button
                onClick={handleExportData}
                className="p-2 rounded-lg text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/30 transition-all active:scale-95"
                title="Exportar a Excel"
              >
                <FileSpreadsheet className="w-4 h-4" />
              </button>

              {/* Menú desplegable de hojas de cálculo */}
              <div className="relative group">
                <button
                  className="p-2 rounded-lg text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/30 transition-all flex items-center gap-1"
                  title="Abrir hojas de Google"
                >
                  <ExternalLink className="w-4 h-4" />
                </button>

                {/* Dropdown */}
                <div className="absolute right-0 top-full mt-1 w-56 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50 overflow-hidden">
                  <div className="p-2 border-b border-slate-100 dark:border-slate-700">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider px-2">Hojas de Cálculo</p>
                  </div>

                  {/* Permisos Administrativos */}
                  <button
                    onClick={() => window.open(`https://docs.google.com/spreadsheets/d/${CONFIG.DECRETOS_SHEET_ID}`, '_blank')}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition-colors text-left"
                  >
                    <div className="w-8 h-8 bg-indigo-100 dark:bg-indigo-900/50 rounded-lg flex items-center justify-center">
                      <span className="text-xs font-black text-indigo-600 dark:text-indigo-400">PA</span>
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-700 dark:text-slate-200">Permisos Administrativos</p>
                      <p className="text-[10px] text-slate-400">Decretos de permisos</p>
                    </div>
                  </button>

                  {/* Feriado Legal 1 Período */}
                  <button
                    onClick={() => window.open(`https://docs.google.com/spreadsheets/d/${CONFIG.FERIADOS_SHEET_ID}`, '_blank')}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 transition-colors text-left"
                  >
                    <div className="w-8 h-8 bg-emerald-100 dark:bg-emerald-900/50 rounded-lg flex items-center justify-center">
                      <span className="text-xs font-black text-emerald-600 dark:text-emerald-400">FL</span>
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-700 dark:text-slate-200">Feriado Legal 1P</p>
                      <p className="text-[10px] text-slate-400">Un período</p>
                    </div>
                  </button>

                  {/* Feriado Legal 2 Períodos */}
                  <button
                    onClick={() => window.open(`https://docs.google.com/spreadsheets/d/${CONFIG.FERIADOS_2P_SHEET_ID}`, '_blank')}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-amber-50 dark:hover:bg-amber-900/30 transition-colors text-left"
                  >
                    <div className="w-8 h-8 bg-amber-100 dark:bg-amber-900/50 rounded-lg flex items-center justify-center">
                      <span className="text-xs font-black text-amber-600 dark:text-amber-400">2P</span>
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-700 dark:text-slate-200">Feriado Legal 2P</p>
                      <p className="text-[10px] text-slate-400">Dos períodos</p>
                    </div>
                  </button>
                </div>
              </div>

              {/* Imprimir */}
              <button
                onClick={() => window.print()}
                className="p-2 rounded-lg text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/30 transition-all"
                title="Imprimir página"
              >
                <Printer className="w-4 h-4" />
              </button>
            </div>

            {/* Separador */}
            <div className="hidden sm:block w-px h-5 bg-slate-200 dark:bg-slate-700 mx-1" />

            {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
                GRUPO 4: PREFERENCIAS (Tema, Dark Mode, Notificaciones)
               ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
            <div className="flex items-center gap-1">
              {/* Dark Mode */}
              <button
                onClick={toggleDarkMode}
                className="p-2 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
                title={isDark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
              >
                {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              </button>

              {/* Tema - Solo desktop */}
              <button
                onClick={() => openModal('themeSelector')}
                className="hidden sm:flex p-2 rounded-lg text-slate-400 hover:text-violet-600 dark:hover:text-violet-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
                title="Personalizar tema"
              >
                <Palette className="w-4 h-4" />
              </button>

              {/* Notificaciones */}
              <NotificationCenter
                records={records}
                employees={employees}
                onViewEmployee={handleViewEmployeeFromNotification}
              />
            </div>

            {/* Separador principal antes de sesión */}
            <div className="w-px h-6 bg-slate-300 dark:bg-slate-600 mx-2" />

            {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
                GRUPO 5: SESIÓN (Usuario, Rol, Admin, Logout)
               ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
            <div className="flex items-center gap-2">
              {/* Badge del rol */}
              <span className={`hidden sm:inline-flex px-2 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider ${roleColors.bg} ${roleColors.text}`}>
                {roleLabel}
              </span>
              <span className="hidden lg:block text-[10px] font-bold text-slate-400 dark:text-slate-500 truncate max-w-[100px]">
                {user?.email}
              </span>

              {/* Admin Panel - Solo para admins */}
              {role === 'admin' && (
                <button
                  onClick={() => setShowAdminPanel(true)}
                  className="p-2 rounded-lg text-purple-500 hover:text-purple-600 dark:hover:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/30 transition-all"
                  title="Panel de Administración"
                >
                  <Settings className="w-4 h-4" />
                </button>
              )}

              {/* Logout */}
              <button
                onClick={() => signOut()}
                className="p-2 rounded-lg text-red-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 transition-all"
                title="Cerrar sesión"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
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
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-10 space-y-8 sm:space-y-10 page-fade-in">
        {/* Welcome Banner */}
        <WelcomeBanner
          userName={welcomeUserName}
          totalRecords={records.length}
          totalEmployees={employees.length}
          criticalAlerts={notifications_criticalCount}
          onClickDecrees={handleViewDecreesFromWelcome}
          onClickEmployees={handleViewEmployeesFromWelcome}
          onClickUrgent={handleViewUrgentFromWelcome}
        />

        <StatsCards records={records} totalDatabaseEmployees={employees.length} />

        {/* Dashboard condicional (lazy loaded) */}
        {showDashboard && (
          <Suspense fallback={
            <div className="bg-white dark:bg-slate-800 rounded-2xl p-8 animate-pulse">
              <div className="h-64 bg-slate-200 dark:bg-slate-700 rounded-xl" />
            </div>
          }>
            <Dashboard
              records={records}
              employees={employees}
              onViewLowBalance={() => openModal('lowBalance')}
            />
          </Suspense>
        )}

        <div className="space-y-10 sm:space-y-12">
          {/* Formulario - Solo para administradores */}
          {permissions.canCreateDecree && (
            <section ref={formRef}>
              <PermitForm
                onSubmit={handleSubmit}
                editingRecord={editingRecord}
                onCancelEdit={() => setEditingRecord(null)}
                nextCorrelatives={nextCorrelatives}
                employees={employees}
                records={records}
                requestedSolicitudType={requestedSolicitudType}
                onRequestedSolicitudTypeHandled={() => setRequestedSolicitudType(null)}
              />
            </section>
          )}

          {/* Mensaje para lectores */}
          {!permissions.canCreateDecree && (
            <div className="bg-sky-50 dark:bg-sky-900/20 border border-sky-200 dark:border-sky-800 rounded-2xl p-6">
              <div className="flex items-center gap-3">
                <div className={`px-3 py-1 rounded-lg text-xs font-black uppercase tracking-wider ${roleColors.bg} ${roleColors.text}`}>
                  {roleLabel}
                </div>
                <p className="text-sm text-sky-700 dark:text-sky-300">
                  Tu rol es de <strong>lectura</strong>. Puedes consultar los registros y generar documentos PDF, pero no crear ni modificar decretos.
                </p>
              </div>
            </div>
          )}

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
                  <div className="mt-1 hidden sm:flex items-center gap-2">
                    {(['PA', 'FL'] as const).map((module) => (
                      <button
                        key={module}
                        onClick={() => fetchModuleFromCloud(module)}
                        className={`px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider border transition-colors ${moduleSync[module].status === 'error'
                          ? 'bg-red-50 text-red-600 border-red-200 dark:bg-red-900/20 dark:text-red-300 dark:border-red-800'
                          : moduleSync[module].status === 'syncing'
                            ? 'bg-indigo-50 text-indigo-600 border-indigo-200 dark:bg-indigo-900/20 dark:text-indigo-300 dark:border-indigo-800'
                            : 'bg-slate-50 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700'
                          }`}
                        title={moduleSync[module].lastError || `Reintentar sincronización ${module}`}
                      >
                        {module} {moduleSync[module].status === 'syncing' ? '...' : 'sync'}
                      </button>
                    ))}
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
              searchTerm={searchFilter}
              onSearchTermChange={setSearchFilter}
              canEdit={permissions.canEditDecree}
              canDelete={permissions.canDeleteDecree}
            />
          </section>
        </div>
      </main>

      {/* Modal de empleados (lazy loaded) */}
      {modals.employeeList && (
        <Suspense fallback={<ModalLoader />}>
          <EmployeeListModal
            isOpen={modals.employeeList}
            onClose={() => closeModal('employeeList')}
            employees={employees}
            records={records}
            onAddEmployee={permissions.canManageEmployees ? handleAddEmployee : undefined}
            onUpdateEmployee={permissions.canManageEmployees ? handleUpdateEmployee : undefined}
            onDeleteEmployee={permissions.canManageEmployees ? handleDeleteEmployee : undefined}
            onFilterByEmployee={handleFilterByEmployee}
            onQuickDecree={permissions.canCreateDecree ? handleQuickDecree : undefined}
          />
        </Suspense>
      )}

      {/* Modal saldo bajo (lazy loaded) */}
      {modals.lowBalance && (
        <Suspense fallback={<ModalLoader />}>
          <LowBalanceModal
            isOpen={modals.lowBalance}
            onClose={() => closeModal('lowBalance')}
            records={records}
          />
        </Suspense>
      )}

      {/* Modal libro de decretos (lazy loaded) */}
      {modals.decreeBook && (
        <Suspense fallback={<ModalLoader />}>
          <DecreeBookModal
            isOpen={modals.decreeBook}
            onClose={() => closeModal('decreeBook')}
            records={records}
          />
        </Suspense>
      )}

      {/* Modal atajos de teclado */}
      <ShortcutsHelpModal
        isOpen={modals.shortcuts}
        onClose={() => closeModal('shortcuts')}
        shortcuts={shortcuts}
      />

      {/* Vista de Calendario (lazy loaded) */}
      {modals.calendar && (
        <Suspense fallback={<ModalLoader />}>
          <CalendarView
            isOpen={modals.calendar}
            onClose={() => closeModal('calendar')}
            records={records}
          />
        </Suspense>
      )}

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

      {/* ★ Panel de Administración */}
      <AdminPanel
        isOpen={showAdminPanel}
        onClose={() => setShowAdminPanel(false)}
      />

      {/* Command Palette */}
      <CommandPalette
        isOpen={commandPaletteOpen}
        onClose={() => setCommandPaletteOpen(false)}
        records={records}
        employees={employees}
        onNavigate={(view) => {
          if (view === 'dashboard') {
            setShowDashboard(true);
          } else if (view === 'calendar') {
            openModal('calendar');
          } else if (view === 'employees') {
            openModal('employeeList');
          } else if (view === 'settings') {
            if (role === 'admin') {
              setShowAdminPanel(true);
            } else {
              openModal('themeSelector');
            }
          }
        }}
        onNewDecree={handleNewDecreeFromPalette}
        onSelectEmployee={(employee) => handleFilterByEmployee(employee.nombre)}
        onSelectRecord={handleSelectRecordFromPalette}
        onExportData={handleExportData}
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

      {/* Selector de Tema (lazy loaded) */}
      {modals.themeSelector && (
        <Suspense fallback={<ModalLoader />}>
          <ThemeSelector
            isOpen={modals.themeSelector}
            onClose={() => closeModal('themeSelector')}
          />
        </Suspense>
      )}

      {/* Toasts */}
      <ToastContainer toasts={toasts} onRemove={removeToast} />

      {/* Scroll to Top */}
      <ScrollToTop />
    </div>
  );
};

// ★ Componente que maneja la autenticación
const AuthenticatedApp: React.FC = () => {
  const { user, loading } = useAuth();

  // Mostrar loader mientras se verifica la sesión
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-100 dark:bg-slate-900 flex items-center justify-center">
        <div className="text-center page-fade-in">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center mx-auto shadow-xl shadow-indigo-200 dark:shadow-indigo-900/50">
            <div className="animate-spin w-6 h-6 border-2 border-white border-t-transparent rounded-full" />
          </div>
          <p className="text-sm font-bold text-slate-500 dark:text-slate-400 mt-4">Verificando sesión</p>
          <div className="flex justify-center gap-1.5 mt-2">
            <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full loading-dot" />
            <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full loading-dot" />
            <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full loading-dot" />
          </div>
        </div>
      </div>
    );
  }

  // Mostrar login si no hay usuario
  if (!user) {
    return <LoginPage />;
  }

  // Usuario autenticado, mostrar la app
  return <AppContent />;
};

// Wrapper con ErrorBoundary, ThemeProvider y AuthProvider
const App: React.FC = () => (
  <ThemeProvider>
    <ErrorBoundary>
      <AuthProvider>
        <AuthenticatedApp />
      </AuthProvider>
    </ErrorBoundary>
  </ThemeProvider>
);

export default App;
