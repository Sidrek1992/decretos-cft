import React, { useState, useEffect, useCallback, useRef } from 'react';
import { PermitRecord } from '../types';
import { CONFIG } from '../config';
import { logger } from '../utils/logger';
import {
  parsePARecords,
  parseFLRecords,
  preparePADataForSync,
  prepareFLDataForSync,
} from '../utils/parsers';
import { localBackup } from '../services/localBackup';

const syncLogger = logger.create('CloudSync');

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
  const abortControllerRef = useRef<AbortController | null>(null);

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

    // Cleanup: cancelar fetch pendiente al desmontar
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  const fetchFromCloud = useCallback(async () => {
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
      syncLogger.info('Iniciando fetch desde la nube...');

      // Fetch de ambos Sheets en paralelo: PA (Decretos) y FL (Feriados)
      const [paResponse, flResponse] = await Promise.all([
        fetch(`${CONFIG.WEB_APP_URL}?sheetId=${CONFIG.DECRETOS_SHEET_ID}`, { signal }),
        fetch(`${CONFIG.WEB_APP_URL_FL}?sheetId=${CONFIG.FERIADOS_SHEET_ID}`, { signal })
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
        syncLogger.debug(`Procesados ${paRecords.length} registros PA`);
      }

      // Procesar registros FL
      if (flResult.success && flResult.data) {
        const { records: flRecords, warnings: flWarnings } = parseFLRecords(flResult.data);
        allRecords = [...allRecords, ...flRecords];
        allWarnings.push(...flWarnings);
        syncLogger.debug(`Procesados ${flRecords.length} registros FL`);
      }

      // Ordenar por fecha de creación (más recientes primero)
      allRecords.sort((a, b) => b.createdAt - a.createdAt);

      setRecords(allRecords);
      setSyncWarnings(allWarnings.slice(0, 20));
      setLastSync(new Date());

      // ★ Guardar backup local automáticamente
      try {
        await localBackup.saveRecords(allRecords);
        syncLogger.debug('Backup local actualizado');
      } catch (backupError) {
        syncLogger.warn('Error al guardar backup local:', backupError);
      }

      syncLogger.info(`Fetch completado: ${allRecords.length} registros`);
      onSyncSuccess?.();
    } catch (e) {
      // Ignorar errores de abort (son intencionales)
      if (e instanceof Error && e.name === 'AbortError') {
        syncLogger.debug('Fetch cancelado (componente desmontado)');
        return;
      }
      syncLogger.error("Error al recuperar datos de la nube:", e);
      setSyncError(true);

      // ★ Intentar recuperar desde backup local
      try {
        const backupRecords = await localBackup.getRecords();
        if (backupRecords.length > 0) {
          setRecords(backupRecords);
          const lastBackupTime = await localBackup.getLastBackupTime();
          syncLogger.info(`Recuperados ${backupRecords.length} registros desde backup local`);
          onSyncError?.(`Modo offline: usando backup local (${lastBackupTime ? new Date(lastBackupTime).toLocaleTimeString() : 'fecha desconocida'})`);
        } else {
          onSyncError?.("Error al conectar con la nube");
        }
      } catch (backupError) {
        syncLogger.error('Error al recuperar backup local:', backupError);
        onSyncError?.("Error al conectar con la nube");
      }
    } finally {
      setIsSyncing(false);
    }
  }, [onSyncSuccess, onSyncError]);

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
      syncLogger.info('Iniciando sincronización a la nube...');

      // Preparar datos separados para PA y FL
      const { data: paData, warnings: paWarnings } = preparePADataForSync(dataToSync);
      const { data: flData, warnings: flWarnings } = prepareFLDataForSync(dataToSync);

      const allWarnings = [...paWarnings, ...flWarnings];
      setSyncWarnings(allWarnings.slice(0, 20));

      // Sincronizar ambos Sheets en paralelo
      const syncPromises: Promise<Response>[] = [];

      if (paData.length > 0) {
        syncLogger.debug(`Sincronizando ${paData.length} registros PA`);
        syncPromises.push(
          fetch(CONFIG.WEB_APP_URL, {
            method: 'POST',
            mode: 'cors',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({
              sheetId: CONFIG.DECRETOS_SHEET_ID,
              data: paData,
              validateRecords: true
            })
          })
        );
      }

      if (flData.length > 0) {
        syncLogger.debug(`Sincronizando ${flData.length} registros FL`);
        syncPromises.push(
          fetch(CONFIG.WEB_APP_URL_FL, {
            method: 'POST',
            mode: 'cors',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({
              sheetId: CONFIG.FERIADOS_SHEET_ID,
              data: flData,
              validateRecords: true
            })
          })
        );
      }

      if (syncPromises.length === 0) {
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
        syncLogger.info('Sincronización completada exitosamente');
        onSyncSuccess?.();
        return true;
      } else {
        const errorMessages = results
          .filter(r => !r.success)
          .map(r => r.error || r.validationErrors?.join(', '))
          .join(', ');
        throw new Error(errorMessages || 'Error desconocido');
      }
    } catch (e) {
      syncLogger.error("Error sincronizando:", e);
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

  // Función para agregar al stack de undo
  const pushToUndoStack = useCallback((currentRecords: PermitRecord[]) => {
    setUndoStack(prev => [...prev.slice(-9), currentRecords]);
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
