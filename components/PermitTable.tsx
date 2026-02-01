
import React, { useState, useMemo, useCallback, memo } from 'react';
import { PermitRecord, SolicitudType } from '../types';
import { Search, ArrowUpDown, ChevronUp, ChevronDown, UserCircle, LayoutGrid, CheckSquare, Square, FileDown, Loader2, X } from 'lucide-react';
import { formatNumericDate } from '../utils/formatters';
import { generateDecretoPDF } from '../services/pdfGenerator';
import { generateBatchPDFs } from '../services/batchPdfGenerator';
import Pagination from './Pagination';
import ActionMenu from './ActionMenu';
import AdvancedFilters, { FilterState } from './AdvancedFilters';
import DecreePreviewModal from './DecreePreviewModal';
import { CONFIG } from '../config';

interface PermitTableProps {
  data: PermitRecord[];
  activeTab: SolicitudType | 'ALL';
  onDelete: (id: string) => void;
  onEdit: (record: PermitRecord) => void;
  canEdit?: boolean;
  canDelete?: boolean;
}

type SortField = 'acto' | 'funcionario' | 'solicitudType' | 'fechaInicio' | 'cantidadDias' | 'saldo' | 'fechaDecreto';
type SortOrder = 'asc' | 'desc';

const emptyFilters: FilterState = { dateFrom: '', dateTo: '', minDays: '', maxDays: '', materia: '' };

const PermitTable: React.FC<PermitTableProps> = ({ data, activeTab, onDelete, onEdit, canEdit = true, canDelete = true }) => {
  const [search, setSearch] = useState('');
  const [sortField, setSortField] = useState<SortField | null>(null);
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const [advFilters, setAdvFilters] = useState<FilterState>(emptyFilters);
  const [previewRecord, setPreviewRecord] = useState<PermitRecord | null>(null);

  // ★ Estado para selección múltiple
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isBatchGenerating, setIsBatchGenerating] = useState(false);
  const [batchProgress, setBatchProgress] = useState({ current: 0, total: 0 });

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
    setCurrentPage(1);
  };

  const filtered = useMemo(() => {
    return data.filter(r => {
      const term = search.toLowerCase();
      const matchesSearch =
        r.funcionario.toLowerCase().includes(term) ||
        r.acto.toLowerCase().includes(term) ||
        r.rut.includes(term);
      const matchesTab = activeTab === 'ALL' || r.solicitudType === activeTab;

      let matchesAdvanced = true;
      if (advFilters.dateFrom && r.fechaInicio < advFilters.dateFrom) matchesAdvanced = false;
      if (advFilters.dateTo && r.fechaInicio > advFilters.dateTo) matchesAdvanced = false;
      if (advFilters.minDays && r.cantidadDias < Number(advFilters.minDays)) matchesAdvanced = false;
      if (advFilters.maxDays && r.cantidadDias > Number(advFilters.maxDays)) matchesAdvanced = false;
      if (advFilters.materia && r.materia !== advFilters.materia) matchesAdvanced = false;

      return matchesSearch && matchesTab && matchesAdvanced;
    }).sort((a, b) => {
      if (!sortField) return b.createdAt - a.createdAt;

      let valA: string | number | Date;
      let valB: string | number | Date;

      switch (sortField) {
        case 'acto': valA = a.acto; valB = b.acto; break;
        case 'funcionario': valA = a.funcionario.toLowerCase(); valB = b.funcionario.toLowerCase(); break;
        case 'solicitudType': valA = a.solicitudType; valB = b.solicitudType; break;
        case 'fechaInicio': valA = new Date(a.fechaInicio).getTime(); valB = new Date(b.fechaInicio).getTime(); break;
        case 'cantidadDias': valA = a.cantidadDias; valB = b.cantidadDias; break;
        case 'saldo': valA = a.diasHaber - a.cantidadDias; valB = b.diasHaber - b.cantidadDias; break;
        case 'fechaDecreto': valA = new Date(a.fechaDecreto || '').getTime() || 0; valB = new Date(b.fechaDecreto || '').getTime() || 0; break;
        default: return 0;
      }

      if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
      if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });
  }, [data, search, activeTab, sortField, sortOrder, advFilters]);

  const totalItems = filtered.length;
  const totalPages = Math.ceil(totalItems / CONFIG.ITEMS_PER_PAGE);
  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * CONFIG.ITEMS_PER_PAGE;
    return filtered.slice(start, start + CONFIG.ITEMS_PER_PAGE);
  }, [filtered, currentPage]);

  React.useEffect(() => {
    setCurrentPage(1);
  }, [search, activeTab]);

  // ★ Funciones de selección múltiple
  const toggleSelect = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    if (selectedIds.size === filtered.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map(r => r.id)));
    }
  }, [filtered, selectedIds.size]);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  // ★ Generación masiva de PDFs
  const handleBatchGenerate = useCallback(async () => {
    const selectedRecords = filtered.filter(r => selectedIds.has(r.id));
    if (selectedRecords.length === 0) return;

    setIsBatchGenerating(true);
    setBatchProgress({ current: 0, total: selectedRecords.length });

    try {
      await generateBatchPDFs(selectedRecords, (current, total) => {
        setBatchProgress({ current, total });
      });

      clearSelection();
    } finally {
      setIsBatchGenerating(false);
      setBatchProgress({ current: 0, total: 0 });
    }
  }, [filtered, selectedIds, clearSelection]);

  const SortIcon = useCallback(({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown size={10} className="opacity-20 ml-auto group-hover:opacity-100 transition-opacity" />;
    return sortOrder === 'asc'
      ? <ChevronUp size={12} className="ml-auto text-indigo-500" />
      : <ChevronDown size={12} className="ml-auto text-indigo-500" />;
  }, [sortField, sortOrder]);

  const handleGeneratePDF = useCallback((record: PermitRecord, forcePdf: boolean) => {
    generateDecretoPDF(record, forcePdf);
  }, []);

  const handlePreview = useCallback((record: PermitRecord) => {
    setPreviewRecord(record);
  }, []);

  const handleClosePreview = useCallback(() => {
    setPreviewRecord(null);
  }, []);

  const handleConfirmPreview = useCallback(() => {
    if (previewRecord) {
      handleGeneratePDF(previewRecord, true);
      setPreviewRecord(null);
    }
  }, [previewRecord, handleGeneratePDF]);

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* ★ Toolbar de Selección Múltiple */}
      {selectedIds.size > 0 && (
        <div className="bg-indigo-600 text-white px-4 py-3 rounded-2xl flex items-center justify-between shadow-lg animate-in slide-in-from-top-2 duration-200">
          <div className="flex items-center gap-3">
            <span className="text-sm font-black">{selectedIds.size} seleccionado{selectedIds.size > 1 ? 's' : ''}</span>
            <button
              onClick={clearSelection}
              className="p-1.5 hover:bg-white/20 rounded-lg transition-colors"
            >
              <X size={16} />
            </button>
          </div>
          <div className="flex items-center gap-2">
            {isBatchGenerating ? (
              <div className="flex items-center gap-3 bg-white/20 px-4 py-2 rounded-xl">
                <Loader2 size={16} className="animate-spin" />
                <span className="text-xs font-bold">
                  Generando {batchProgress.current}/{batchProgress.total}...
                </span>
                <div className="w-24 h-1.5 bg-white/30 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-white rounded-full transition-all duration-300"
                    style={{ width: `${(batchProgress.current / batchProgress.total) * 100}%` }}
                  />
                </div>
              </div>
            ) : (
              <button
                onClick={handleBatchGenerate}
                className="flex items-center gap-2 px-4 py-2 bg-white text-indigo-600 rounded-xl text-xs font-black hover:bg-indigo-50 transition-colors"
              >
                <FileDown size={16} />
                Generar {selectedIds.size} PDF{selectedIds.size > 1 ? 's' : ''}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Search Bar */}
      <div className="relative max-w-2xl">
        <div className="absolute left-4 sm:left-5 top-1/2 -translate-y-1/2 p-1.5 sm:p-2 bg-indigo-50 dark:bg-indigo-900/50 rounded-lg text-indigo-600 dark:text-indigo-400">
          <Search size={16} className="sm:hidden" />
          <Search size={18} className="hidden sm:block" />
        </div>
        <input
          placeholder="Buscar decreto, funcionario o RUT..."
          className="w-full pl-12 sm:pl-14 pr-4 sm:pr-6 py-3.5 sm:py-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-lg outline-none focus:ring-4 focus:ring-indigo-50 dark:focus:ring-indigo-900/50 focus:border-indigo-200 dark:focus:border-indigo-700 transition-all font-bold text-[11px] sm:text-xs uppercase tracking-wide sm:tracking-widest text-slate-700 dark:text-slate-200 placeholder:text-slate-300 dark:placeholder:text-slate-600"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Filtros Avanzados */}
      <AdvancedFilters
        filters={advFilters}
        onFiltersChange={setAdvFilters}
        onReset={() => setAdvFilters(emptyFilters)}
      />

      {/* Table Container */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl sm:rounded-[2rem] shadow-xl border border-slate-100 dark:border-slate-700 overflow-hidden">
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left border-collapse table-auto">
            <thead>
              <tr className="bg-slate-50/50 dark:bg-slate-900/50 border-b border-slate-100 dark:border-slate-700">
                {/* ★ Checkbox para seleccionar todos */}
                <th className="pl-4 sm:pl-6 py-4 sm:py-6 w-8">
                  <button
                    onClick={selectAll}
                    className="p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors"
                  >
                    {selectedIds.size > 0 && selectedIds.size === filtered.length ? (
                      <CheckSquare size={18} className="text-indigo-600 dark:text-indigo-400" />
                    ) : (
                      <Square size={18} className="text-slate-300 dark:text-slate-600" />
                    )}
                  </button>
                </th>
                <th
                  onClick={() => handleSort('acto')}
                  className="pr-2 sm:pr-3 py-4 sm:py-6 text-[10px] sm:text-[11px] font-black uppercase tracking-wider sm:tracking-[0.2em] text-slate-400 dark:text-slate-500 cursor-pointer hover:bg-white dark:hover:bg-slate-800 transition-colors group select-none"
                >
                  <div className="flex items-center gap-2">Decreto <SortIcon field="acto" /></div>
                </th>
                <th
                  onClick={() => handleSort('funcionario')}
                  className="px-2 sm:px-3 py-4 sm:py-6 text-[10px] sm:text-[11px] font-black uppercase tracking-wider sm:tracking-[0.2em] text-slate-400 dark:text-slate-500 cursor-pointer hover:bg-white dark:hover:bg-slate-800 transition-colors group select-none"
                >
                  <div className="flex items-center gap-2">Funcionario <SortIcon field="funcionario" /></div>
                </th>
                <th
                  onClick={() => handleSort('solicitudType')}
                  className="px-2 sm:px-3 py-4 sm:py-6 text-[10px] sm:text-[11px] font-black uppercase tracking-wider sm:tracking-[0.2em] text-slate-400 dark:text-slate-500 cursor-pointer hover:bg-white dark:hover:bg-slate-800 transition-colors group select-none hidden sm:table-cell"
                >
                  <div className="flex items-center gap-2">Tipo <SortIcon field="solicitudType" /></div>
                </th>
                {(activeTab === 'FL' || activeTab === 'ALL') && (
                  <th
                    className="px-2 sm:px-3 py-4 sm:py-6 text-[10px] sm:text-[11px] font-black uppercase tracking-wider sm:tracking-[0.2em] text-slate-400 dark:text-slate-500 hidden md:table-cell"
                  >
                    <div className="flex items-center gap-2">Período</div>
                  </th>
                )}
                <th
                  onClick={() => handleSort('cantidadDias')}
                  className="px-2 sm:px-3 py-4 sm:py-6 text-[10px] sm:text-[11px] font-black uppercase tracking-wider sm:tracking-[0.2em] text-slate-400 dark:text-slate-500 cursor-pointer hover:bg-white dark:hover:bg-slate-800 transition-colors group select-none"
                >
                  <div className="flex items-center gap-2">Días <SortIcon field="cantidadDias" /></div>
                </th>
                <th
                  onClick={() => handleSort('saldo')}
                  className="px-2 sm:px-3 py-4 sm:py-6 text-[10px] sm:text-[11px] font-black uppercase tracking-wider sm:tracking-[0.2em] text-slate-400 dark:text-slate-500 cursor-pointer hover:bg-white dark:hover:bg-slate-800 transition-colors group select-none hidden sm:table-cell"
                >
                  <div className="flex items-center gap-2">Saldo <SortIcon field="saldo" /></div>
                </th>
                <th
                  onClick={() => handleSort('fechaInicio')}
                  className="px-2 sm:px-3 py-4 sm:py-6 text-[10px] sm:text-[11px] font-black uppercase tracking-wider sm:tracking-[0.2em] text-slate-400 dark:text-slate-500 cursor-pointer hover:bg-white dark:hover:bg-slate-800 transition-colors group select-none hidden sm:table-cell"
                >
                  <div className="flex items-center gap-2">Inicio <SortIcon field="fechaInicio" /></div>
                </th>
                {(activeTab === 'FL' || activeTab === 'ALL') && (
                  <th
                    className="px-2 sm:px-3 py-4 sm:py-6 text-[10px] sm:text-[11px] font-black uppercase tracking-wider sm:tracking-[0.2em] text-slate-400 dark:text-slate-500 hidden lg:table-cell"
                  >
                    <div className="flex items-center gap-2">Término</div>
                  </th>
                )}
                <th
                  onClick={() => handleSort('fechaDecreto')}
                  className="px-2 sm:px-3 py-4 sm:py-6 text-[10px] sm:text-[11px] font-black uppercase tracking-wider sm:tracking-[0.2em] text-slate-400 dark:text-slate-500 cursor-pointer hover:bg-white dark:hover:bg-slate-800 transition-colors group select-none hidden lg:table-cell"
                >
                  <div className="flex items-center gap-2">Emisión <SortIcon field="fechaDecreto" /></div>
                </th>
                <th className="pl-2 sm:pl-3 pr-4 sm:pr-8 py-4 sm:py-6 text-[10px] sm:text-[11px] font-black uppercase tracking-wider sm:tracking-[0.2em] text-slate-400 dark:text-slate-500 text-right">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 dark:divide-slate-700/50">
              {paginatedData.map(record => {
                const isSelected = selectedIds.has(record.id);
                return (
                  <tr
                    key={record.id}
                    className={`hover:bg-indigo-50/20 dark:hover:bg-indigo-900/10 transition-all group/row ${isSelected ? 'bg-indigo-50/40 dark:bg-indigo-900/20' : ''}`}
                  >
                    {/* ★ Checkbox de selección individual */}
                    <td className="pl-4 sm:pl-6 py-4 sm:py-5 w-10">
                      <button
                        onClick={(e) => { e.stopPropagation(); toggleSelect(record.id); }}
                        className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors"
                      >
                        {isSelected ? (
                          <CheckSquare size={18} className="text-indigo-600 dark:text-indigo-400" />
                        ) : (
                          <Square size={18} className="text-slate-300 dark:text-slate-600 hover:text-slate-400" />
                        )}
                      </button>
                    </td>
                    <td className="pr-2 sm:pr-3 py-4 sm:py-5">
                      <div className="flex flex-col">
                        <span className="font-black text-indigo-600 dark:text-indigo-400 text-sm sm:text-[13px] tracking-tight">{record.acto}</span>
                        <span className="text-[9px] sm:text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-tighter truncate max-w-[100px]">{record.materia}</span>
                      </div>
                    </td>
                    <td className="px-2 sm:px-3 py-4 sm:py-5">
                      <div className="flex items-center gap-2 sm:gap-3">
                        <div className="hidden sm:flex w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-slate-100 dark:bg-slate-700 items-center justify-center text-slate-300 dark:text-slate-500 group-hover/row:bg-white dark:group-hover/row:bg-slate-600 group-hover/row:shadow-sm transition-all">
                          <UserCircle size={20} className="sm:hidden" />
                          <UserCircle size={22} className="hidden sm:block" />
                        </div>
                        <div className="flex flex-col min-w-0">
                          <p className="text-[11px] sm:text-xs font-black text-slate-800 dark:text-white uppercase tracking-tight truncate max-w-[120px] sm:max-w-[150px] lg:max-w-xs">
                            {record.funcionario}
                          </p>
                          <p className="text-[9px] sm:text-[10px] font-bold text-slate-400 dark:text-slate-500 font-mono tracking-tighter">
                            {record.rut}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-2 sm:px-3 py-4 sm:py-5 hidden sm:table-cell">
                      <span className={`px-2 sm:px-3 py-1 rounded-lg text-[9px] sm:text-[10px] font-black uppercase tracking-wider sm:tracking-widest border shadow-sm ${record.solicitudType === 'PA'
                        ? 'bg-indigo-50 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 border-indigo-100 dark:border-indigo-800'
                        : 'bg-amber-50 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 border-amber-100 dark:border-amber-800'
                        }`}>
                        {record.solicitudType}
                      </span>
                    </td>
                    {(activeTab === 'FL' || activeTab === 'ALL') && (
                      <td className="px-2 sm:px-3 py-4 sm:py-5 hidden md:table-cell">
                        {record.solicitudType === 'FL' ? (
                          <div className="flex flex-col gap-1">
                            {record.periodo1 && (
                              <span className="px-1.5 py-0.5 rounded text-[8px] sm:text-[9px] font-black tracking-wide bg-sky-50 dark:bg-sky-900/40 text-sky-700 dark:text-sky-300 border border-sky-100 dark:border-sky-800 whitespace-nowrap">
                                {record.periodo1}
                              </span>
                            )}
                            {record.periodo2 && (
                              <span className="px-1.5 py-0.5 rounded text-[8px] sm:text-[9px] font-black tracking-wide bg-purple-50 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 border border-purple-100 dark:border-purple-800 whitespace-nowrap">
                                {record.periodo2}
                              </span>
                            )}
                            {!record.periodo1 && !record.periodo2 && (
                              <span className="text-[10px] text-slate-400">-</span>
                            )}
                          </div>
                        ) : (
                          <span className="text-[10px] text-slate-400">-</span>
                        )}
                      </td>
                    )}
                    <td className="px-2 sm:px-3 py-4 sm:py-5">
                      <div className="flex items-center gap-1 sm:gap-2">
                        <span className="font-black text-slate-700 dark:text-slate-200 text-sm sm:text-[13px]">{record.cantidadDias}</span>
                        <span className="text-[8px] sm:text-[9px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-tighter hidden lg:inline">DÍAS</span>
                      </div>
                    </td>
                    <td className="px-2 sm:px-3 py-4 sm:py-5 hidden sm:table-cell">
                      <span className={`font-black text-sm sm:text-[13px] ${(record.diasHaber - record.cantidadDias) < 0
                        ? 'text-red-500 dark:text-red-400'
                        : 'text-emerald-600 dark:text-emerald-400'
                        }`}>
                        {(record.diasHaber - record.cantidadDias).toFixed(1)}
                      </span>
                    </td>
                    <td className="px-2 sm:px-3 py-4 sm:py-5 hidden sm:table-cell">
                      <span className="text-[11px] sm:text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-tight truncate whitespace-nowrap">
                        {formatNumericDate(record.fechaInicio)}
                      </span>
                    </td>
                    {(activeTab === 'FL' || activeTab === 'ALL') && (
                      <td className="px-2 sm:px-3 py-4 sm:py-5 hidden lg:table-cell">
                        <span className="text-[11px] sm:text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-tight truncate whitespace-nowrap">
                          {record.fechaTermino ? formatNumericDate(record.fechaTermino) : '-'}
                        </span>
                      </td>
                    )}
                    <td className="px-2 sm:px-3 py-4 sm:py-5 hidden lg:table-cell">
                      <span className="text-[11px] sm:text-xs font-bold text-indigo-500 dark:text-indigo-400 uppercase tracking-tight truncate whitespace-nowrap">
                        {record.fechaDecreto ? formatNumericDate(record.fechaDecreto) : '-'}
                      </span>
                    </td>
                    <td className="pl-2 sm:pl-3 pr-4 sm:pr-8 py-4 sm:py-5 text-right">
                      <div className="flex justify-end">
                        <ActionMenu
                          record={record}
                          onEdit={canEdit ? onEdit : undefined}
                          onDelete={canDelete ? onDelete : undefined}
                          onGeneratePDF={handleGeneratePDF}
                          onPreview={handlePreview}
                        />
                      </div>
                    </td>
                  </tr>
                );
              })}
              {paginatedData.length === 0 && (
                <tr>
                  <td colSpan={10} className="px-6 sm:px-10 py-16 sm:py-24 text-center">
                    <div className="flex flex-col items-center gap-4 opacity-20">
                      <LayoutGrid size={40} />
                      <p className="text-[10px] sm:text-[11px] font-black uppercase tracking-[0.3em] sm:tracking-[0.4em]">
                        Sin registros que mostrar
                      </p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Paginación */}
        {totalPages > 1 && (
          <div className="px-4 sm:px-8 py-4 sm:py-6 border-t border-slate-100 dark:border-slate-700">
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              totalItems={totalItems}
              itemsPerPage={CONFIG.ITEMS_PER_PAGE}
              onPageChange={setCurrentPage}
            />
          </div>
        )}
      </div>

      {/* Hint para móvil */}
      <p className="text-[9px] sm:text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider sm:tracking-widest text-center">
        {totalItems > 0
          ? `${totalItems} registro${totalItems !== 1 ? 's' : ''} encontrado${totalItems !== 1 ? 's' : ''}`
          : 'Desliza para ver más detalles en dispositivos móviles'
        }
      </p>

      {/* Modal de Previsualización */}
      <DecreePreviewModal
        isOpen={previewRecord !== null}
        onClose={handleClosePreview}
        record={previewRecord}
        onConfirm={handleConfirmPreview}
      />
    </div>
  );
};

export default memo(PermitTable);
