// The cloud copy as records (house standard 30). The backup bundle is nested and carries no ids, so
// for sync it is flattened into four lists of records keyed by the same natural keys the importers
// already match on, each with an `updatedAt`; a deletion is a record too (`deleted: true`, a tombstone)
// so a stale device cannot bring it back. Merging is appFont.cloud.mergeRecords, record by record.
//
// Change times come from comparing this device's data with the copy it last synced: anything that
// differs is stamped "now", anything that vanished becomes a tombstone. That keeps change tracking in
// this one file instead of in every edit path of both stores (browser and self-hosted server).
// ponytail: a change is stamped when it is first SYNCED, not when it was made, so if two devices edit the
// SAME record, the one that syncs later wins. Per-edit stamps in both stores are the upgrade if that bites.

export const SYNC_FILE = 'living-sculpture-sync.json';
export const SYNC_APP = 'living-sculpture-sync';
const KINDS = ['athletes', 'media', 'analyses', 'bodycomp'] as const;
type Kind = (typeof KINDS)[number];
const TOMBSTONE_DAYS = 90;

export interface Rec { id: string; updatedAt: number; deleted?: boolean; [k: string]: unknown }
export type Doc = { app: string; schema: 1 } & Record<Kind, Rec[]>;
type Obj = Record<string, unknown>;
type Merge = (local: Rec[], cloud: Rec[]) => Rec[];

const key = (...parts: unknown[]) => JSON.stringify(parts.map((p) => (p == null ? '' : String(p))));
export const athleteKey = (name: unknown) => String(name ?? '').trim().toLowerCase();

/** The nested backup bundle (either store's export) as flat records with natural-key ids, unstamped. */
export function flatten(bundle: unknown): Doc {
  const doc: Doc = { app: SYNC_APP, schema: 1, athletes: [], media: [], analyses: [], bodycomp: [] };
  const athletes = ((bundle as Obj)?.athletes as Obj[]) ?? [];
  for (const a of athletes) {
    const ak = athleteKey(a?.name);
    if (!ak) continue;
    const { media, bodycomp, ...fields } = a;
    doc.athletes.push({ ...fields, id: key(ak), updatedAt: 0 });
    for (const m of (media as Obj[]) ?? []) {
      if (!m?.file_name) continue;
      const { analyses, ...mf } = m;
      doc.media.push({ ...mf, id: key(m.file_name), athlete: ak, updatedAt: 0 });
      for (const an of (analyses as Obj[]) ?? []) {
        doc.analyses.push({ ...an, id: key(m.file_name, an.source, an.created_at), media: m.file_name, updatedAt: 0 });
      }
    }
    for (const b of (bodycomp as Obj[]) ?? []) {
      if (!b?.measured_at) continue;
      doc.bodycomp.push({ ...b, id: key(ak, b.measured_at, b.source || 'manual'), athlete: ak, updatedAt: 0 });
    }
  }
  return doc;
}

const body = (r: Rec) => {
  const { updatedAt: _u, ...rest } = r;
  return JSON.stringify(rest, Object.keys(rest).sort());
};

/**
 * Give `cur` (this device now) its change times against `prev` (what this device last synced):
 * unchanged keeps its time, changed or new gets `now`, gone becomes a tombstone. With no `prev`
 * (first sync on this device) everything counts as old, so the cloud's copy wins any clash.
 * `adopt` takes prev's time for every record prev knows (used after applying a merge locally).
 */
export function stamp(cur: Doc, prev: Doc | null, now: number, adopt = false): Doc {
  const out = { ...cur } as Doc;
  for (const k of KINDS) {
    const old = new Map((prev?.[k] ?? []).map((r) => [r.id, r]));
    const live = cur[k].map((r) => {
      const p = old.get(r.id);
      if (!prev) return { ...r, updatedAt: 0 };
      if (p && !p.deleted && (adopt || body(p) === body({ ...r, updatedAt: 0 }))) return { ...r, updatedAt: p.updatedAt };
      return { ...r, updatedAt: p && adopt ? p.updatedAt : now };
    });
    const here = new Set(live.map((r) => r.id));
    const gone = [...old.values()]
      .filter((p) => !here.has(p.id) && (p.deleted ? now - p.updatedAt < TOMBSTONE_DAYS * 864e5 : true))
      .map((p) => (p.deleted ? p : { id: p.id, deleted: true, updatedAt: now }));
    out[k] = [...live, ...gone];
  }
  return out;
}

/** Record-by-record merge of two docs; the latest change to each record wins. */
export function mergeDocs(local: Doc, cloud: Doc, mergeRecords: Merge): Doc {
  const out = { app: SYNC_APP, schema: 1 } as Doc;
  for (const k of KINDS) out[k] = mergeRecords(local[k] ?? [], Array.isArray(cloud?.[k]) ? cloud[k] : []);
  return out;
}

/** Check a cloud copy before trusting it: it came from another device (standard 22). */
export function isDoc(v: unknown): v is Doc {
  const d = v as Doc;
  return !!d && d.app === SYNC_APP && KINDS.every((k) => Array.isArray(d[k]) && d[k].every((r) => r && typeof r.id === 'string' && typeof r.updatedAt === 'number'));
}

export interface Deletion { kind: Kind; key: string[] }

/** A merged doc as what the stores understand: a nested bundle to upsert, then the deletions. */
export function toApply(doc: Doc): { bundle: Obj; deletions: Deletion[] } {
  const live = (k: Kind) => doc[k].filter((r) => !r.deleted);
  const strip = (r: Rec, ...drop: string[]) => {
    const o: Obj = { ...r };
    for (const f of ['id', 'updatedAt', 'deleted', ...drop]) delete o[f];
    return o;
  };
  const media = live('media');
  const analyses = live('analyses');
  const bodycomp = live('bodycomp');
  const athletes = live('athletes').map((a) => {
    const ak = athleteKey(a.name);
    return {
      ...strip(a),
      media: media.filter((m) => m.athlete === ak).map((m) => ({
        ...strip(m, 'athlete'),
        analyses: analyses.filter((an) => an.media === m.file_name).map((an) => strip(an, 'media')),
      })),
      bodycomp: bodycomp.filter((b) => b.athlete === ak).map((b) => strip(b, 'athlete')),
    };
  });
  const deletions = KINDS.flatMap((kind) => doc[kind].filter((r) => r.deleted).map((r) => ({ kind, key: JSON.parse(r.id) as string[] })));
  return { bundle: { app: 'living-sculpture-backup', version: 1, athletes }, deletions };
}
