import React, { useState, useEffect, useCallback, useRef } from 'react';
import { collection, doc, getDocs, setDoc, deleteDoc, onSnapshot, writeBatch, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Employee } from '../types';
import { CONFIG } from '../config';
import { logger } from '../utils/logger';
import { localBackup } from '../services/localBackup';
import { formatRutForStorage, isValidRutModulo11, normalizeRutCanonical } from '../utils/rutIntegrity';

const employeeLogger = logger.create('EmployeeSync');

interface UseEmployeeSyncReturn {
    employees: Employee[];
    setEmployees: React.Dispatch<React.SetStateAction<Employee[]>>;
    isSyncing: boolean;
    syncError: boolean;
    lastSync: Date | null;
    fetchEmployeesFromCloud: () => Promise<void>;
    syncEmployeesToCloud: (data: Employee[]) => Promise<boolean>;
    addEmployee: (employee: Employee) => Promise<void>;
    updateEmployee: (oldRut: string, updatedEmployee: Employee) => Promise<void>;
    deleteEmployee: (rut: string) => Promise<void>;
}

const normalizeEmployeePayload = (employee: Employee): Employee | null => {
    const nombre = String(employee.nombre || '').trim().toUpperCase();
    const rut = formatRutForStorage(employee.rut);
    const departamento = String(employee.departamento || '').trim();

    if (!nombre || !rut || !isValidRutModulo11(rut)) {
        return null;
    }

    return { nombre, rut, departamento };
};

const dedupeEmployeesByRut = (employees: Employee[]): Employee[] => {
    const map = new Map<string, Employee>();

    employees.forEach((employee) => {
        const canonicalRut = normalizeRutCanonical(employee.rut);
        if (!canonicalRut) return;
        if (!map.has(canonicalRut)) {
            map.set(canonicalRut, employee);
        }
    });

    return Array.from(map.values());
};

export const useEmployeeSync = (
    onSyncSuccess?: () => void,
    onSyncError?: (error: string) => void,
    actorEmail?: string
): UseEmployeeSyncReturn => {
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [isSyncing, setIsSyncing] = useState(false);
    const [syncError, setSyncError] = useState(false);
    const [lastSync, setLastSync] = useState<Date | null>(null);

    const abortControllerRef = useRef<AbortController | null>(null);
    const hasLoadedRef = useRef(false);

    // Cargar empleados desde Firestore o fallback
    useEffect(() => {
        fetchEmployeesFromCloud();

        // Suscribirse a cambios en Firestore (Realtime)
        const unsubscribe = onSnapshot(collection(db, 'employees'), (snapshot) => {
             const loaded: Employee[] = [];
             snapshot.forEach(doc => {
                 const data = doc.data();
                 if (data.rut && data.nombre) {
                     loaded.push({
                         rut: data.rut,
                         nombre: data.nombre,
                         departamento: data.departamento || ''
                     });
                 }
             });
             loaded.sort((a, b) => a.nombre.localeCompare(b.nombre));
             setEmployees(loaded);
             setLastSync(new Date());
             hasLoadedRef.current = true;
             localBackup.saveEmployees(loaded).catch(() => {});
        }, (error) => {
             employeeLogger.error("Realtime fetch error:", error);
        });

        return () => {
            if (abortControllerRef.current) {
                abortControllerRef.current.abort();
            }
            unsubscribe();
        };
    }, []);

    const fetchEmployeesFromCloud = useCallback(async () => {
        if (!navigator.onLine) {
            try {
                const backupEmployees = await localBackup.getEmployees();
                if (backupEmployees.length > 0) {
                    setEmployees(backupEmployees);
                    onSyncError?.('Modo offline: usando backup local de funcionarios');
                }
            } catch (backupError) {
                employeeLogger.warn('No se pudo cargar backup local de empleados:', backupError);
            } finally {
                hasLoadedRef.current = true;
            }
            return;
        }

        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
        }
        abortControllerRef.current = new AbortController();
        const { signal } = abortControllerRef.current;

        setIsSyncing(true);
        setSyncError(false);

        try {
            employeeLogger.info('Iniciando fetch de empleados desde Firestore...');
            const snapshot = await getDocs(collection(db, 'employees'));
            
            let cloudEmployees: Employee[] = [];

            if (snapshot.empty) {
                // MIGRACIÓN: Si Firestore está vacío, tratar de importar desde Google Sheets una vez
                employeeLogger.info('Firestore está vacío, intentando migrar desde Google Sheets...');
                try {
                    const response = await fetch(`${CONFIG.WEB_APP_URL}?sheetId=${CONFIG.EMPLOYEES_SHEET_ID}&type=employees`, { signal });
                    const result = await response.json();
                    
                    if (result.success && result.data) {
                        cloudEmployees = dedupeEmployeesByRut(result.data
                            .filter((row: unknown[]) => row && row[1])
                            .map((row: unknown[]) => {
                                const nombres = String(row[1] || '').trim();
                                const primerApellido = String(row[2] || '').trim();
                                const segundoApellido = String(row[3] || '').trim();
                                const rut = String(row[4] || '').trim();
                                const departamento = String(row[5] || '').trim();
        
                                const nombreCompleto = [nombres, primerApellido, segundoApellido].filter(Boolean).join(' ').toUpperCase();
                                return { nombre: nombreCompleto, rut, departamento };
                            })
                            .map(normalizeEmployeePayload)
                            .filter((emp: Employee | null): emp is Employee => emp !== null));
                        
                        if (cloudEmployees.length > 0) {
                            // Guardar lote migrado en Firestore
                            const batch = writeBatch(db);
                            cloudEmployees.forEach(emp => {
                                const canonicalRut = normalizeRutCanonical(emp.rut);
                                if (canonicalRut) {
                                    const empRef = doc(db, 'employees', canonicalRut);
                                    batch.set(empRef, { ...emp, createdAt: serverTimestamp(), migratedAuto: true });
                                }
                            });
                            await batch.commit();
                            employeeLogger.info(`Migrados ${cloudEmployees.length} empleados desde Google Sheets a Firestore.`);
                        }
                    }
                } catch (e) {
                    employeeLogger.warn("No se pudo migrar de Google Sheets:", e);
                }
            } else {
                 snapshot.forEach(docSnap => {
                     const data = docSnap.data();
                     cloudEmployees.push({
                         rut: data.rut,
                         nombre: data.nombre,
                         departamento: data.departamento || ''
                     });
                 });
            }

            if (cloudEmployees.length > 0) {
                cloudEmployees.sort((a, b) => a.nombre.localeCompare(b.nombre));
                setEmployees(cloudEmployees);
                setLastSync(new Date());
                hasLoadedRef.current = true;
                localBackup.saveEmployees(cloudEmployees).catch(() => {});
                employeeLogger.info(`Carga completada: ${cloudEmployees.length} empleados`);
                onSyncSuccess?.();
            }

        } catch (e) {
            if (e instanceof Error && e.name === 'AbortError') return;
            employeeLogger.error("Error al recuperar empleados de Firebase:", e);
            setSyncError(true);
            try {
                const backupEmployees = await localBackup.getEmployees();
                if (backupEmployees.length > 0) {
                    setEmployees(backupEmployees);
                    hasLoadedRef.current = true;
                    onSyncError?.('Modo offline: usando backup local de funcionarios');
                } else {
                    onSyncError?.("Error al conectar con la nube de empleados");
                }
            } catch (backupError) {
                employeeLogger.warn('Error al recuperar backup local de empleados:', backupError);
                onSyncError?.("Error al conectar con la nube de empleados");
            } finally {
                hasLoadedRef.current = true;
            }
        } finally {
            setIsSyncing(false);
        }
    }, [onSyncSuccess, onSyncError]);

    // syncEmployeesToCloud (masivo) no se requerirá normalmente con Firestore base
    // Pero se mantiene por compatibilidad si la interfaz intenta forzar sync manual de todo
    const syncEmployeesToCloud = useCallback(async (dataToSync: Employee[]): Promise<boolean> => {
        if (!navigator.onLine) {
            onSyncError?.("Sin conexión a internet");
            return false;
        }

        setIsSyncing(true);
        setSyncError(false);

        try {
            const normalizedData = dedupeEmployeesByRut(
                dataToSync
                    .map(normalizeEmployeePayload)
                    .filter((employee): employee is Employee => employee !== null)
            );

            const batch = writeBatch(db);
            normalizedData.forEach(emp => {
                const canonicalRut = normalizeRutCanonical(emp.rut);
                if (canonicalRut) {
                    const empRef = doc(db, 'employees', canonicalRut);
                    batch.set(empRef, { ...emp, updatedAt: serverTimestamp() }, { merge: true });
                }
            });

            await batch.commit();
            setLastSync(new Date());
            onSyncSuccess?.();
            return true;

        } catch (e) {
            employeeLogger.error("Error batch sincronizando empleados a Firestore:", e);
            setSyncError(true);
            onSyncError?.("Error al sincronizar empleados con la nube");
            return false;
        } finally {
            setIsSyncing(false);
        }
    }, [onSyncSuccess, onSyncError]);

    const addEmployee = useCallback(async (employee: Employee) => {
        const normalizedEmployee = normalizeEmployeePayload(employee);
        if (!normalizedEmployee) {
            onSyncError?.('No se pudo guardar: RUT inválido para funcionario.');
            return;
        }

        const canonicalRut = normalizeRutCanonical(normalizedEmployee.rut);
        if (!canonicalRut) return;

        try {
            await setDoc(doc(db, 'employees', canonicalRut), {
                ...normalizedEmployee,
                createdAt: serverTimestamp()
            });
            // El onSnapshot actualizará el estado local
        } catch (e) {
             employeeLogger.error('Error al añadir funcionario en Firestore:', e);
             onSyncError?.('Error al guardar el funcionario. Por favor intenta de nuevo.');
        }
    }, [onSyncError]);

    const updateEmployee = useCallback(async (oldRut: string, updatedEmployee: Employee) => {
        const normalizedEmployee = normalizeEmployeePayload(updatedEmployee);
        if (!normalizedEmployee) {
            onSyncError?.('No se pudo actualizar: RUT inválido para funcionario.');
            return;
        }

        const oldCanonicalRut = normalizeRutCanonical(oldRut);
        const newCanonicalRut = normalizeRutCanonical(normalizedEmployee.rut);
        if (!oldCanonicalRut || !newCanonicalRut) return;

        try {
            if (oldCanonicalRut !== newCanonicalRut) {
                 // Si cambia el RUT, crear nuevo documento y borrar el viejo
                 const batch = writeBatch(db);
                 batch.set(doc(db, 'employees', newCanonicalRut), {
                     ...normalizedEmployee,
                     updatedAt: serverTimestamp()
                 });
                 batch.delete(doc(db, 'employees', oldCanonicalRut));
                 await batch.commit();
            } else {
                 await setDoc(doc(db, 'employees', newCanonicalRut), {
                     ...normalizedEmployee,
                     updatedAt: serverTimestamp()
                 }, { merge: true });
            }
        } catch (e) {
             employeeLogger.error('Error al actualizar funcionario en Firestore:', e);
             onSyncError?.('Error al actualizar el funcionario.');
        }
    }, [onSyncError]);

    const deleteEmployee = useCallback(async (rut: string) => {
        const canonicalRut = normalizeRutCanonical(rut);
        if (!canonicalRut) return;

        try {
             await deleteDoc(doc(db, 'employees', canonicalRut));
        } catch (e) {
             employeeLogger.error('Error al borrar funcionario en Firestore:', e);
             onSyncError?.('Error al borrar funcionario.');
        }
    }, [onSyncError]);

    return {
        employees,
        setEmployees,
        isSyncing,
        syncError,
        lastSync,
        fetchEmployeesFromCloud,
        syncEmployeesToCloud,
        addEmployee,
        updateEmployee,
        deleteEmployee
    };
};

