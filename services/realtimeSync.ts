import { db } from '../lib/firebase';
import { collection, addDoc, onSnapshot, query, where } from 'firebase/firestore';
import { logger } from '../utils/logger';

const realtimeLogger = logger.create('RealtimeSync');

const CLIENT_ID_STORAGE_KEY = 'gdp_realtime_client_id';

export type SyncEventScope = 'records' | 'employees' | 'admin';

interface SyncEventRow {
  id: number;
  scope: SyncEventScope;
  action: string;
  actor_email: string | null;
  origin_client_id: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

interface PublishSyncEventInput {
  scope: SyncEventScope;
  action: string;
  actorEmail?: string;
  metadata?: Record<string, unknown>;
}

interface SubscribeToSyncEventsOptions {
  scope?: SyncEventScope;
  channelKey: string;
  ignoreOwnEvents?: boolean;
  onEvent: (event: SyncEventRow) => void;
}

interface SubscribeToProfileChangesOptions {
  channelKey: string;
  email?: string;
  onChange: () => void;
}

let cachedClientId: string | null = null;

const normalizeEmail = (email: string | undefined | null): string | null => {
  const normalized = String(email || '').trim().toLowerCase();
  return normalized || null;
};

const createClientId = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `fallback-${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

const buildChannelName = (prefix: string, key: string): string => {
  return `${prefix}-${key}-${Math.random().toString(16).slice(2, 10)}`;
};

export const getRealtimeClientId = (): string => {
  if (cachedClientId) return cachedClientId;

  if (typeof window === 'undefined') {
    cachedClientId = createClientId();
    return cachedClientId;
  }

  try {
    const stored = window.sessionStorage.getItem(CLIENT_ID_STORAGE_KEY);
    if (stored) {
      cachedClientId = stored;
      return stored;
    }

    const nextId = createClientId();
    window.sessionStorage.setItem(CLIENT_ID_STORAGE_KEY, nextId);
    cachedClientId = nextId;
    return nextId;
  } catch {
    cachedClientId = createClientId();
    return cachedClientId;
  }
};

export const publishSyncEvent = async ({
  scope,
  action,
  actorEmail,
  metadata,
}: PublishSyncEventInput): Promise<void> => {
  try {
    await addDoc(collection(db, 'sync_events'), {
      scope,
      action,
      actor_email: normalizeEmail(actorEmail),
      origin_client_id: getRealtimeClientId(),
      metadata: metadata || {},
      created_at: new Date().toISOString()
    });
  } catch (error) {
    throw error;
  }
};

export const subscribeToSyncEvents = ({
  scope,
  channelKey,
  ignoreOwnEvents = true,
  onEvent,
}: SubscribeToSyncEventsOptions): (() => void) => {
  const eventsRef = collection(db, 'sync_events');
  const q = scope ? query(eventsRef, where('scope', '==', scope)) : eventsRef;

  const unsubscribe = onSnapshot(q, (snapshot) => {
    snapshot.docChanges().forEach((change) => {
      // Only process new inserts
      if (change.type === 'added') {
        const data = change.doc.data();
        const event: SyncEventRow = {
          id: change.doc.id as any, // ID string in firebase
          scope: data.scope,
          action: data.action,
          actor_email: data.actor_email,
          origin_client_id: data.origin_client_id,
          metadata: data.metadata,
          created_at: data.created_at
        };

        if (ignoreOwnEvents && event.origin_client_id === getRealtimeClientId()) {
          return;
        }

        onEvent(event);
      }
    });

    realtimeLogger.debug(`Sincronizado Firestore: gdp-sync-events-${channelKey} (${snapshot.docChanges().length} cambios)`);
  });

  return unsubscribe;
};

export const subscribeToProfileChanges = ({
  channelKey,
  email,
  onChange,
}: SubscribeToProfileChangesOptions): (() => void) => {
  const profilesRef = collection(db, 'profiles');
  
  const unsubscribe = onSnapshot(profilesRef, (snapshot) => {
    const normalizedEmail = normalizeEmail(email);

    let shouldTrigger = false;
    snapshot.docChanges().forEach((change) => {
      const row = change.doc.data() as { email?: string };
      
      if (normalizedEmail) {
        if (normalizeEmail(row.email) === normalizedEmail) {
          shouldTrigger = true;
        }
      } else {
        shouldTrigger = true;
      }
    });

    if (shouldTrigger) {
      onChange();
    }
  });

  return unsubscribe;
};
