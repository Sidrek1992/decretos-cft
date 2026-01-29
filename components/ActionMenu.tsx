import React, { useState, useRef, useEffect } from 'react';
import { MoreVertical, FileDown, FilePen, Edit2, Trash, Eye } from 'lucide-react';
import { PermitRecord } from '../types';

interface ActionMenuProps {
    record: PermitRecord;
    onEdit: (record: PermitRecord) => void;
    onDelete: (id: string) => void;
    onGeneratePDF: (record: PermitRecord, forcePdf: boolean) => void;
    onPreview?: (record: PermitRecord) => void;
}

const ActionMenu: React.FC<ActionMenuProps> = ({ record, onEdit, onDelete, onGeneratePDF, onPreview }) => {
    const [isOpen, setIsOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const actions = [
        ...(onPreview ? [{
            icon: Eye,
            label: 'Previsualizar',
            onClick: () => onPreview(record),
            color: 'text-purple-600 dark:text-purple-400',
            bg: 'hover:bg-purple-50 dark:hover:bg-purple-900/30'
        }] : []),
        {
            icon: FileDown,
            label: 'Ver PDF',
            onClick: () => onGeneratePDF(record, true),
            color: 'text-rose-600 dark:text-rose-400',
            bg: 'hover:bg-rose-50 dark:hover:bg-rose-900/30'
        },
        {
            icon: FilePen,
            label: 'Abrir en Drive',
            onClick: () => onGeneratePDF(record, false),
            color: 'text-sky-600 dark:text-sky-400',
            bg: 'hover:bg-sky-50 dark:hover:bg-sky-900/30'
        },
        {
            icon: Edit2,
            label: 'Modificar',
            onClick: () => onEdit(record),
            color: 'text-amber-600 dark:text-amber-400',
            bg: 'hover:bg-amber-50 dark:hover:bg-amber-900/30'
        },
        {
            icon: Trash,
            label: 'Eliminar',
            onClick: () => onDelete(record.id),
            color: 'text-red-600 dark:text-red-400',
            bg: 'hover:bg-red-50 dark:hover:bg-red-900/30',
            divider: true
        }
    ];

    return (
        <div className="relative" ref={menuRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="p-2.5 bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-600 transition-all active:scale-90"
            >
                <MoreVertical size={16} />
            </button>

            {isOpen && (
                <div className="absolute right-0 top-full mt-2 w-48 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-2xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                    {actions.map((action, index) => (
                        <React.Fragment key={index}>
                            {action.divider && (
                                <div className="border-t border-slate-100 dark:border-slate-700 my-1" />
                            )}
                            <button
                                onClick={() => {
                                    action.onClick();
                                    setIsOpen(false);
                                }}
                                className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${action.bg}`}
                            >
                                <action.icon className={`w-4 h-4 ${action.color}`} />
                                <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                                    {action.label}
                                </span>
                            </button>
                        </React.Fragment>
                    ))}
                </div>
            )}
        </div>
    );
};

export default ActionMenu;
