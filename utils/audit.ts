export type AuditScope = 'decree' | 'admin' | 'auth';

export interface AuditEntry {
  id: string;
  scope: AuditScope;
  action: string;
  actor: string;
  target?: string;
  details?: string;
  timestamp: number;
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

export const appendAuditLog = (entry: Omit<AuditEntry, 'id' | 'timestamp'>) => {
  const next: AuditEntry = {
    id: crypto.randomUUID(),
    timestamp: Date.now(),
    ...entry,
  };
  const current = readAuditLog();
  writeAuditLog([next, ...current]);
};

export const getAuditLog = (scope?: AuditScope): AuditEntry[] => {
  const all = readAuditLog();
  return scope ? all.filter((e) => e.scope === scope) : all;
};
