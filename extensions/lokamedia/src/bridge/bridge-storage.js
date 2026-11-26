/**
 * LokaBridge Studio — Durable Session Persistence (IndexedDB)
 * File: extensions/lokamedia/src/bridge/bridge-storage.js
 *
 * Persists production sessions, custom angles, and notifications locally.
 * Resilient against Side Panel closing, tab switching, and browser restarts.
 */

const DB_NAME = 'lokabridge_studio_db';
const DB_VERSION = 1;

let dbPromise = null;

export function openStudioDb() {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      return reject(new Error('IndexedDB is not available in this environment'));
    }

    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = (e) => {
      const db = e.target.result;

      if (!db.objectStoreNames.contains('sessions')) {
        const store = db.createObjectStore('sessions', { keyPath: 'production_id' });
        store.createIndex('updated_at', 'updated_at', { unique: false });
      }

      if (!db.objectStoreNames.contains('custom_angles')) {
        const angleStore = db.createObjectStore('custom_angles', { keyPath: 'id' });
        angleStore.createIndex('created_at', 'created_at', { unique: false });
      }

      if (!db.objectStoreNames.contains('notifications')) {
        const notifStore = db.createObjectStore('notifications', { keyPath: 'id' });
        notifStore.createIndex('created_at', 'created_at', { unique: false });
        notifStore.createIndex('read', 'read', { unique: false });
      }
    };

    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });

  return dbPromise;
}

export async function saveSession(session) {
  const db = await openStudioDb();
  const tx = db.transaction('sessions', 'readwrite');
  const store = tx.objectStore('sessions');
  const data = {
    ...session,
    updated_at: new Date().toISOString()
  };
  await new Promise((resolve, reject) => {
    const req = store.put(data);
    req.onsuccess = resolve;
    req.onerror = () => reject(req.error);
  });
  return data;
}

export async function getSession(productionId) {
  const db = await openStudioDb();
  const tx = db.transaction('sessions', 'readonly');
  const store = tx.objectStore('sessions');
  return new Promise((resolve, reject) => {
    const req = store.get(productionId);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}

export async function listSessions() {
  const db = await openStudioDb();
  const tx = db.transaction('sessions', 'readonly');
  const store = tx.objectStore('sessions');
  const index = store.index('updated_at');
  return new Promise((resolve, reject) => {
    const req = index.openCursor(null, 'prev');
    const items = [];
    req.onsuccess = (e) => {
      const cursor = e.target.result;
      if (cursor) {
        items.push(cursor.value);
        cursor.continue();
      } else {
        resolve(items);
      }
    };
    req.onerror = () => reject(req.error);
  });
}

export async function deleteSession(productionId) {
  const db = await openStudioDb();
  const tx = db.transaction('sessions', 'readwrite');
  const store = tx.objectStore('sessions');
  await new Promise((resolve, reject) => {
    const req = store.delete(productionId);
    req.onsuccess = resolve;
    req.onerror = () => reject(req.error);
  });
  return true;
}

export async function saveCustomAngle(angle) {
  const db = await openStudioDb();
  const tx = db.transaction('custom_angles', 'readwrite');
  const store = tx.objectStore('custom_angles');
  const record = {
    id: angle.id || `angle_${Date.now()}`,
    label: angle.label,
    description: angle.description || '',
    instructions: angle.instructions || '',
    created_at: angle.created_at || new Date().toISOString()
  };
  await new Promise((resolve, reject) => {
    const req = store.put(record);
    req.onsuccess = resolve;
    req.onerror = () => reject(req.error);
  });
  return record;
}

export async function listCustomAngles() {
  const db = await openStudioDb();
  const tx = db.transaction('custom_angles', 'readonly');
  const store = tx.objectStore('custom_angles');
  return new Promise((resolve, reject) => {
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

export async function deleteCustomAngle(id) {
  const db = await openStudioDb();
  const tx = db.transaction('custom_angles', 'readwrite');
  const store = tx.objectStore('custom_angles');
  await new Promise((resolve, reject) => {
    const req = store.delete(id);
    req.onsuccess = resolve;
    req.onerror = () => reject(req.error);
  });
  return true;
}

export async function addNotification(notif) {
  const db = await openStudioDb();
  const tx = db.transaction('notifications', 'readwrite');
  const store = tx.objectStore('notifications');
  const record = {
    id: notif.id || `notif_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    type: notif.type || 'info', // 'success', 'warning', 'error', 'info'
    title: notif.title,
    message: notif.message,
    job_id: notif.job_id || null,
    preview_url: notif.preview_url || null,
    read: false,
    created_at: new Date().toISOString()
  };
  await new Promise((resolve, reject) => {
    const req = store.put(record);
    req.onsuccess = resolve;
    req.onerror = () => reject(req.error);
  });
  return record;
}

export async function listNotifications() {
  const db = await openStudioDb();
  const tx = db.transaction('notifications', 'readonly');
  const store = tx.objectStore('notifications');
  return new Promise((resolve, reject) => {
    const req = store.getAll();
    req.onsuccess = () => {
      const items = req.result || [];
      items.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      resolve(items);
    };
    req.onerror = () => reject(req.error);
  });
}

export async function markNotificationRead(id) {
  const db = await openStudioDb();
  const tx = db.transaction('notifications', 'readwrite');
  const store = tx.objectStore('notifications');
  const record = await new Promise((resolve) => {
    const req = store.get(id);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => resolve(null);
  });
  if (record) {
    record.read = true;
    await new Promise((resolve) => {
      const req = store.put(record);
      req.onsuccess = resolve;
      req.onerror = resolve;
    });
  }
  return true;
}
