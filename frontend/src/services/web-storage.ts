/**
 * Web-based local storage using IndexedDB
 * This replaces the SQLite database used in the desktop app
 */

const DB_NAME = 'pollis_web';
const DB_VERSION = 1;

// Store names
const STORES = {
  PROFILES: 'profiles',
  USERS: 'users',
  GROUPS: 'groups',
  CHANNELS: 'channels',
  MESSAGES: 'messages',
  DM_CONVERSATIONS: 'dm_conversations',
  SIGNAL_SESSIONS: 'signal_sessions',
  GROUP_KEYS: 'group_keys',
  IDENTITY: 'identity',
  SETTINGS: 'settings',
} as const;

let db: IDBDatabase | null = null;

/**
 * Initialize IndexedDB
 */
export async function initDB(): Promise<IDBDatabase> {
  if (db) return db;

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      db = request.result;
      resolve(db);
    };

    request.onupgradeneeded = (event) => {
      const database = (event.target as IDBOpenDBRequest).result;

      // Profiles store
      if (!database.objectStoreNames.contains(STORES.PROFILES)) {
        const profileStore = database.createObjectStore(STORES.PROFILES, { keyPath: 'id' });
        profileStore.createIndex('user_id', 'user_id', { unique: false });
      }

      // Users store
      if (!database.objectStoreNames.contains(STORES.USERS)) {
        const userStore = database.createObjectStore(STORES.USERS, { keyPath: 'id' });
        userStore.createIndex('username', 'username', { unique: true });
        userStore.createIndex('email', 'email', { unique: false });
      }

      // Groups store
      if (!database.objectStoreNames.contains(STORES.GROUPS)) {
        const groupStore = database.createObjectStore(STORES.GROUPS, { keyPath: 'id' });
        groupStore.createIndex('slug', 'slug', { unique: true });
      }

      // Channels store
      if (!database.objectStoreNames.contains(STORES.CHANNELS)) {
        const channelStore = database.createObjectStore(STORES.CHANNELS, { keyPath: 'id' });
        channelStore.createIndex('group_id', 'group_id', { unique: false });
        channelStore.createIndex('group_slug', ['group_id', 'slug'], { unique: true });
      }

      // Messages store
      if (!database.objectStoreNames.contains(STORES.MESSAGES)) {
        const messageStore = database.createObjectStore(STORES.MESSAGES, { keyPath: 'id' });
        messageStore.createIndex('channel_id', 'channel_id', { unique: false });
        messageStore.createIndex('conversation_id', 'conversation_id', { unique: false });
        messageStore.createIndex('created_at', 'created_at', { unique: false });
      }

      // DM Conversations store
      if (!database.objectStoreNames.contains(STORES.DM_CONVERSATIONS)) {
        const dmStore = database.createObjectStore(STORES.DM_CONVERSATIONS, { keyPath: 'id' });
        dmStore.createIndex('user1_id', 'user1_id', { unique: false });
        dmStore.createIndex('user2_identifier', 'user2_identifier', { unique: false });
      }

      // Signal Sessions store
      if (!database.objectStoreNames.contains(STORES.SIGNAL_SESSIONS)) {
        const sessionStore = database.createObjectStore(STORES.SIGNAL_SESSIONS, { keyPath: 'id' });
        sessionStore.createIndex('remote_user_id', 'remote_user_id', { unique: false });
      }

      // Group Keys store
      if (!database.objectStoreNames.contains(STORES.GROUP_KEYS)) {
        const keyStore = database.createObjectStore(STORES.GROUP_KEYS, { keyPath: 'id' });
        keyStore.createIndex('channel_id', 'channel_id', { unique: false });
      }

      // Identity store (single identity per profile)
      if (!database.objectStoreNames.contains(STORES.IDENTITY)) {
        database.createObjectStore(STORES.IDENTITY, { keyPath: 'id' });
      }

      // Settings store
      if (!database.objectStoreNames.contains(STORES.SETTINGS)) {
        database.createObjectStore(STORES.SETTINGS, { keyPath: 'key' });
      }

      // Session store (for storing Clerk session)
      if (!database.objectStoreNames.contains('session')) {
        database.createObjectStore('session', { keyPath: 'key' });
      }
    };
  });
}

/**
 * Generic store operations
 */
async function getStore(storeName: string, mode: IDBTransactionMode = 'readonly'): Promise<IDBObjectStore> {
  const database = await initDB();
  const transaction = database.transaction(storeName, mode);
  return transaction.objectStore(storeName);
}

export async function put<T>(storeName: string, item: T): Promise<void> {
  const store = await getStore(storeName, 'readwrite');
  return new Promise((resolve, reject) => {
    const request = store.put(item);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}

export async function get<T>(storeName: string, key: IDBValidKey): Promise<T | undefined> {
  const store = await getStore(storeName);
  return new Promise((resolve, reject) => {
    const request = store.get(key);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}

export async function getAll<T>(storeName: string): Promise<T[]> {
  const store = await getStore(storeName);
  return new Promise((resolve, reject) => {
    const request = store.getAll();
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result || []);
  });
}

export async function getAllByIndex<T>(storeName: string, indexName: string, key: IDBValidKey): Promise<T[]> {
  const store = await getStore(storeName);
  const index = store.index(indexName);
  return new Promise((resolve, reject) => {
    const request = index.getAll(key);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result || []);
  });
}

export async function remove(storeName: string, key: IDBValidKey): Promise<void> {
  const store = await getStore(storeName, 'readwrite');
  return new Promise((resolve, reject) => {
    const request = store.delete(key);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}

export async function clear(storeName: string): Promise<void> {
  const store = await getStore(storeName, 'readwrite');
  return new Promise((resolve, reject) => {
    const request = store.clear();
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}

/**
 * Clear all data for a specific profile
 */
export async function clearProfileData(): Promise<void> {
  await clear(STORES.USERS);
  await clear(STORES.GROUPS);
  await clear(STORES.CHANNELS);
  await clear(STORES.MESSAGES);
  await clear(STORES.DM_CONVERSATIONS);
  await clear(STORES.SIGNAL_SESSIONS);
  await clear(STORES.GROUP_KEYS);
  await clear(STORES.IDENTITY);
}

/**
 * Delete the entire database
 */
export async function deleteDB(): Promise<void> {
  if (db) {
    db.close();
    db = null;
  }
  return new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase(DB_NAME);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve();
  });
}

/**
 * Session storage functions for browser
 */
export interface SessionData {
  userID: string;
  clerkToken: string;
}

const SESSION_KEY = 'pollis_session';

export async function storeSession(userID: string, clerkToken: string): Promise<void> {
  await put<{ key: string; userID: string; clerkToken: string }>('session', {
    key: SESSION_KEY,
    userID,
    clerkToken,
  });
}

export async function getStoredSession(): Promise<SessionData | null> {
  const session = await get<{ key: string; userID: string; clerkToken: string }>('session', SESSION_KEY);
  if (!session) return null;
  return {
    userID: session.userID,
    clerkToken: session.clerkToken,
  };
}

export async function clearSession(): Promise<void> {
  await remove('session', SESSION_KEY);
}

// Export store names for use elsewhere
export { STORES };

