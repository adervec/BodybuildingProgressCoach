/**
 * Browser-only backend for the static (GitHub Pages) build — the same surface as `api.ts`, backed by
 * IndexedDB instead of the Express/SQLite server. Response shapes deliberately match the server's
 * routes field for field (including `url` / `thumb_url` / `analyses` / `latest_thumb`), so no page
 * component knows or cares which one is live.
 *
 * The one feature that cannot exist here is AI coaching: it needs a server-side API key. `aiStatus`
 * reports disabled, which is the same path the app already takes when no key is configured.
 */
import type { Athlete, BodyComp, Category, MediaAsset, PoseAnalysis, PoseMetrics, Landmark } from './lib/types';
import { tx, get, getAll, put, del, byIndex, now, blobUrl, forgetBlobUrl } from './lib/local/store';
import { decode, thumbnail, videoPoster } from './lib/local/image';

interface MediaRow {
  id: number;
  athlete_id: number;
  kind: 'photo' | 'video';
  file_name: string;
  thumb_name: string | null;
  mime: string | null;
  width: number | null;
  height: number | null;
  captured_at: string;
  pose_type: string | null;
  division: string | null;
  notes: string | null;
  created_at: string;
}
interface AnalysisRow {
  id: number;
  media_id: number;
  athlete_id: number;
  source: 'geometry' | 'ai' | 'manual';
  pose_type: string | null;
  form_score: number | null;
  symmetry_score: number | null;
  ref_match_score: number | null;
  confidence: number | null;
  metrics: PoseMetrics | null;
  landmarks: Landmark[] | null;
  ai_feedback: null;
  created_at: string;
}
interface BodyCompRow extends Omit<BodyComp, 'measurements'> {
  measurements: Record<string, number>;
  created_at: string;
}

const VALID_CATEGORIES = new Set<string>([
  'men_bodybuilding', 'classic_physique', 'mens_physique', 'bikini', 'wellness', 'figure', 'womens_physique', 'womens_bodybuilding',
]);

async function hydrate(m: MediaRow): Promise<MediaAsset> {
  return { ...m, url: (await blobUrl(m.file_name)) ?? '', thumb_url: await blobUrl(m.thumb_name) };
}

// Maker-portal character sheet: a check-in happened. Same-origin localStorage, nothing leaves the browser.
function portalActivity(amount = 1): void {
  try { const k = 'portal-activity', a = JSON.parse(localStorage.getItem(k) || '[]'); a.push([Math.round(Date.now() / 1000), 'BodybuildingProgressCoach', 'checkin', amount]); localStorage.setItem(k, JSON.stringify(a.slice(-2000))); } catch (_) { /* quota — ignore */ }
}

export const localApi = {
  status: async () => ({ ok: true, ai: { enabled: false, model: '' } }),

  athletes: {
    list: async (): Promise<Athlete[]> =>
      tx(['athletes', 'media', 'bodycomp'], 'readonly', async (t) => {
        const rows = await getAll<Athlete>(t, 'athletes');
        const media = await getAll<MediaRow>(t, 'media');
        const comps = await getAll<BodyCompRow>(t, 'bodycomp');
        return { rows, media, comps };
      }).then(async ({ rows, media, comps }) =>
        Promise.all(
          rows
            .sort((x, y) => y.created_at.localeCompare(x.created_at))
            .map(async (a) => {
              const mine = media.filter((m) => m.athlete_id === a.id);
              const newest = mine.filter((m) => m.thumb_name).sort((x, y) => y.captured_at.localeCompare(x.captured_at))[0];
              return {
                ...a,
                media_count: mine.length,
                comp_count: comps.filter((c) => c.athlete_id === a.id).length,
                // An object URL, not a file name — `thumbSrc` in api.ts accepts either.
                latest_thumb: await blobUrl(newest?.thumb_name),
              };
            })
        )
      ),

    get: async (id: number): Promise<Athlete> => {
      const row = await tx('athletes', 'readonly', (t) => get<Athlete>(t, 'athletes', id));
      if (!row) throw new Error('not found');
      return row;
    },

    create: async (data: { name: string; category: Category; height_cm?: number | null; notes?: string | null }): Promise<Athlete> => {
      const name = String(data?.name ?? '').trim();
      if (!name) throw new Error('name is required');
      const row = {
        name,
        category: VALID_CATEGORIES.has(data.category) ? data.category : ('men_bodybuilding' as Category),
        height_cm: data.height_cm ?? null,
        notes: data.notes ?? null,
        created_at: now(),
      };
      const id = await tx('athletes', 'readwrite', (t) => put(t, 'athletes', row));
      return { ...row, id: Number(id) };
    },

    update: async (id: number, data: Partial<Athlete>): Promise<Athlete> =>
      tx('athletes', 'readwrite', async (t) => {
        const cur = await get<Athlete>(t, 'athletes', id);
        if (!cur) throw new Error('not found');
        const next: Athlete = {
          ...cur,
          name: data.name?.trim() || cur.name,
          category: data.category && VALID_CATEGORIES.has(data.category) ? data.category : cur.category,
          height_cm: data.height_cm ?? cur.height_cm,
          notes: data.notes ?? cur.notes,
        };
        await put(t, 'athletes', next);
        return next;
      }),

    remove: async (id: number): Promise<null> => {
      // Cascade by hand — IndexedDB has no foreign keys.
      const doomed = await tx(['athletes', 'media', 'analyses', 'bodycomp', 'blobs'], 'readwrite', async (t) => {
        const media = await byIndex<MediaRow>(t, 'media', 'athlete_id', id);
        for (const m of media) {
          await del(t, 'media', m.id);
          await del(t, 'blobs', m.file_name);
          if (m.thumb_name) await del(t, 'blobs', m.thumb_name);
        }
        for (const a of await byIndex<AnalysisRow>(t, 'analyses', 'athlete_id', id)) await del(t, 'analyses', a.id);
        for (const b of await byIndex<BodyCompRow>(t, 'bodycomp', 'athlete_id', id)) await del(t, 'bodycomp', b.id);
        await del(t, 'athletes', id);
        return media;
      });
      for (const m of doomed) {
        forgetBlobUrl(m.file_name);
        forgetBlobUrl(m.thumb_name);
      }
      return null;
    },
  },

  media: {
    list: async (athleteId: number, params?: { pose_type?: string; kind?: string }): Promise<MediaAsset[]> => {
      const rows = await tx('media', 'readonly', (t) => byIndex<MediaRow>(t, 'media', 'athlete_id', athleteId));
      const filtered = rows
        .filter((m) => (!params?.pose_type || m.pose_type === params.pose_type) && (!params?.kind || m.kind === params.kind))
        .sort((a, b) => a.captured_at.localeCompare(b.captured_at) || a.id - b.id);
      return Promise.all(filtered.map(hydrate));
    },

    get: async (id: number): Promise<MediaAsset> => {
      const { row, analyses } = await tx(['media', 'analyses'], 'readonly', async (t) => ({
        row: await get<MediaRow>(t, 'media', id),
        analyses: await byIndex<AnalysisRow>(t, 'analyses', 'media_id', id),
      }));
      if (!row) throw new Error('not found');
      return {
        ...(await hydrate(row)),
        analyses: analyses.sort((a, b) => b.created_at.localeCompare(a.created_at)) as unknown as PoseAnalysis[],
      };
    },

    update: async (id: number, data: Partial<MediaAsset>): Promise<MediaAsset> => {
      const next = await tx('media', 'readwrite', async (t) => {
        const cur = await get<MediaRow>(t, 'media', id);
        if (!cur) throw new Error('not found');
        const row: MediaRow = {
          ...cur,
          pose_type: data.pose_type ?? cur.pose_type,
          division: data.division ?? cur.division,
          captured_at: data.captured_at ?? cur.captured_at,
          notes: data.notes ?? cur.notes,
        };
        await put(t, 'media', row);
        return row;
      });
      return hydrate(next);
    },

    remove: async (id: number): Promise<null> => {
      const row = await tx(['media', 'analyses', 'blobs'], 'readwrite', async (t) => {
        const cur = await get<MediaRow>(t, 'media', id);
        if (!cur) throw new Error('not found');
        for (const a of await byIndex<AnalysisRow>(t, 'analyses', 'media_id', id)) await del(t, 'analyses', a.id);
        await del(t, 'blobs', cur.file_name);
        if (cur.thumb_name) await del(t, 'blobs', cur.thumb_name);
        await del(t, 'media', id);
        return cur;
      });
      forgetBlobUrl(row.file_name);
      forgetBlobUrl(row.thumb_name);
      return null;
    },

    upload: async (
      athleteId: number,
      file: File,
      fields: { captured_at?: string; pose_type?: string; division?: string; notes?: string },
      onProgress?: (pct: number) => void
    ): Promise<MediaAsset> => {
      portalActivity();
      if (!file.type.startsWith('image/') && !file.type.startsWith('video/')) {
        throw new Error('Only image and video files are supported.');
      }
      const isImage = file.type.startsWith('image/');
      const ext = (file.name.match(/\.[a-z0-9]{1,5}$/i)?.[0] || (isImage ? '.jpg' : '.mp4')).toLowerCase();
      // Same UUID naming as the server, so a backup restores identically into either backend.
      const fileName = `${crypto.randomUUID()}${ext}`;
      const thumbName = `${fileName.replace(/\.[^.]+$/, '')}.jpg`;

      onProgress?.(30);
      let width: number | null = null;
      let height: number | null = null;
      let thumb: Blob | null = null;
      if (isImage) {
        const dec = await decode(file);
        if (dec) {
          width = dec.width;
          height = dec.height;
          thumb = await thumbnail(dec.bitmap);
          dec.bitmap.close();
        }
      } else {
        const poster = await videoPoster(file);
        thumb = poster.thumb;
        width = poster.width;
        height = poster.height;
      }
      onProgress?.(80);

      const row: Omit<MediaRow, 'id'> = {
        athlete_id: athleteId,
        kind: isImage ? 'photo' : 'video',
        file_name: fileName,
        thumb_name: thumb ? thumbName : null,
        mime: file.type || null,
        width,
        height,
        captured_at: fields.captured_at || new Date().toISOString().slice(0, 10),
        pose_type: fields.pose_type ?? null,
        division: fields.division ?? null,
        notes: fields.notes ?? null,
        created_at: now(),
      };
      const id = await tx(['media', 'blobs'], 'readwrite', async (t) => {
        await put(t, 'blobs', file, fileName);
        if (thumb) await put(t, 'blobs', thumb, thumbName);
        return put(t, 'media', row);
      });
      onProgress?.(100);
      return hydrate({ ...row, id: Number(id) });
    },
  },

  analysis: {
    aiStatus: async () => ({ enabled: false, model: '' }),

    saveGeometry: async (mediaId: number, payload: Record<string, unknown>): Promise<PoseAnalysis> => {
      const row = await tx(['media', 'analyses'], 'readwrite', async (t) => {
        const media = await get<MediaRow>(t, 'media', mediaId);
        if (!media) throw new Error('media not found');
        // Freshest geometry wins, matching the server's delete-then-insert.
        for (const a of await byIndex<AnalysisRow>(t, 'analyses', 'media_id', mediaId)) {
          if (a.source === 'geometry') await del(t, 'analyses', a.id);
        }
        const rec: Omit<AnalysisRow, 'id'> = {
          media_id: mediaId,
          athlete_id: media.athlete_id,
          source: 'geometry',
          pose_type: (payload.pose_type as string) ?? media.pose_type ?? null,
          form_score: (payload.form_score as number) ?? null,
          symmetry_score: (payload.symmetry_score as number) ?? null,
          ref_match_score: (payload.ref_match_score as number) ?? null,
          confidence: (payload.confidence as number) ?? null,
          metrics: (payload.metrics as PoseMetrics) ?? null,
          landmarks: (payload.landmarks as Landmark[]) ?? null,
          ai_feedback: null,
          created_at: now(),
        };
        const id = await put(t, 'analyses', rec);
        return { ...rec, id: Number(id) };
      });
      return row as unknown as PoseAnalysis;
    },

    runAi: async (): Promise<never> => {
      throw new Error(
        'AI coaching needs a server to hold the API key, so it’s unavailable in the browser-only version. Run the app locally (see the README) to enable it.'
      );
    },

    series: async (athleteId: number, poseType?: string): Promise<PoseAnalysis[]> => {
      const { rows, media } = await tx(['analyses', 'media'], 'readonly', async (t) => ({
        rows: await byIndex<AnalysisRow>(t, 'analyses', 'athlete_id', athleteId),
        media: await getAll<MediaRow>(t, 'media'),
      }));
      const byId = new Map(media.map((m) => [m.id, m]));
      const joined = rows
        .filter((r) => r.source === 'geometry')
        .map((r) => ({ r, m: byId.get(r.media_id) }))
        .filter(({ m }) => m && (!poseType || m.pose_type === poseType))
        .sort((a, b) => a.m!.captured_at.localeCompare(b.m!.captured_at) || a.r.id - b.r.id);
      return Promise.all(
        joined.map(async ({ r, m }) => ({
          ...r,
          captured_at: m!.captured_at,
          media_pose: m!.pose_type,
          file_name: m!.file_name,
          kind: m!.kind,
          thumb_url: await blobUrl(m!.thumb_name),
          url: (await blobUrl(m!.file_name)) ?? '',
        }))
      ) as unknown as Promise<PoseAnalysis[]>;
    },
  },

  bodycomp: {
    list: async (athleteId: number): Promise<BodyComp[]> => {
      const rows = await tx('bodycomp', 'readonly', (t) => byIndex<BodyCompRow>(t, 'bodycomp', 'athlete_id', athleteId));
      return rows.sort((a, b) => a.measured_at.localeCompare(b.measured_at)) as unknown as BodyComp[];
    },

    create: async (athleteId: number, payload: Partial<BodyComp>): Promise<BodyComp> => {
      portalActivity();
      if (!payload.measured_at) throw new Error('measured_at is required');
      const row = {
        athlete_id: athleteId,
        measured_at: payload.measured_at,
        weight: payload.weight ?? null,
        weight_unit: payload.weight_unit ?? 'kg',
        body_fat_pct: payload.body_fat_pct ?? null,
        lean_mass: payload.lean_mass ?? null,
        measurements: payload.measurements ?? {},
        source: payload.source ?? ('manual' as const),
        notes: payload.notes ?? null,
        created_at: now(),
      };
      const id = await tx('bodycomp', 'readwrite', (t) => put(t, 'bodycomp', row));
      return { ...row, id: Number(id) } as BodyComp;
    },

    update: async (id: number, payload: Partial<BodyComp>): Promise<BodyComp> =>
      tx('bodycomp', 'readwrite', async (t) => {
        const cur = await get<BodyCompRow>(t, 'bodycomp', id);
        if (!cur) throw new Error('not found');
        const next = { ...cur, ...payload, id: cur.id, athlete_id: cur.athlete_id };
        await put(t, 'bodycomp', next);
        return next as unknown as BodyComp;
      }),

    remove: async (id: number): Promise<null> => {
      await tx('bodycomp', 'readwrite', (t) => del(t, 'bodycomp', id));
      return null;
    },
  },
};
