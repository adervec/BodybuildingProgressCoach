/**
 * "Erase everything" for the browser-only build. Every app by this maker shares the
 * adervec.github.io origin, so this removes ONLY this app's own keys, databases and caches —
 * never localStorage.clear(). The shared font choice belongs to the portal and is left alone.
 * The cloud copy (Drive app folder / sync folder) is not touched; we only disconnect from it.
 */
import { closeDb, DB_NAME } from './store';
import { SYNC_PROVIDERS, SYNC_IDB_NAME } from '../sync/syncProviders';

export const APP_KEYS = ['bpc.disclaimerAck.v1', 'bpc.currentAthleteId', 'ls.sync', 'ls.orientation', 'bpc-coach-reply'];
export const APP_DBS = [DB_NAME, SYNC_IDB_NAME];
const APP_NAME = 'BodybuildingProgressCoach';
const APP_CACHE = /^ls-v\d+$/; // sw.js CACHE

function deleteDb(name: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const r = indexedDB.deleteDatabase(name);
    r.onsuccess = () => resolve();
    r.onerror = () => reject(r.error ?? new Error(`Could not delete ${name}`));
    r.onblocked = () => reject(new Error('Close this app in other tabs, then try again.'));
  });
}

/** Drop only our entries from the portal's shared keys. */
function scrubPortal() {
  try {
    const inst = JSON.parse(localStorage.getItem('portal-installed') || 'null');
    if (inst && typeof inst === 'object') {
      delete inst[APP_NAME];
      localStorage.setItem('portal-installed', JSON.stringify(inst));
    }
    const act = JSON.parse(localStorage.getItem('portal-activity') || 'null');
    if (Array.isArray(act)) localStorage.setItem('portal-activity', JSON.stringify(act.filter((e) => e?.[1] !== APP_NAME)));
  } catch { /* malformed shared key — not ours to repair */ }
}

export async function eraseEverything(): Promise<void> {
  for (const p of SYNC_PROVIDERS) await p.disconnect().catch(() => {});
  await closeDb();
  for (const name of APP_DBS) await deleteDb(name);
  for (const k of APP_KEYS) localStorage.removeItem(k);
  scrubPortal();
  if (typeof caches !== 'undefined') {
    for (const k of await caches.keys()) if (APP_CACHE.test(k)) await caches.delete(k);
  }
}
