// Cloud sync through font.js's appFont.cloud (house standards 1 and 30). No vendor code here: the
// reader picks the cloud once, on the hub, and every app talks to it through the same door.
//
// Two payloads:
//   • the DATA: athletes, analyses, measurements, media metadata, kept in step with
//     appFont.cloud.syncDoc as records (syncDoc.ts), so no device ever overwrites newer data.
//   • MEDIA bytes: one cloud file per photo/video, immutable (UUID names), so syncing is purely
//     "copy what the other side is missing". Opt-in, because videos are large.
//
// The data lives in the browser (IndexedDB) on the Pages build, or on the self-hosted server.

import { IS_STATIC } from '../../api';
import * as local from '../local/backup';
import { t } from '../i18n';
import { SYNC_FILE, flatten, stamp, mergeDocs, isDoc, toApply, type Doc, type Rec, type Deletion } from './syncDoc';

/** The file the app wrote before record sync (2026-11). Read once per device, merged in, never written. */
export const LEGACY_FILE = 'living-sculpture-data.json';
const LEGACY_DONE = 'ls.sync-legacy';

interface Cloud {
  signIn(o?: { silent?: boolean }): Promise<unknown>;
  signedIn(): boolean;
  signOut(): void;
  label(): string;
  read(name: string): Promise<string | null>;
  readBytes(name: string): Promise<ArrayBuffer | null>;
  write(name: string, body: string | Blob, mime?: string): Promise<void>;
  list(prefix?: string): Promise<{ name: string }[]>;
  remove(name: string): Promise<boolean>;
  syncDoc(name: string, h: { load(): unknown; save(doc: unknown): unknown; merge(a: unknown, b: unknown): unknown }): Promise<{ pulled: boolean; pushed: boolean }>;
  mergeRecords(a: Rec[], b: Rec[]): Rec[];
}
export function cloud(): Cloud | null {
  return (typeof window !== 'undefined' && (window as unknown as { appFont?: { cloud?: Cloud } }).appFont?.cloud) || null;
}
function needCloud(): Cloud {
  const c = cloud();
  if (!c) throw new Error(t('Cloud sync is not available (the shared house script did not load).'));
  return c;
}

export interface SyncResult {
  at: number;
  pulled: boolean;
  pushed: boolean;
  media?: { uploaded: number; downloaded: number; removed: number };
}

// ---- the last-synced copy, in the app's own small database (ls-sync) ------------------------------
export const SYNC_IDB_NAME = 'ls-sync';
function idb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(SYNC_IDB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore('handles'); // v1 name kept: it held the old folder handle
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
async function kv<T>(k: string, v?: T): Promise<T | null> {
  const db = await idb();
  // Close after each use: an open connection would block deleteDatabase in "erase everything".
  return new Promise<T | null>((resolve, reject) => {
    const tx = db.transaction('handles', v === undefined ? 'readonly' : 'readwrite');
    const r = v === undefined ? tx.objectStore('handles').get(k) : tx.objectStore('handles').put(v, k);
    tx.oncomplete = () => resolve(v === undefined ? ((r.result as T) ?? null) : v);
    tx.onerror = () => reject(tx.error);
  }).finally(() => db.close());
}

// The two backends behind one shape: the server's REST routes, or IndexedDB in the static build.
export const store = {
  async exportBundle(): Promise<unknown> {
    if (IS_STATIC) return local.exportBundle();
    const r = await fetch('/api/backup/export');
    if (!r.ok) throw new Error(t('Could not read your data ({status}).', { status: r.status }));
    return r.json();
  },
  async importBundle(bundle: unknown): Promise<void> {
    if (IS_STATIC) return void (await local.importBundle(bundle));
    await post('/api/backup/import', bundle);
  },
  async apply(bundle: unknown, deletions: Deletion[]): Promise<void> {
    if (IS_STATIC) {
      await local.importBundle(bundle, { upsert: true });
      await local.applyDeletions(deletions);
      return;
    }
    await post('/api/backup/apply', { bundle, deletions });
  },
  async manifest(): Promise<{ present: string[]; missing: string[] }> {
    if (IS_STATIC) return local.mediaManifest();
    return fetch('/api/backup/media-manifest').then((r) => r.json());
  },
  async readMedia(name: string): Promise<Blob | null> {
    if (IS_STATIC) return local.getMediaBlob(name);
    const r = await fetch(`/media/${name}`);
    return r.ok ? r.blob() : null;
  },
  async writeMedia(name: string, blob: Blob): Promise<boolean> {
    if (IS_STATIC) return local.putMediaFile(name, blob);
    const r = await fetch(`/api/backup/media-file/${encodeURIComponent(name)}`, {
      method: 'PUT',
      headers: { 'content-type': blob.type || 'application/octet-stream' },
      body: blob,
    });
    return r.ok;
  },
};
async function post(url: string, payload: unknown) {
  const r = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) });
  const body = (await r.json().catch(() => ({}))) as { error?: string };
  if (!r.ok) throw new Error(body.error || t('Restore failed ({status}).', { status: r.status }));
}

type Store = Pick<typeof store, 'exportBundle' | 'apply'>;
type DocCloud = Pick<Cloud, 'syncDoc' | 'mergeRecords'>;
type Memory = { get(): Promise<Doc | null>; set(d: Doc): Promise<unknown> };
const memory: Memory = { get: () => kv<Doc>('lastDoc'), set: (d) => kv('lastDoc', d) };

/** One data sync: this device's records against the cloud's, merged record by record. */
export async function syncData(c: DocCloud = needCloud(), s: Store = store, mem: Memory = memory, now = Date.now): Promise<{ pulled: boolean; pushed: boolean }> {
  const prev = await mem.get();
  let merged: Doc | null = null;
  let loaded: Doc | null = null;
  const r = await c.syncDoc(SYNC_FILE, {
    load: async () => (loaded = stamp(flatten(await s.exportBundle()), prev, now())),
    save: async (doc) => {
      merged = doc as Doc;
      const { bundle, deletions } = toApply(merged);
      await s.apply(bundle, deletions);
    },
    merge: (a, b) => {
      // The cloud copy came from another device: check it like an import (standard 22).
      if (!isDoc(b)) throw new Error(t('The cloud copy is not a Living Sculpture sync file. Nothing was changed.'));
      return mergeDocs(a as Doc, b, (x, y) => c.mergeRecords(x, y));
    },
  });
  // Remember what this device now holds, with the merged change times (and tombstones) carried over.
  const nowDoc = flatten(await s.exportBundle());
  await mem.set(stamp(nowDoc, merged ?? loaded, now(), true));
  return r;
}

/** Before record sync, devices wrote one whole-file copy. Fold it in once (insert-if-absent: never overwrites). */
async function foldLegacy(c: Cloud) {
  if (localStorage.getItem(LEGACY_DONE)) return;
  const text = await c.read(LEGACY_FILE);
  if (text) {
    let bundle: unknown = null;
    try {
      bundle = JSON.parse(text);
    } catch { /* a corrupt old copy: skip it, the record sync still runs */ }
    if (bundle) await store.importBundle(bundle);
  }
  localStorage.setItem(LEGACY_DONE, String(Date.now()));
}

/**
 * Copy media bytes both ways. Files are immutable (UUID names), so "does the other side have this
 * name?" is the whole check: nothing is ever re-uploaded or overwritten. A photo deleted on any
 * device (a tombstone in the last-synced copy) is removed from the cloud too.
 */
export async function syncMedia(opts: { onProgress?: (done: number, total: number) => void } = {}) {
  const c = needCloud();
  const manifest = await store.manifest();
  const remote = new Set((await c.list()).map((f) => f.name));
  const gone = new Set(((await memory.get())?.media ?? []).filter((m) => m.deleted).map((m) => (JSON.parse(m.id) as string[])[0]));

  const toUpload = manifest.present.filter((n) => !remote.has(n));
  const toDownload = manifest.missing.filter((n) => remote.has(n));
  const toRemove = [...gone].filter((n) => remote.has(n));
  const total = toUpload.length + toDownload.length + toRemove.length;
  let done = 0, uploaded = 0, downloaded = 0, removed = 0;

  // ponytail: sequential. Photos are big and Drive rate-limits; a parallel pool is the upgrade if
  // a first full sync ever feels slow.
  for (const name of toUpload) {
    const blob = await store.readMedia(name);
    if (blob) {
      await c.write(name, blob, blob.type || 'application/octet-stream');
      uploaded++;
    }
    opts.onProgress?.(++done, total);
  }
  for (const name of toDownload) {
    const bytes = await c.readBytes(name);
    if (bytes && (await store.writeMedia(name, new Blob([bytes])))) downloaded++;
    opts.onProgress?.(++done, total);
  }
  for (const name of toRemove) {
    if (await c.remove(name)) removed++;
    opts.onProgress?.(++done, total);
  }
  return { uploaded, downloaded, removed };
}

/** Sign in (silently when asked), fold in the old file once, sync the data, then the media if wanted. */
export async function syncNow(opts: { silent?: boolean; media?: boolean; onProgress?: (done: number, total: number) => void } = {}): Promise<SyncResult> {
  const c = needCloud();
  if (!c.signedIn()) await c.signIn({ silent: !!opts.silent });
  await foldLegacy(c);
  const r = await syncData(c);
  const out: SyncResult = { at: Date.now(), ...r };
  if (opts.media) out.media = await syncMedia(opts);
  return out;
}

// ---- settings and automatic sync ------------------------------------------------------------------
export interface SyncConfig { auto: boolean; media: boolean; lastSync: number }
const CFG_KEY = 'ls.sync';
export function loadSyncConfig(): SyncConfig {
  try {
    const raw = JSON.parse(localStorage.getItem(CFG_KEY) || '{}') as Partial<SyncConfig>;
    return { auto: !!raw.auto, media: raw.media !== false, lastSync: Number(raw.lastSync) || 0 };
  } catch {
    return { auto: false, media: true, lastSync: 0 };
  }
}
export function saveSyncConfig(cfg: SyncConfig) {
  localStorage.setItem(CFG_KEY, JSON.stringify(cfg));
}

let running: Promise<SyncResult> | null = null;
/** One sync at a time: a second call while one runs gets the same result. */
export function syncOnce(opts: Parameters<typeof syncNow>[0] = {}): Promise<SyncResult> {
  return (running ??= syncNow(opts)
    .then((r) => {
      saveSyncConfig({ ...loadSyncConfig(), lastSync: r.at });
      return r;
    })
    .finally(() => (running = null)));
}

/**
 * With "sync automatically" on: sync on start, when the app comes back into view, and when the
 * network returns. Silent only: it never shows a sign-in window. `onPulled` refreshes the screens.
 * ponytail: no "shortly after each change" sync; the next focus or start picks the change up.
 */
export function startAutoSync(onPulled: () => void): () => void {
  const go = () => {
    const cfg = loadSyncConfig();
    if (!cfg.auto || !cloud() || !navigator.onLine) return;
    syncOnce({ silent: true, media: cfg.media }).then((r) => r.pulled && onPulled(), () => { /* offline or not signed in yet */ });
  };
  const onVis = () => document.visibilityState === 'visible' && go();
  go();
  document.addEventListener('visibilitychange', onVis);
  window.addEventListener('online', go);
  return () => {
    document.removeEventListener('visibilitychange', onVis);
    window.removeEventListener('online', go);
  };
}
