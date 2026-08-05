// IndexedDB store for the browser-only (GitHub Pages) build. Mirrors the server's SQLite schema —
// same tables, same autoincrement ids, same field names — so `localApi` can satisfy the exact
// interface the pages already call and nothing upstream has to know which backend is live.
//
// ponytail: a ~60-line promise wrapper instead of the `idb` package. This is the only IndexedDB in
// the app; a dependency would be bigger than the code it saves.

export type StoreName = 'athletes' | 'media' | 'blobs' | 'analyses' | 'bodycomp';

const DB_NAME = 'living-sculpture';
const DB_VERSION = 1;

let dbp: Promise<IDBDatabase> | null = null;

export function db(): Promise<IDBDatabase> {
  if (dbp) return dbp;
  dbp = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const d = req.result;
      if (!d.objectStoreNames.contains('athletes')) d.createObjectStore('athletes', { keyPath: 'id', autoIncrement: true });
      if (!d.objectStoreNames.contains('media')) {
        const s = d.createObjectStore('media', { keyPath: 'id', autoIncrement: true });
        s.createIndex('athlete_id', 'athlete_id');
        s.createIndex('file_name', 'file_name', { unique: true });
      }
      if (!d.objectStoreNames.contains('blobs')) d.createObjectStore('blobs'); // key = file_name
      if (!d.objectStoreNames.contains('analyses')) {
        const s = d.createObjectStore('analyses', { keyPath: 'id', autoIncrement: true });
        s.createIndex('media_id', 'media_id');
        s.createIndex('athlete_id', 'athlete_id');
      }
      if (!d.objectStoreNames.contains('bodycomp')) {
        const s = d.createObjectStore('bodycomp', { keyPath: 'id', autoIncrement: true });
        s.createIndex('athlete_id', 'athlete_id');
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('IndexedDB unavailable'));
  });
  return dbp;
}

function wrap<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function tx<T>(stores: StoreName | StoreName[], mode: IDBTransactionMode, fn: (t: IDBTransaction) => Promise<T> | T): Promise<T> {
  const d = await db();
  const t = d.transaction(stores, mode);
  const out = await fn(t);
  await new Promise<void>((resolve, reject) => {
    t.oncomplete = () => resolve();
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error ?? new Error('transaction aborted'));
  });
  return out;
}

export const get = <T>(t: IDBTransaction, store: StoreName, key: IDBValidKey) => wrap<T>(t.objectStore(store).get(key) as IDBRequest<T>);
export const getAll = <T>(t: IDBTransaction, store: StoreName) => wrap<T[]>(t.objectStore(store).getAll() as IDBRequest<T[]>);
export const put = <T>(t: IDBTransaction, store: StoreName, value: T, key?: IDBValidKey) =>
  wrap(t.objectStore(store).put(value as unknown as object, key) as IDBRequest<IDBValidKey>);
export const del = (t: IDBTransaction, store: StoreName, key: IDBValidKey) => wrap(t.objectStore(store).delete(key) as IDBRequest<undefined>);

/** All rows of `store` whose `index` equals `value`. */
export function byIndex<T>(t: IDBTransaction, store: StoreName, index: string, value: IDBValidKey): Promise<T[]> {
  return wrap<T[]>(t.objectStore(store).index(index).getAll(value) as IDBRequest<T[]>);
}

/** `datetime('now')` in SQLite's format, so rows sort and compare identically across backends. */
export function now(): string {
  return new Date().toISOString().replace('T', ' ').slice(0, 19);
}

// ---- Object URLs ---------------------------------------------------------------------------------
// Media lives in IndexedDB as Blobs but the UI wants a `src`. Mint one object URL per file and keep
// it — the alternative (revoke on unmount) breaks any <img> still holding the old src.
// ponytail: never revoked. Bounded by the number of distinct files viewed in one page session.
const urlCache = new Map<string, string>();

export async function blobUrl(fileName: string | null | undefined): Promise<string | null> {
  if (!fileName) return null;
  const hit = urlCache.get(fileName);
  if (hit) return hit;
  const blob = await tx('blobs', 'readonly', (t) => get<Blob>(t, 'blobs', fileName));
  if (!blob) return null;
  const url = URL.createObjectURL(blob);
  urlCache.set(fileName, url);
  return url;
}

export function forgetBlobUrl(fileName: string | null | undefined): void {
  if (!fileName) return;
  const url = urlCache.get(fileName);
  if (url) {
    URL.revokeObjectURL(url);
    urlCache.delete(fileName);
  }
}

/** Rough "is this browser going to let me keep gigabytes of photos" check, for the UI to surface. */
export async function storageEstimate(): Promise<{ usage: number; quota: number; persisted: boolean } | null> {
  if (!navigator.storage?.estimate) return null;
  const { usage = 0, quota = 0 } = await navigator.storage.estimate();
  const persisted = (await navigator.storage.persisted?.()) ?? false;
  return { usage, quota, persisted };
}
