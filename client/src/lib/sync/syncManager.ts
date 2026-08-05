// Sync manager — mirrors Tachyread's (app/src/features/sync/syncManager.js): provider-agnostic,
// export → upload and download → merge-import, with a read-merge-write two-way sync so concurrent
// edits on two devices converge instead of clobbering.
//
// The difference is where the data lives. Tachyread reads IndexedDB; this app's data is on its own
// server, so "export" is GET /api/backup/export and "import" is POST /api/backup/import. The merge
// itself is the server's job (insert-if-absent on natural keys), which keeps this file the same
// shape as Tachyread's.
//
// Two payloads, mirroring Tachyread's progress/library split:
//   • the DATA bundle — athletes, analyses, measurements, media metadata. Small; every sync.
//   • MEDIA bytes — one Drive file per photo/video, immutable (UUID names), so syncing is purely
//     "copy what the other side is missing". Opt-in, because videos are large.

import { getSyncProvider, DATA_FILE_NAME, type SyncConfig } from './syncProviders';

export interface SyncResult {
  at: number;
  bytes: number;
  added?: { athletes: number; media: number; analyses: number; bodycomp: number };
  media?: { uploaded: number; downloaded: number; skipped: number };
}

async function connectTo(providerId: string, cfg: SyncConfig, opts: { silent?: boolean }) {
  const p = getSyncProvider(providerId);
  if (!p) throw new Error('Unknown sync target.');
  if (!p.supported()) throw new Error('This browser can’t use that sync target.');
  const gate = p.available(cfg);
  if (gate !== true) throw new Error(gate.reason);
  return { p, conn: (await p.connect(cfg, opts)) as never };
}

/** Turn a truncated/corrupt cloud file into a clear message instead of a raw JSON parse error. */
async function parseSyncBlob(blob: Blob): Promise<unknown> {
  const text = await blob.text();
  try {
    return JSON.parse(text);
  } catch {
    throw new Error('The sync file is corrupt or incomplete — back up again from a device that has your data.');
  }
}

async function exportBundle(): Promise<unknown> {
  const r = await fetch('/api/backup/export');
  if (!r.ok) throw new Error(`Could not read your data (${r.status}).`);
  return r.json();
}

export async function backupToProvider(providerId: string, cfg: SyncConfig, opts: { silent?: boolean } = {}): Promise<SyncResult> {
  const { p, conn } = await connectTo(providerId, cfg, opts);
  const blob = new Blob([JSON.stringify(await exportBundle())], { type: 'application/json' });
  await p.upload(conn, DATA_FILE_NAME, blob);
  return { at: Date.now(), bytes: blob.size };
}

export async function restoreFromProvider(providerId: string, cfg: SyncConfig, opts: { silent?: boolean } = {}): Promise<SyncResult> {
  const { p, conn } = await connectTo(providerId, cfg, opts);
  const blob = await p.download(conn, DATA_FILE_NAME);
  if (!blob) throw new Error('No Living Sculpture backup found in that location yet — back up first.');
  const r = await fetch('/api/backup/import', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(await parseSyncBlob(blob)),
  });
  const body = (await r.json().catch(() => ({}))) as { error?: string; added?: SyncResult['added'] };
  if (!r.ok) throw new Error(body.error || `Restore failed (${r.status}).`);
  return { at: Date.now(), bytes: blob.size, added: body.added };
}

/**
 * Copy media bytes both ways. Files are immutable (UUID names), so "does the other side have this
 * name?" is the whole sync check — nothing is ever re-uploaded or overwritten.
 */
export async function syncMediaWithProvider(
  providerId: string,
  cfg: SyncConfig,
  opts: { silent?: boolean; onProgress?: (done: number, total: number) => void } = {}
): Promise<{ uploaded: number; downloaded: number; skipped: number }> {
  const { p, conn } = await connectTo(providerId, cfg, opts);
  const manifest = (await fetch('/api/backup/media-manifest').then((r) => r.json())) as { present: string[]; missing: string[] };
  const remote = new Set(await p.list(conn));

  const toUpload = manifest.present.filter((n) => !remote.has(n));
  const toDownload = manifest.missing.filter((n) => remote.has(n));
  const total = toUpload.length + toDownload.length;
  let done = 0;
  let uploaded = 0;
  let downloaded = 0;

  // ponytail: sequential. Photos are big and Drive rate-limits; a parallel pool is the upgrade if
  // a first full sync ever feels slow.
  for (const name of toUpload) {
    const res = await fetch(`/media/${name}`);
    if (res.ok) {
      await p.upload(conn, name, await res.blob());
      uploaded++;
    }
    opts.onProgress?.(++done, total);
  }
  for (const name of toDownload) {
    const blob = await p.download(conn, name);
    if (blob) {
      const put = await fetch(`/api/backup/media-file/${encodeURIComponent(name)}`, {
        method: 'PUT',
        headers: { 'content-type': blob.type || 'application/octet-stream' },
        body: blob,
      });
      if (put.ok) downloaded++;
    }
    opts.onProgress?.(++done, total);
  }
  return { uploaded, downloaded, skipped: manifest.present.length - uploaded };
}

/**
 * Read-merge-write: pull remote and merge into local, then push the merged result — so two devices
 * converge. `silent` connects without a popup (auto-sync / boot).
 */
export async function syncWithProvider(
  providerId: string,
  cfg: SyncConfig,
  opts: { silent?: boolean; onProgress?: (done: number, total: number) => void } = {}
): Promise<SyncResult> {
  let added: SyncResult['added'];
  try {
    added = (await restoreFromProvider(providerId, cfg, opts)).added;
  } catch (e) {
    // First sync: nothing remote yet. Any other failure is real and should surface.
    if (!/No Living Sculpture backup found/.test((e as Error)?.message || '')) throw e;
  }
  const out = await backupToProvider(providerId, cfg, opts);
  if (cfg.media) out.media = await syncMediaWithProvider(providerId, cfg, opts);
  return { ...out, added };
}
