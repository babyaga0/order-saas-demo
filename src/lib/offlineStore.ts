/**
 * Offline Sales Store - IndexedDB
 * Saves sales when offline, syncs to server when back online.
 */

const DB_NAME = 'mj_pos_offline';
const DB_VERSION = 1;
const STORE_NAME = 'pending_sales';

export interface OfflineSale {
  id?: number; // auto-increment
  localId: string; // e.g. "OFFLINE-1707840000000"
  saleData: any; // The full sale payload
  createdAt: string; // ISO date
  synced: boolean;
  syncError?: string;
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
        store.createIndex('synced', 'synced', { unique: false });
        store.createIndex('localId', 'localId', { unique: true });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Save a sale to IndexedDB (offline queue)
 */
export async function saveOfflineSale(saleData: any): Promise<string> {
  const db = await openDB();
  const localId = `OFFLINE-${Date.now()}`;

  const sale: OfflineSale = {
    localId,
    saleData,
    createdAt: new Date().toISOString(),
    synced: false,
  };

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const request = store.add(sale);

    request.onsuccess = () => {
      console.log('[OFFLINE] Sale saved:', localId);
      resolve(localId);
    };
    request.onerror = () => reject(request.error);
    tx.oncomplete = () => db.close();
  });
}

/**
 * Get all pending (unsynced) sales
 */
export async function getPendingSales(): Promise<OfflineSale[]> {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const request = store.getAll();

    request.onsuccess = () => {
      const all: OfflineSale[] = request.result;
      resolve(all.filter((s) => !s.synced));
    };
    request.onerror = () => reject(request.error);
    tx.oncomplete = () => db.close();
  });
}

/**
 * Mark a sale as synced (after successful API call)
 */
export async function markSaleSynced(id: number): Promise<void> {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const getRequest = store.get(id);

    getRequest.onsuccess = () => {
      const sale = getRequest.result;
      if (sale) {
        sale.synced = true;
        store.put(sale);
      }
      resolve();
    };
    getRequest.onerror = () => reject(getRequest.error);
    tx.oncomplete = () => db.close();
  });
}

/**
 * Mark a sale sync as failed (store the error)
 */
export async function markSaleSyncError(id: number, error: string): Promise<void> {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const getRequest = store.get(id);

    getRequest.onsuccess = () => {
      const sale = getRequest.result;
      if (sale) {
        sale.syncError = error;
        store.put(sale);
      }
      resolve();
    };
    getRequest.onerror = () => reject(getRequest.error);
    tx.oncomplete = () => db.close();
  });
}

/**
 * Get count of pending sales
 */
export async function getPendingSaleCount(): Promise<number> {
  const pending = await getPendingSales();
  return pending.length;
}

/**
 * Sync all pending sales to server
 * Returns { synced: number, failed: number }
 */
export async function syncPendingSales(
  apiPost: (url: string, data: any) => Promise<any>
): Promise<{ synced: number; failed: number }> {
  const pending = await getPendingSales();

  if (pending.length === 0) {
    return { synced: 0, failed: 0 };
  }

  console.log(`[SYNC] Syncing ${pending.length} offline sales...`);
  let synced = 0;
  let failed = 0;

  for (const sale of pending) {
    try {
      const response = await apiPost('/in-store-sales', sale.saleData);

      if (response.data?.success) {
        await markSaleSynced(sale.id!);
        synced++;
        console.log(`[SYNC] ✓ Synced ${sale.localId} -> ${response.data.data?.saleNumber}`);
      } else {
        await markSaleSyncError(sale.id!, response.data?.message || 'Unknown error');
        failed++;
        console.warn(`[SYNC] ✗ Failed ${sale.localId}:`, response.data?.message);
      }
    } catch (error: any) {
      await markSaleSyncError(sale.id!, error.message || 'Network error');
      failed++;
      console.error(`[SYNC] ✗ Error syncing ${sale.localId}:`, error.message);
    }
  }

  console.log(`[SYNC] Done: ${synced} synced, ${failed} failed`);
  return { synced, failed };
}
