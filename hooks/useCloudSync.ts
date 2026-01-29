import React, { useState, useEffect, useCallback, useRef } from 'react';
import { PermitRecord, SolicitudType } from '../types';
import { CONFIG } from '../config';
import { formatLongDate } from '../utils/formatters';

// Función para parsear fechas del Sheet (formato: "martes, 06 de enero de 2026" o "06 de enero de 2026")
const parseDateFromSheet = (dateStr: string): string => {
    if (!dateStr) return '';

    // Si ya está en formato ISO (YYYY-MM-DD), devolverlo
    if (/^\d{4}-\d{2}-\d{2}/.test(dateStr)) {
        return dateStr.split('T')[0];
    }

    const numericMatch = dateStr.trim().match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/);
    if (numericMatch) {
        const dia = numericMatch[1].padStart(2, '0');
        const mes = numericMatch[2].padStart(2, '0');
        const año = numericMatch[3];
        return `${año}-${mes}-${dia}`;
    }

    const meses: Record<string, string> = {
        'enero': '01', 'febrero': '02', 'marzo': '03', 'abril': '04',
        'mayo': '05', 'junio': '06', 'julio': '07', 'agosto': '08',
        'septiembre': '09', 'octubre': '10', 'noviembre': '11', 'diciembre': '12'
    };

    // Extraer día, mes, año del formato "martes, 06 de enero de 2026" o "06 de enero de 2026"
    const match = dateStr.match(/(\d{1,2})\s+de\s+(\w+)\s+de\s+(\d{4})/i);
    if (match) {
        const dia = match[1].padStart(2, '0');
        const mes = meses[match[2].toLowerCase()] || '01';
        const año = match[3];
        return `${año}-${mes}-${dia}`;
    }

    return '';
};

const parseActoNumber = (acto: string): number | null => {
    const num = parseInt(acto.split('/')[0], 10);
    return Number.isNaN(num) ? null : num;
};

const parseActoNumberFromRow = (row: unknown[]): number | null => {
    const materiaCandidate = parseActoNumber(String(row?.[2] || ''));
    if (materiaCandidate !== null) return materiaCandidate;
    const actoCandidate = parseActoNumber(String(row?.[3] || ''));
    if (actoCandidate !== null) return actoCandidate;
    return parseActoNumber(String(row?.[1] || ''));
};

const shouldReverseRows = (rows: unknown[][]): boolean => {
    if (rows.length < 2) return false;

    const first = rows[0];
    const last = rows[rows.length - 1];

    const firstDate = parseDateFromSheet(String(first?.[11] || ''));
    const lastDate = parseDateFromSheet(String(last?.[11] || ''));
    if (firstDate && lastDate) {
        return firstDate > lastDate;
    }

    const firstActo = parseActoNumberFromRow(first || []);
    const lastActo = parseActoNumberFromRow(last || []);
    if (firstActo !== null && lastActo !== null) {
        return firstActo > lastActo;
    }

    return false;
};

const normalizeSolicitudType = (value: string): SolicitudType | null => {
    const upper = value.trim().toUpperCase();
    if (upper === 'FL') return 'FL';
    if (upper === 'PA') return 'PA';
    return null;
};

const resolveSolicitudType = (...values: string[]): SolicitudType => {
    for (const value of values) {
        const normalized = normalizeSolicitudType(value);
        if (normalized) return normalized;
    }
    return 'PA';
};

const looksLikeCorrelative = (value: string): boolean => {
    const trimmed = value.trim();
    if (!trimmed) return false;
    if (/^\d{1,4}\s*\/\s*\d{4}$/.test(trimmed)) return true;
    return /^\d{1,4}$/.test(trimmed);
};

const resolveActoMateria = (materiaCell: string, actoCell: string) => {
    const materiaValue = materiaCell.trim();
    const actoValue = actoCell.trim();
    const materiaIsCorrelative = looksLikeCorrelative(materiaValue);
    const actoIsCorrelative = looksLikeCorrelative(actoValue);
    const actoIsSolicitudType = normalizeSolicitudType(actoValue) !== null;
    const materiaIsSolicitudType = normalizeSolicitudType(materiaValue) !== null;

    const defaultMateria = 'Decreto Exento';

    if (materiaIsCorrelative && !actoIsCorrelative) {
        return { acto: materiaValue, materia: actoIsSolicitudType ? defaultMateria : (actoValue || defaultMateria) };
    }
    if (actoIsCorrelative && !materiaIsCorrelative) {
        return { acto: actoValue, materia: materiaIsSolicitudType ? defaultMateria : (materiaValue || defaultMateria) };
    }
    if (materiaIsCorrelative && actoIsCorrelative) {
        return { acto: materiaValue, materia: defaultMateria };
    }

    if (actoIsSolicitudType && !materiaIsSolicitudType) {
        return { acto: materiaValue || actoValue, materia: materiaValue || defaultMateria };
    }
    if (materiaIsSolicitudType && !actoIsSolicitudType) {
        return { acto: actoValue || materiaValue, materia: actoValue || defaultMateria };
    }

    return {
        acto: materiaValue || actoValue,
        materia: actoValue || materiaValue || defaultMateria
    };
};

const normalizeJornada = (value: string): string => {
    const cleaned = value.replace(/[()]/g, '').trim();
    if (!cleaned) return 'Jornada completa';

    const lower = cleaned.toLowerCase();
    if (lower.includes('manana') || lower.includes('mañana')) return 'Jornada mañana';
    if (lower.includes('tarde')) return 'Jornada tarde';
    if (lower.includes('completa')) return 'Jornada completa';

    return cleaned;
};

const JORNADA_VALUES = ['Jornada mañana', 'Jornada tarde', 'Jornada completa'];

const normalizeDateValue = (value: string): string => {
    return parseDateFromSheet(String(value || ''));
};

const normalizeNumberValue = (value: string | number, fallback: number): number => {
    const num = typeof value === 'number'
        ? value
        : parseFloat(String(value || '').replace(',', '.'));
    return Number.isNaN(num) ? fallback : num;
};

const normalizePeriodoValue = (value: string): string => {
    const trimmed = value.trim();
    if (/^\d{4}$/.test(trimmed)) return trimmed;
    return new Date().getFullYear().toString();
};

interface UseCloudSyncReturn {
    records: PermitRecord[];
    setRecords: React.Dispatch<React.SetStateAction<PermitRecord[]>>;
    isSyncing: boolean;
    syncError: boolean;
    lastSync: Date | null;
    isOnline: boolean;
    syncWarnings: string[];
    pendingSync: boolean;
    isRetryScheduled: boolean;
    fetchFromCloud: () => Promise<void>;
    syncToCloud: (data: PermitRecord[]) => Promise<boolean>;
    undoStack: PermitRecord[][];
    undo: () => void;
    canUndo: boolean;
}

export const useCloudSync = (
    onSyncSuccess?: () => void,
    onSyncError?: (error: string) => void
): UseCloudSyncReturn => {
    const [records, setRecords] = useState<PermitRecord[]>([]);
    const [isSyncing, setIsSyncing] = useState(false);
    const [syncError, setSyncError] = useState(false);
    const [lastSync, setLastSync] = useState<Date | null>(null);
    const [isOnline, setIsOnline] = useState(navigator.onLine);
    const [undoStack, setUndoStack] = useState<PermitRecord[][]>([]);
    const [syncWarnings, setSyncWarnings] = useState<string[]>([]);
    const [pendingSync, setPendingSync] = useState(false);
    const [isRetryScheduled, setIsRetryScheduled] = useState(false);

    const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const pendingDataRef = useRef<PermitRecord[] | null>(null);

    // Manejar estado de conexión
    useEffect(() => {
        const handleOnline = () => setIsOnline(true);
        const handleOffline = () => setIsOnline(false);

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
            if (retryTimeoutRef.current) {
                clearTimeout(retryTimeoutRef.current);
            }
        };
    }, []);

    // Cargar datos iniciales desde la nube
    useEffect(() => {
        fetchFromCloud();
    }, []);



    // Parser para registros PA (Permisos Administrativos)
    // Estructura: #, Decreto(PA), Materia(N°Acto), Acto, Funcionario, RUT, Periodo, CantDías, FechaInicio, TipoJornada, DíasHaber, FechaDecreto, Saldo, RA, Emite
    const parsePARecords = (data: unknown[][]): { records: PermitRecord[]; warnings: string[] } => {
        const warnings: string[] = [];
        const rawRows = data.filter((row: unknown[]) => row && row[4]); // Filtrar filas sin funcionario
        const normalizedRows = shouldReverseRows(rawRows) ? [...rawRows].reverse() : rawRows;
        const totalRows = normalizedRows.length;

        const records: PermitRecord[] = normalizedRows.map((row: unknown[], index: number) => {
            const rowLabel = `[PA] Fila ${index + 2}`;
            const materiaCell = String(row[2] || '');
            const actoCell = String(row[3] || '');
            const solicitudCell = String(row[1] || '');
            const fechaInicioRaw = String(row[8] || '');
            const fechaDecretoRaw = String(row[11] || '');
            const tipoJornadaRaw = String(row[9] || '');
            const cantidadDiasRaw = String(row[7] || '');
            const diasHaberRaw = String(row[10] || '');
            const periodoRaw = String(row[6] || '');

            const fechaInicio = normalizeDateValue(fechaInicioRaw);
            const fechaDecreto = normalizeDateValue(fechaDecretoRaw);
            const resolved = resolveActoMateria(materiaCell, actoCell);
            const tipoJornada = normalizeJornada(tipoJornadaRaw);
            const cantidadDias = normalizeNumberValue(cantidadDiasRaw, 0);
            const diasHaber = normalizeNumberValue(diasHaberRaw, 0);
            const periodo = normalizePeriodoValue(periodoRaw);

            if (!normalizeSolicitudType(solicitudCell) && !normalizeSolicitudType(materiaCell) && !normalizeSolicitudType(actoCell)) {
                warnings.push(`${rowLabel}: tipo de solicitud inválido`);
            }
            if (fechaInicioRaw && !fechaInicio) {
                warnings.push(`${rowLabel}: Fecha de inicio inválida (${fechaInicioRaw})`);
            }
            if (fechaDecretoRaw && !fechaDecreto) {
                warnings.push(`${rowLabel}: Fecha inválida (${fechaDecretoRaw})`);
            }
            if (tipoJornadaRaw && !JORNADA_VALUES.includes(tipoJornada)) {
                warnings.push(`${rowLabel}: Tipo de jornada inválido (${tipoJornadaRaw})`);
            }

            return {
                id: `PA-${String(row[0]) || index}-${Date.now()}`,
                acto: resolved.acto,
                solicitudType: 'PA' as SolicitudType,
                materia: resolved.materia,
                funcionario: String(row[4] || '').trim(),
                rut: String(row[5] || '').trim(),
                periodo,
                cantidadDias,
                fechaInicio,
                tipoJornada: JORNADA_VALUES.includes(tipoJornada) ? tipoJornada : 'Jornada completa',
                diasHaber,
                fechaDecreto,
                ra: String(row[13] || 'MGA'),
                emite: String(row[14] || 'mga'),
                observaciones: '',
                createdAt: Date.now() - ((totalRows - 1 - index) * 1000),
                decreto: ''
            };
        });

        return { records, warnings };
    };

    // Parser para registros FL (Feriados Legales)
    // Estructura: #, Decreto(N°Acto), Materia(FL), Acto, Funcionario, RUT, DíasSolicitados, 
    //             Periodo1, SaldoDispP1, SolicitadoP1, SaldoFinalP1,
    //             Periodo2, SaldoDispP2, SolicitadoP2, SaldoFinalP2,
    //             FechaInicio, FechaTermino, FechaEmision, RA, Emite, Observaciones
    const parseFLRecords = (data: unknown[][]): { records: PermitRecord[]; warnings: string[] } => {
        const warnings: string[] = [];
        const rawRows = data.filter((row: unknown[]) => row && row[4]); // Filtrar filas sin funcionario
        const totalRows = rawRows.length;

        const records: PermitRecord[] = rawRows.map((row: unknown[], index: number) => {
            const rowLabel = `[FL] Fila ${index + 2}`;
            
            // Columnas específicas de FL (con RUT en posición 5)
            const actoRaw = String(row[1] || '').trim();  // N° Acto está en columna 1
            const funcionario = String(row[4] || '').trim();
            const rut = String(row[5] || '').trim();      // RUT en columna 5
            const cantidadDiasRaw = String(row[6] || '');
            const periodo1Raw = String(row[7] || '').trim();
            const saldoDispP1Raw = String(row[8] || '');
            const solicitadoP1Raw = String(row[9] || '');
            const saldoFinalP1Raw = String(row[10] || '');
            const periodo2Raw = String(row[11] || '').trim();
            const saldoDispP2Raw = String(row[12] || '');
            const solicitadoP2Raw = String(row[13] || '');
            const saldoFinalP2Raw = String(row[14] || '');
            const fechaInicioRaw = String(row[15] || '');
            const fechaTerminoRaw = String(row[16] || '');
            const fechaEmisionRaw = String(row[17] || '');
            const ra = String(row[18] || 'MGA').trim();
            const emite = String(row[19] || 'mga').trim();
            const observaciones = String(row[20] || '').trim();

            const fechaInicio = normalizeDateValue(fechaInicioRaw);
            const fechaTermino = normalizeDateValue(fechaTerminoRaw);
            const fechaDecreto = normalizeDateValue(fechaEmisionRaw);
            const cantidadDias = normalizeNumberValue(cantidadDiasRaw, 0);
            const saldoDisponibleP1 = normalizeNumberValue(saldoDispP1Raw, 0);
            const solicitadoP1 = normalizeNumberValue(solicitadoP1Raw, 0);
            const saldoFinalP1 = normalizeNumberValue(saldoFinalP1Raw, 0);
            const saldoDisponibleP2 = normalizeNumberValue(saldoDispP2Raw, 0);
            const solicitadoP2 = normalizeNumberValue(solicitadoP2Raw, 0);
            const saldoFinalP2 = normalizeNumberValue(saldoFinalP2Raw, 0);

            // Calcular días haber total (suma de saldos disponibles de ambos períodos)
            const diasHaber = saldoDisponibleP1 + saldoDisponibleP2;

            if (fechaInicioRaw && !fechaInicio) {
                warnings.push(`${rowLabel}: Fecha de inicio inválida (${fechaInicioRaw})`);
            }
            if (fechaTerminoRaw && !fechaTermino) {
                warnings.push(`${rowLabel}: Fecha de término inválida (${fechaTerminoRaw})`);
            }
            if (!actoRaw) {
                warnings.push(`${rowLabel}: N° Acto Adm. vacío`);
            }

            return {
                id: `FL-${String(row[0]) || index}-${Date.now()}`,
                acto: actoRaw,
                solicitudType: 'FL' as SolicitudType,
                materia: 'Decreto Exento',
                funcionario,
                rut,
                periodo: new Date().getFullYear().toString(),
                cantidadDias,
                fechaInicio,
                fechaTermino,
                tipoJornada: 'Jornada completa',
                diasHaber,
                fechaDecreto,
                ra,
                emite,
                observaciones,
                // Campos específicos de FL para períodos
                periodo1: periodo1Raw,
                saldoDisponibleP1,
                solicitadoP1,
                saldoFinalP1,
                periodo2: periodo2Raw,
                saldoDisponibleP2,
                solicitadoP2,
                saldoFinalP2,
                createdAt: Date.now() - ((totalRows - 1 - index) * 1000),
                decreto: ''
            };
        });

        return { records, warnings };
    };

    const fetchFromCloud = useCallback(async () => {
        if (!navigator.onLine) return;

        setIsSyncing(true);
        setSyncError(false);

        try {
            // Fetch de ambos Sheets en paralelo: PA (Decretos) y FL (Feriados)
            const [paResponse, flResponse] = await Promise.all([
                fetch(`${CONFIG.WEB_APP_URL}?sheetId=${CONFIG.DECRETOS_SHEET_ID}`),
                fetch(`${CONFIG.WEB_APP_URL_FL}?sheetId=${CONFIG.FERIADOS_SHEET_ID}`)
            ]);

            const [paResult, flResult] = await Promise.all([
                paResponse.json(),
                flResponse.json()
            ]);

            const allWarnings: string[] = [];
            let allRecords: PermitRecord[] = [];

            // Procesar registros PA
            if (paResult.success && paResult.data) {
                const { records: paRecords, warnings: paWarnings } = parsePARecords(paResult.data);
                allRecords = [...allRecords, ...paRecords];
                allWarnings.push(...paWarnings);
            }

            // Procesar registros FL (estructura diferente)
            if (flResult.success && flResult.data) {
                const { records: flRecords, warnings: flWarnings } = parseFLRecords(flResult.data);
                allRecords = [...allRecords, ...flRecords];
                allWarnings.push(...flWarnings);
            }

            // Ordenar por fecha de creación (más recientes primero)
            allRecords.sort((a, b) => b.createdAt - a.createdAt);

            setRecords(allRecords);
            setSyncWarnings(allWarnings.slice(0, 20));
            setLastSync(new Date());
            onSyncSuccess?.();
        } catch (e) {
            console.error("Error al recuperar datos de la nube:", e);
            setSyncError(true);
            onSyncError?.("Error al conectar con la nube");
        } finally {
            setIsSyncing(false);
        }
    }, [onSyncSuccess, onSyncError]);

    // Preparar datos PA para envío
    // Estructura: #, Decreto(PA), Materia(N°Acto), Acto, Funcionario, RUT, Periodo, CantDías, FechaInicio, TipoJornada, DíasHaber, FechaDecreto, Saldo, RA, Emite
    const preparePADataForSync = (records: PermitRecord[]): { data: unknown[][]; warnings: string[] } => {
        const warnings: string[] = [];
        const filteredRecords = records.filter(r => r.solicitudType === 'PA');

        const data = filteredRecords.map((record, index) => {
            const rowLabel = `[PA] Registro ${index + 1}`;
            const funcionario = String(record.funcionario || '').trim();
            const rut = String(record.rut || '').trim();
            const acto = String(record.acto || '').trim();
            const periodo = normalizePeriodoValue(String(record.periodo || ''));
            const cantidadDias = normalizeNumberValue(record.cantidadDias, 0);
            const diasHaber = normalizeNumberValue(record.diasHaber, 0);
            const fechaInicio = normalizeDateValue(String(record.fechaInicio || ''));
            const fechaDecretoParsed = normalizeDateValue(String(record.fechaDecreto || ''));
            const fechaDecreto = fechaDecretoParsed || new Date().toISOString().split('T')[0];
            const tipoJornada = normalizeJornada(String(record.tipoJornada || ''));

            if (!funcionario) warnings.push(`${rowLabel}: Funcionario vacío`);
            if (!rut) warnings.push(`${rowLabel}: RUT vacío`);
            if (!acto) warnings.push(`${rowLabel}: N° Acto Adm. vacío`);

            return [
                index + 1,                  // #
                'PA',                       // Decreto
                acto,                       // Materia (N° Acto)
                'Decreto Exento',           // Acto
                funcionario,                // Funcionario
                rut,                        // RUT
                periodo,                    // Periodo
                cantidadDias,               // Cantidad días
                fechaInicio,                // Fecha inicio
                JORNADA_VALUES.includes(tipoJornada) ? tipoJornada : 'Jornada completa', // Tipo jornada
                diasHaber,                  // Días haber
                formatLongDate(fechaDecreto), // Fecha decreto
                (diasHaber - cantidadDias), // Saldo
                record.ra || 'MGA',         // RA
                record.emite || 'mga'       // Emite
            ];
        });

        return { data, warnings };
    };

    // Preparar datos FL para envío
    // Estructura: #, Decreto(N°Acto), Materia(FL), Acto, Funcionario, RUT, DíasSolicitados,
    //             Periodo1, SaldoDispP1, SolicitadoP1, SaldoFinalP1,
    //             Periodo2, SaldoDispP2, SolicitadoP2, SaldoFinalP2,
    //             FechaInicio, FechaTermino, FechaEmision, RA, Emite, Observaciones
    const prepareFLDataForSync = (records: PermitRecord[]): { data: unknown[][]; warnings: string[] } => {
        const warnings: string[] = [];
        const filteredRecords = records.filter(r => r.solicitudType === 'FL');

        const data = filteredRecords.map((record, index) => {
            const rowLabel = `[FL] Registro ${index + 1}`;
            const funcionario = String(record.funcionario || '').trim();
            const rut = String(record.rut || '').trim();
            const acto = String(record.acto || '').trim();
            const cantidadDias = normalizeNumberValue(record.cantidadDias, 0);
            const fechaInicio = normalizeDateValue(String(record.fechaInicio || ''));
            const fechaTermino = normalizeDateValue(String(record.fechaTermino || ''));
            const fechaDecretoParsed = normalizeDateValue(String(record.fechaDecreto || ''));
            const fechaDecreto = fechaDecretoParsed || new Date().toISOString().split('T')[0];

            if (!funcionario) warnings.push(`${rowLabel}: Funcionario vacío`);
            if (!acto) warnings.push(`${rowLabel}: N° Acto Adm. vacío`);
            if (!fechaInicio) warnings.push(`${rowLabel}: Fecha de inicio vacía`);
            if (!fechaTermino) warnings.push(`${rowLabel}: Fecha de término vacía`);

            return [
                index + 1,                      // #
                acto,                           // Decreto (N° Acto)
                'FL',                           // Materia
                'Decreto Exento',               // Acto
                funcionario,                    // Funcionario
                rut,                            // RUT
                cantidadDias,                   // Días Solicitados
                record.periodo1 || '',          // Período 1
                record.saldoDisponibleP1 || 0,  // Saldo Disponible P1
                record.solicitadoP1 || 0,       // Solicitado P1
                record.saldoFinalP1 || 0,       // Saldo Final P1
                record.periodo2 || '',          // Período 2
                record.saldoDisponibleP2 || 0,  // Saldo Disponible P2
                record.solicitadoP2 || 0,       // Solicitado P2
                record.saldoFinalP2 || 0,       // Saldo Final P2
                formatLongDate(fechaInicio),    // Fecha de inicio
                formatLongDate(fechaTermino),   // Fecha de Término
                formatLongDate(fechaDecreto),   // Fecha de emisión
                record.ra || 'MGA',             // RA
                record.emite || 'mga',          // Emite
                record.observaciones || ''      // Observaciones
            ];
        });

        return { data, warnings };
    };

    const syncToCloud = useCallback(async (dataToSync: PermitRecord[]): Promise<boolean> => {
        pendingDataRef.current = dataToSync;
        setPendingSync(true);
        setIsRetryScheduled(false);
        if (retryTimeoutRef.current) {
            clearTimeout(retryTimeoutRef.current);
        }
        if (!isOnline) {
            setSyncError(true);
            onSyncError?.("Sin conexión a internet");
            return false;
        }

        setIsSyncing(true);
        setSyncError(false);

        try {
            // Preparar datos separados para PA y FL (estructuras diferentes)
            const { data: paData, warnings: paWarnings } = preparePADataForSync(dataToSync);
            const { data: flData, warnings: flWarnings } = prepareFLDataForSync(dataToSync);

            const allWarnings = [...paWarnings, ...flWarnings];
            setSyncWarnings(allWarnings.slice(0, 20));

            // Sincronizar ambos Sheets en paralelo
            const syncPromises: Promise<Response>[] = [];

            // Solo enviar si hay datos para ese tipo
            if (paData.length > 0) {
                syncPromises.push(
                    fetch(CONFIG.WEB_APP_URL, {
                        method: 'POST',
                        mode: 'cors',
                        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                        body: JSON.stringify({
                            sheetId: CONFIG.DECRETOS_SHEET_ID,
                            data: paData
                        })
                    })
                );
            }

            if (flData.length > 0) {
                syncPromises.push(
                    fetch(CONFIG.WEB_APP_URL_FL, {
                        method: 'POST',
                        mode: 'cors',
                        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                        body: JSON.stringify({
                            sheetId: CONFIG.FERIADOS_SHEET_ID,
                            data: flData
                        })
                    })
                );
            }

            if (syncPromises.length === 0) {
                // No hay datos que sincronizar
                setLastSync(new Date());
                setPendingSync(false);
                pendingDataRef.current = null;
                return true;
            }

            const responses = await Promise.all(syncPromises);
            const results = await Promise.all(responses.map(r => r.json()));

            const allSuccess = results.every(result => result.success);

            if (allSuccess) {
                setLastSync(new Date());
                setPendingSync(false);
                setIsRetryScheduled(false);
                pendingDataRef.current = null;
                onSyncSuccess?.();
                return true;
            } else {
                const errorMessages = results
                    .filter(r => !r.success)
                    .map(r => r.error)
                    .join(', ');
                throw new Error(errorMessages || 'Error desconocido');
            }
        } catch (e) {
            console.error("Error sincronizando:", e);
            setSyncError(true);
            onSyncError?.("Error al sincronizar con la nube");

            // Reintento automático
            if (isOnline) {
                setIsRetryScheduled(true);
                retryTimeoutRef.current = setTimeout(() => syncToCloud(dataToSync), 5000);
            }
            return false;
        } finally {
            setIsSyncing(false);
        }
    }, [isOnline, onSyncSuccess, onSyncError]);

    useEffect(() => {
        if (isOnline && pendingSync && pendingDataRef.current && !isSyncing) {
            setIsRetryScheduled(false);
            syncToCloud(pendingDataRef.current);
        }
    }, [isOnline, pendingSync, isSyncing, syncToCloud]);

    // Función para agregar al stack de undo antes de modificar
    const pushToUndoStack = useCallback((currentRecords: PermitRecord[]) => {
        setUndoStack(prev => [...prev.slice(-9), currentRecords]); // Mantener máximo 10 estados
    }, []);

    // Función undo
    const undo = useCallback(() => {
        if (undoStack.length === 0) return;

        const previousState = undoStack[undoStack.length - 1];
        setUndoStack(prev => prev.slice(0, -1));
        setRecords(previousState);
        syncToCloud(previousState);
    }, [undoStack, syncToCloud]);

    // Wrapper de setRecords que guarda en undo stack
    const setRecordsWithUndo: React.Dispatch<React.SetStateAction<PermitRecord[]>> = useCallback(
        (action) => {
            setRecords(prev => {
                pushToUndoStack(prev);
                return typeof action === 'function' ? action(prev) : action;
            });
        },
        [pushToUndoStack]
    );

    return {
        records,
        setRecords: setRecordsWithUndo,
        isSyncing,
        syncError,
        lastSync,
        isOnline,
        syncWarnings,
        pendingSync,
        isRetryScheduled,
        fetchFromCloud,
        syncToCloud,
        undoStack,
        undo,
        canUndo: undoStack.length > 0
    };
};
