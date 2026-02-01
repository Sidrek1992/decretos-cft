import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Employee } from '../types';
import { CONFIG } from '../config';
import { logger } from '../utils/logger';

const employeeLogger = logger.create('EmployeeSync');

interface UseEmployeeSyncReturn {
    employees: Employee[];
    setEmployees: React.Dispatch<React.SetStateAction<Employee[]>>;
    isSyncing: boolean;
    syncError: boolean;
    lastSync: Date | null;
    fetchEmployeesFromCloud: () => Promise<void>;
    syncEmployeesToCloud: (data: Employee[]) => Promise<boolean>;
    addEmployee: (employee: Employee) => void;
    updateEmployee: (oldRut: string, updatedEmployee: Employee) => void;
    deleteEmployee: (rut: string) => void;
}

export const useEmployeeSync = (
    onSyncSuccess?: () => void,
    onSyncError?: (error: string) => void
): UseEmployeeSyncReturn => {
    const [employees, setEmployees] = useState<Employee[]>([]);

    const [isSyncing, setIsSyncing] = useState(false);
    const [syncError, setSyncError] = useState(false);
    const [lastSync, setLastSync] = useState<Date | null>(null);

    const abortControllerRef = useRef<AbortController | null>(null);

    // Cargar empleados desde el Sheet al iniciar
    useEffect(() => {
        fetchEmployeesFromCloud();

        // Cleanup: cancelar fetch pendiente al desmontar
        return () => {
            if (abortControllerRef.current) {
                abortControllerRef.current.abort();
            }
        };
    }, []);

    const fetchEmployeesFromCloud = useCallback(async () => {
        if (!navigator.onLine) return;

        // Cancelar fetch anterior si existe
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
        }
        abortControllerRef.current = new AbortController();
        const { signal } = abortControllerRef.current;

        setIsSyncing(true);
        setSyncError(false);

        try {
            employeeLogger.info('Iniciando fetch de empleados...');

            // Usar el mismo Web App URL pero con el sheet de empleados
            const response = await fetch(
                `${CONFIG.WEB_APP_URL}?sheetId=${CONFIG.EMPLOYEES_SHEET_ID}&type=employees`,
                { signal }
            );
            const result = await response.json();

            if (result.success && result.data) {
                // Mapeo según estructura del Sheet:
                // Col 0: N° (índice), Col 1: Nombres, Col 2: Primer Apellido, Col 3: Segundo Apellido, Col 4: RUT
                const cloudEmployees: Employee[] = result.data
                    .filter((row: unknown[]) => row && row[1]) // Filtrar filas sin nombre
                    .map((row: unknown[]) => {
                        const nombres = String(row[1] || '').trim();
                        const primerApellido = String(row[2] || '').trim();
                        const segundoApellido = String(row[3] || '').trim();
                        const rut = String(row[4] || '').trim();

                        // Concatenar nombre completo
                        const nombreCompleto = [nombres, primerApellido, segundoApellido]
                            .filter(Boolean)
                            .join(' ')
                            .toUpperCase();

                        return {
                            nombre: nombreCompleto,
                            rut: rut
                        };
                    })
                    .filter((emp: Employee) => emp.nombre && emp.rut); // Filtrar registros incompletos

                // Ordenar alfabéticamente
                cloudEmployees.sort((a, b) => a.nombre.localeCompare(b.nombre));
                setEmployees(cloudEmployees);
                setLastSync(new Date());
                employeeLogger.info(`Fetch completado: ${cloudEmployees.length} empleados`);
                onSyncSuccess?.();
            }
        } catch (e) {
            // Ignorar errores de abort (son intencionales)
            if (e instanceof Error && e.name === 'AbortError') {
                employeeLogger.debug('Fetch cancelado (componente desmontado)');
                return;
            }
            employeeLogger.error("Error al recuperar empleados de la nube:", e);
            setSyncError(true);
            onSyncError?.("Error al conectar con la nube de empleados");
        } finally {
            setIsSyncing(false);
        }
    }, [onSyncSuccess, onSyncError]);

    const syncEmployeesToCloud = useCallback(async (dataToSync: Employee[]): Promise<boolean> => {
        if (!navigator.onLine) {
            onSyncError?.("Sin conexión a internet");
            return false;
        }

        setIsSyncing(true);
        setSyncError(false);

        try {
            // Preparar datos para el Sheet
            // Estructura: N°, Nombres, Primer Apellido, Segundo Apellido, RUT
            const sheetData = dataToSync.map((emp, index) => {
                // Intentar separar el nombre en partes
                const parts = emp.nombre.split(' ');
                let nombres = '';
                let primerApellido = '';
                let segundoApellido = '';

                if (parts.length >= 4) {
                    // Asumimos: 2 nombres + 2 apellidos
                    nombres = parts.slice(0, 2).join(' ');
                    primerApellido = parts[2] || '';
                    segundoApellido = parts.slice(3).join(' ');
                } else if (parts.length === 3) {
                    // 1 nombre + 2 apellidos
                    nombres = parts[0];
                    primerApellido = parts[1];
                    segundoApellido = parts[2];
                } else if (parts.length === 2) {
                    // 1 nombre + 1 apellido
                    nombres = parts[0];
                    primerApellido = parts[1];
                } else {
                    nombres = emp.nombre;
                }

                return [
                    index + 1,      // N°
                    nombres,        // Nombres
                    primerApellido, // Primer Apellido
                    segundoApellido,// Segundo Apellido
                    emp.rut         // RUT
                ];
            });

            const payload = {
                sheetId: CONFIG.EMPLOYEES_SHEET_ID,
                type: 'employees',
                data: sheetData
            };

            const response = await fetch(CONFIG.WEB_APP_URL, {
                method: 'POST',
                mode: 'cors',
                headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                body: JSON.stringify(payload)
            });

            const result = await response.json();

            if (result.success) {
                setLastSync(new Date());
                onSyncSuccess?.();
                return true;
            } else {
                throw new Error(result.error);
            }
        } catch (e) {
            employeeLogger.error("Error sincronizando empleados:", e);
            setSyncError(true);
            onSyncError?.("Error al sincronizar empleados con la nube");
            return false;
        } finally {
            setIsSyncing(false);
        }
    }, [onSyncSuccess, onSyncError]);

    const addEmployee = useCallback((employee: Employee) => {
        setEmployees(prev => {
            const updated = [...prev, employee].sort((a, b) => a.nombre.localeCompare(b.nombre));
            // Sincronizar en segundo plano
            syncEmployeesToCloud(updated);
            return updated;
        });
    }, [syncEmployeesToCloud]);

    const updateEmployee = useCallback((oldRut: string, updatedEmployee: Employee) => {
        setEmployees(prev => {
            const updated = prev.map(e =>
                e.rut === oldRut ? updatedEmployee : e
            ).sort((a, b) => a.nombre.localeCompare(b.nombre));
            // Sincronizar en segundo plano
            syncEmployeesToCloud(updated);
            return updated;
        });
    }, [syncEmployeesToCloud]);

    const deleteEmployee = useCallback((rut: string) => {
        setEmployees(prev => {
            const updated = prev.filter(e => e.rut !== rut);
            // Sincronizar en segundo plano
            syncEmployeesToCloud(updated);
            return updated;
        });
    }, [syncEmployeesToCloud]);

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
