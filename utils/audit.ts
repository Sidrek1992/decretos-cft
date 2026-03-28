import { db } from '../lib/firebase';
import { collection, addDoc, getDocs, query, orderBy, limit as firestoreLimit } from 'firebase/firestore';
import { logger } from './logger';

const log = logger.create('Audit');

export type AuditScope = 'decree' | 'admin' | 'auth';

export interface AuditEntry {
  id: string;
  scope: AuditScope;
  action: string;
  actor: string;
  target?: string;
  target_id?: string;
  details?: string;
  timestamp: number;
  old_data?: any;
  new_data?: any;
}

const AUDIT_STORAGE_KEY = 'gdp_audit_log';
const AUDIT_MAX = 500;

const readAuditLog = (): AuditEntry[] => {
  try {
    const raw = localStorage.getItem(AUDIT_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as AuditEntry[];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((e) => e && typeof e.timestamp === 'number')
      .sort((a, b) => b.timestamp - a.timestamp);
  } catch {
    return [];
  }
};

const writeAuditLog = (entries: AuditEntry[]) => {
  try {
    localStorage.setItem(AUDIT_STORAGE_KEY, JSON.stringify(entries.slice(0, AUDIT_MAX)));
  } catch {
    // ignore storage failures
  }
};

export const appendAuditLog = async (entry: Omit<AuditEntry, 'id' | 'timestamp'>) => {
  const timestamp = Date.now();
  const next: AuditEntry = {
    id: crypto.randomUUID(),
    timestamp,
    ...entry,
  };

  // 1. Guardar localmente
  const current = readAuditLog();
  writeAuditLog([next, ...current]);

  // 2. Intentar guardar en Firebase (si hay conexión)
  try {
    if (navigator.onLine) {
      await addDoc(collection(db, 'audit_logs'), {
        scope: entry.scope,
        action: entry.action,
        actor_email: entry.actor,
        target_id: entry.target_id || null,
        target_name: entry.target || null,
        old_data: entry.old_data || null,
        new_data: entry.new_data || null,
        details: entry.details || null,
        created_at: new Date().toISOString()
      });
    }
  } catch (e) {
    log.warn('No se pudo guardar el log de auditoría en la nube:', e);
  }
};

export const getAuditLog = (scope?: AuditScope): AuditEntry[] => {
  const all = readAuditLog();
  return scope ? all.filter((e) => e.scope === scope) : all;
};

export const fetchRemoteAuditLogs = async (limit = 100): Promise<AuditEntry[]> => {
  try {
    const q = query(
      collection(db, 'audit_logs'),
      orderBy('created_at', 'desc'),
      firestoreLimit(limit)
    );
    const snapshot = await getDocs(q);

    return snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        scope: data.scope as AuditScope,
        action: data.action,
        actor: data.actor_email,
        target: data.target_name,
        target_id: data.target_id,
        details: data.details,
        timestamp: new Date(data.created_at || Date.now()).getTime(),
        old_data: data.old_data,
        new_data: data.new_data
      };
    });
  } catch (e) {
    log.error('Error al recuperar logs remotos:', e);
    return [];
  }
};
