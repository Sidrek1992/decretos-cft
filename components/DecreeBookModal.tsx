import React, { useState, useMemo } from 'react';
import { PermitRecord } from '../types';
import { X, FileText, Download, Calendar, Printer } from 'lucide-react';
import { formatNumericDate } from '../utils/formatters';

interface DecreeBookModalProps {
    isOpen: boolean;
    onClose: () => void;
    records: PermitRecord[];
}

const DecreeBookModal: React.FC<DecreeBookModalProps> = ({ isOpen, onClose, records }) => {
    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth();

    const [selectedYear, setSelectedYear] = useState(currentYear);
    const [selectedMonth, setSelectedMonth] = useState(currentMonth);
    const [selectedType, setSelectedType] = useState<'ALL' | 'PA' | 'FL'>('ALL');

    const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    const years = useMemo(() => {
        const s = new Set<number>([currentYear]);
        records.forEach(r => r.fechaDecreto && s.add(new Date(r.fechaDecreto).getFullYear()));
        return Array.from(s).sort((a, b) => b - a);
    }, [records, currentYear]);

    const filteredRecords = useMemo(() => {
        return records.filter(r => {
            if (!r.fechaDecreto) return false;
            const d = new Date(r.fechaDecreto);
            return d.getFullYear() === selectedYear && d.getMonth() === selectedMonth &&
                (selectedType === 'ALL' || r.solicitudType === selectedType);
        }).sort((a, b) => (parseInt(a.acto) || 0) - (parseInt(b.acto) || 0));
    }, [records, selectedYear, selectedMonth, selectedType]);

    const handlePrint = () => {
        const w = window.open('', '_blank');
        if (!w) return;
        const html = `<!DOCTYPE html><html><head><title>Libro ${months[selectedMonth]} ${selectedYear}</title>
      <style>body{font-family:system-ui;font-size:11px}h1{text-align:center}table{width:100%;border-collapse:collapse}
      th{background:#1e293b;color:#fff;padding:8px;text-align:left;font-size:9px}td{padding:6px;border-bottom:1px solid #e2e8f0}</style></head>
      <body><h1>Libro de Decretos - ${months[selectedMonth]} ${selectedYear}</h1>
      <table><tr><th>N°</th><th>Tipo</th><th>Funcionario</th><th>RUT</th><th>Días</th><th>Fecha</th><th>Saldo</th></tr>
      ${filteredRecords.map(r => `<tr><td>${r.acto}</td><td>${r.solicitudType}</td><td>${r.funcionario}</td><td>${r.rut}</td>
      <td>${r.cantidadDias}</td><td>${formatNumericDate(r.fechaInicio)}</td><td>${(r.diasHaber - r.cantidadDias).toFixed(1)}</td></tr>`).join('')}
      </table></body></html>`;
        w.document.write(html);
        w.document.close();
        setTimeout(() => w.print(), 300);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4" onClick={onClose}>
            <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" />
            <div className="relative w-full max-w-3xl max-h-[85vh] bg-white dark:bg-slate-800 rounded-2xl sm:rounded-3xl shadow-2xl overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
                <div className="bg-gradient-to-r from-indigo-600 to-purple-600 p-4 sm:p-6 text-white flex items-center justify-between">
                    <div className="flex items-center gap-2 sm:gap-3">
                        <FileText className="w-5 h-5 sm:w-6 sm:h-6" />
                        <div>
                            <h2 className="text-base sm:text-lg font-bold">Libro de Decretos</h2>
                            <p className="text-[10px] sm:text-xs opacity-80">Resumen mensual</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-white/20 rounded-xl"><X /></button>
                </div>
                <div className="p-3 sm:p-4 border-b border-slate-200 dark:border-slate-700 flex flex-wrap gap-2 sm:gap-3 items-center">
                    <select value={selectedYear} onChange={e => setSelectedYear(+e.target.value)} className="px-2 sm:px-3 py-1.5 sm:py-2 bg-slate-50 dark:bg-slate-700 border rounded-xl text-xs sm:text-sm font-bold">
                        {years.map(y => <option key={y} value={y}>{y}</option>)}
                    </select>
                    <select value={selectedMonth} onChange={e => setSelectedMonth(+e.target.value)} className="px-2 sm:px-3 py-1.5 sm:py-2 bg-slate-50 dark:bg-slate-700 border rounded-xl text-xs sm:text-sm font-bold">
                        {months.map((m, i) => <option key={i} value={i}>{m}</option>)}
                    </select>
                    <div className="flex gap-1 bg-slate-100 dark:bg-slate-700 p-1 rounded-lg">
                        {(['ALL', 'PA', 'FL'] as const).map(t => (
                            <button key={t} onClick={() => setSelectedType(t)} className={`px-2 sm:px-3 py-1 sm:py-1.5 rounded text-[10px] sm:text-xs font-bold ${selectedType === t ? 'bg-white dark:bg-slate-600 text-indigo-600' : 'text-slate-500'}`}>
                                {t === 'ALL' ? 'Todos' : t}
                            </button>
                        ))}
                    </div>
                    <div className="flex-1" />
                    <button onClick={handlePrint} disabled={!filteredRecords.length} className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1.5 sm:py-2 bg-indigo-600 text-white rounded-xl text-xs sm:text-sm font-bold disabled:opacity-50">
                        <Printer size={14} className="sm:hidden" /><Printer size={16} className="hidden sm:block" /> Imprimir
                    </button>
                </div>
                <div className="flex-1 overflow-y-auto p-4">
                    {filteredRecords.length === 0 ? (
                        <div className="py-12 text-center text-slate-400"><Calendar className="w-10 h-10 mx-auto mb-3" />Sin decretos</div>
                    ) : (
                        <div className="grid grid-cols-3 gap-3 mb-4 text-center">
                            <div className="bg-slate-50 dark:bg-slate-700 rounded-xl p-3"><p className="text-xl font-bold">{filteredRecords.length}</p><p className="text-[10px] text-slate-400">Decretos</p></div>
                            <div className="bg-slate-50 dark:bg-slate-700 rounded-xl p-3"><p className="text-xl font-bold">{filteredRecords.reduce((a, r) => a + r.cantidadDias, 0)}</p><p className="text-[10px] text-slate-400">Días</p></div>
                            <div className="bg-slate-50 dark:bg-slate-700 rounded-xl p-3"><p className="text-xl font-bold">{new Set(filteredRecords.map(r => r.rut)).size}</p><p className="text-[10px] text-slate-400">Funcionarios</p></div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default DecreeBookModal;
