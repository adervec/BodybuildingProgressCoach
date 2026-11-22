/**
 * Sync (house standard 30): two devices against one pretend cloud must never lose each other's
 * work, and a deletion must stay deleted. Each device is its own IndexedDB (fake-indexeddb), driven
 * through the real export / apply of the browser build. The media diff and the path-traversal gate
 * that guards writing synced file names to disk are pinned here too.
 */
import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { safeMediaName } from '../../../../server/src/lib/safeName';
import { tx, put, getAll, closeDb } from '../local/store';
import * as local from '../local/backup';
import { syncData, syncMedia, store } from './syncManager';
import { flatten, stamp, type Doc, type Rec } from './syncDoc';

vi.mock('../../api', () => ({ IS_STATIC: true }));

// ---- the pretend cloud: the same contract as font.js's syncDoc / mergeRecords ---------------------
function stableJSON(v: unknown) {
  return JSON.stringify(v, (_k, x) => (x && typeof x === 'object' && !Array.isArray(x) ? Object.keys(x).sort().reduce((o, k) => ({ ...o, [k]: x[k] }), {}) : x));
}
function mergeRecords(a: Rec[], b: Rec[]) {
  const out = new Map<string, Rec>();
  for (const r of [...b, ...a]) {
    const o = out.get(r.id);
    if (!o || r.updatedAt > o.updatedAt || (r.updatedAt === o.updatedAt && stableJSON(r) > stableJSON(o))) out.set(r.id, r);
  }
  return [...out.values()];
}
function pretendCloud() {
  let file: { text: string; version: number } | null = null;
  const seen = new Map<string, number>(); // per device: the version it last saw
  const forDevice = (dev: string) => ({
    mergeRecords,
    async syncDoc(_name: string, h: { load(): unknown; save(d: unknown): unknown; merge(a: unknown, b: unknown): unknown }) {
      const localDoc = await h.load();
      let doc = localDoc;
      let pulled = false;
      if (file && file.version !== seen.get(dev)) {
        doc = h.merge(localDoc, JSON.parse(file.text));
        if (stableJSON(doc) !== stableJSON(localDoc)) {
          await h.save(doc);
          pulled = true;
        }
      }
      const text = JSON.stringify(doc);
      const pushed = !file || stableJSON(JSON.parse(file.text)) !== stableJSON(doc);
      if (pushed) file = { text, version: (file?.version ?? 0) + 1 };
      seen.set(dev, file!.version);
      return { pulled, pushed };
    },
  });
  return { forDevice, read: () => (file ? (JSON.parse(file.text) as Doc) : null) };
}

// ---- two devices, each its own browser database --------------------------------------------------
const dbs: Record<string, IDBFactory> = {};
const mem: Record<string, Doc | null> = {};
async function on(dev: string) {
  await closeDb();
  globalThis.indexedDB = dbs[dev] ??= new IDBFactory();
}
const memory = (dev: string) => ({ get: async () => mem[dev] ?? null, set: async (d: Doc) => void (mem[dev] = d) });
let clock = 1_000_000;
const tick = () => (clock += 1000);
async function sync(cloud: ReturnType<typeof pretendCloud>, dev: string) {
  await on(dev);
  return syncData(cloud.forDevice(dev), store, memory(dev), tick);
}
const names = async () => (await tx('athletes', 'readonly', (t) => getAll<{ name: string; notes: string | null }>(t, 'athletes'))).map((a) => a.name).sort();
async function addAthlete(name: string, notes: string | null = null) {
  await tx('athletes', 'readwrite', (t) => put(t, 'athletes', { name, category: 'classic_physique', height_cm: null, notes, created_at: '2026-01-01 10:00:00' }));
}
async function editNotes(name: string, notes: string) {
  await tx('athletes', 'readwrite', async (t) => {
    const a = (await getAll<{ id: number; name: string }>(t, 'athletes')).find((x) => x.name === name)!;
    await put(t, 'athletes', { ...a, notes });
  });
}

describe('two-device sync (standard 30)', () => {
  it('keeps both devices’ edits and keeps a deletion deleted', async () => {
    const cloud = pretendCloud();
    await on('A');
    await addAthlete('Ada');
    await addAthlete('Bo');
    await sync(cloud, 'A');
    await sync(cloud, 'B'); // B starts empty and pulls both
    expect(await names()).toEqual(['Ada', 'Bo']);

    // A edits Ada and deletes Bo; B (stale, not synced since) adds Cy and edits nothing else
    await on('A');
    await editNotes('Ada', 'cut phase');
    await local.applyDeletions([{ kind: 'athletes', key: ['bo'] }]);
    await sync(cloud, 'A');
    await on('B');
    await addAthlete('Cy');
    await sync(cloud, 'B');

    expect(await names()).toEqual(['Ada', 'Cy']); // Bo stays deleted, Cy kept
    const ada = (await tx('athletes', 'readonly', (t) => getAll<{ name: string; notes: string }>(t, 'athletes'))).find((a) => a.name === 'Ada');
    expect(ada?.notes).toBe('cut phase'); // A's edit arrived

    await sync(cloud, 'A');
    expect(await names()).toEqual(['Ada', 'Cy']); // and A gets Cy
    const c = cloud.read()!;
    expect(c.athletes.find((r) => r.id === JSON.stringify(['bo']))?.deleted).toBe(true);
  });

  it('a stale device does not undo a newer edit with its older copy', async () => {
    const cloud = pretendCloud();
    await on('C');
    await addAthlete('Di', 'old');
    await sync(cloud, 'C');
    await sync(cloud, 'D');
    await on('C');
    await editNotes('Di', 'new');
    await sync(cloud, 'C');
    await sync(cloud, 'D'); // D never touched Di: must take C's edit, not push "old" back
    const di = (await tx('athletes', 'readonly', (t) => getAll<{ name: string; notes: string }>(t, 'athletes')))[0];
    expect(di.notes).toBe('new');
    expect(cloud.read()!.athletes[0].notes).toBe('new');
  });

  it('a first sync counts this device’s records as old, so the cloud wins a clash', () => {
    const cur = flatten({ athletes: [{ name: 'Ev', notes: 'x' }] });
    expect(stamp(cur, null, 5000).athletes[0].updatedAt).toBe(0);
    const later = stamp(flatten({ athletes: [] }), stamp(cur, null, 5000), 9000);
    expect(later.athletes[0]).toMatchObject({ deleted: true, updatedAt: 9000 });
  });

  it('refuses a cloud copy that is not a sync file', async () => {
    await on('E');
    const bad = { mergeRecords, syncDoc: async (_n: string, h: { load(): unknown; merge(a: unknown, b: unknown): unknown }) => h.merge(await h.load(), { app: 'x' }) };
    await expect(syncData(bad as never, store, memory('E'), tick)).rejects.toThrow();
  });
});

describe('safeMediaName (path-traversal gate)', () => {
  it('accepts the uuid names the uploader generates', () => {
    expect(safeMediaName('13985898-2ed3-48c6-8557-684228573aca.jpg')).toBe('13985898-2ed3-48c6-8557-684228573aca.jpg');
    expect(safeMediaName('13985898-2ed3-48c6-8557-684228573aca.mp4')).toBeTruthy();
  });

  it('refuses anything that could escape the media directory', () => {
    const bad: unknown[] = [
      '../../../etc/passwd',
      '..\\..\\windows\\system32\\config\\sam',
      '/etc/passwd',
      'C:\\Windows\\win.ini',
      '13985898-2ed3-48c6-8557-684228573aca.jpg/../../evil.sh',
      'sub/13985898-2ed3-48c6-8557-684228573aca.jpg',
      '13985898-2ed3-48c6-8557-684228573aca.jpg\u0000.png',
      'app.db',
      '',
      null,
      42,
    ];
    expect(bad.filter((n) => safeMediaName(n) !== null)).toEqual([]);
  });
});

describe('media sync', () => {
  const A = '13985898-2ed3-48c6-8557-684228573aca.jpg'; // here, not in the cloud
  const B = '2ed39858-48c6-4855-9842-28573aca1398.jpg'; // in the cloud, missing here

  afterEach(() => vi.unstubAllGlobals());

  function fakeCloud(files: Map<string, string>) {
    vi.stubGlobal('window', {
      appFont: {
        cloud: {
          list: async () => [...files.keys()].map((name) => ({ name })),
          write: async (name: string, blob: Blob) => void files.set(name, await blob.text()),
          readBytes: async (name: string) => (files.has(name) ? new TextEncoder().encode(files.get(name)!).buffer : null),
          remove: async (name: string) => files.delete(name),
        },
      },
    });
  }

  it('copies each side only what the other is missing, and never twice', async () => {
    await on('M');
    const files = new Map([[B, 'bytes-b']]);
    fakeCloud(files);
    vi.spyOn(store, 'manifest').mockResolvedValue({ present: [A], missing: [B] });
    vi.spyOn(store, 'readMedia').mockResolvedValue(new Blob(['bytes-a']));
    const written: string[] = [];
    vi.spyOn(store, 'writeMedia').mockImplementation(async (n) => (written.push(n), true));

    expect(await syncMedia()).toMatchObject({ uploaded: 1, downloaded: 1, removed: 0 });
    expect(files.get(A)).toBe('bytes-a');
    expect(written).toEqual([B]);

    vi.spyOn(store, 'manifest').mockResolvedValue({ present: [A, B], missing: [] });
    expect(await syncMedia()).toMatchObject({ uploaded: 0, downloaded: 0 });
    vi.restoreAllMocks();
  });
});
