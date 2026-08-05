import type { Athlete, BodyComp, Category, MediaAsset, PoseAnalysis, AiCoaching } from './lib/types';
import { localApi } from './localApi';

/**
 * The static (GitHub Pages) build has no server, so it runs on IndexedDB via `localApi`, which
 * implements this exact surface. Everything else in the app talks to `api` and never knows which.
 */
export const IS_STATIC = import.meta.env.VITE_STATIC === '1';

async function j<T>(r: Response): Promise<T> {
  if (!r.ok) {
    const body = (await r.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error || `${r.status} ${r.statusText}`);
  }
  if (r.status === 204) return null as T;
  return (await r.json()) as T;
}

export interface AiStatus {
  enabled: boolean;
  model: string;
}

const serverApi = {
  status: () => fetch('/api/status').then(j<{ ok: boolean; ai: AiStatus }>),

  athletes: {
    list: () => fetch('/api/athletes').then(j<Athlete[]>),
    get: (id: number) => fetch(`/api/athletes/${id}`).then(j<Athlete>),
    create: (data: { name: string; category: Category; height_cm?: number | null; notes?: string | null }) =>
      fetch('/api/athletes', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(data) }).then(j<Athlete>),
    update: (id: number, data: Partial<Athlete>) =>
      fetch(`/api/athletes/${id}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify(data) }).then(j<Athlete>),
    remove: (id: number) => fetch(`/api/athletes/${id}`, { method: 'DELETE' }).then(j<null>),
  },

  media: {
    list: (athleteId: number, params?: { pose_type?: string; kind?: string }) => {
      const q = new URLSearchParams(params as Record<string, string>).toString();
      return fetch(`/api/athletes/${athleteId}/media${q ? `?${q}` : ''}`).then(j<MediaAsset[]>);
    },
    get: (id: number) => fetch(`/api/media/${id}`).then(j<MediaAsset>),
    update: (id: number, data: Partial<MediaAsset>) =>
      fetch(`/api/media/${id}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify(data) }).then(j<MediaAsset>),
    remove: (id: number) => fetch(`/api/media/${id}`, { method: 'DELETE' }).then(j<null>),
    upload: (
      athleteId: number,
      file: File,
      fields: { captured_at?: string; pose_type?: string; division?: string; notes?: string },
      onProgress?: (pct: number) => void
    ): Promise<MediaAsset> => {
      return new Promise((resolve, reject) => {
        const form = new FormData();
        form.append('file', file);
        Object.entries(fields).forEach(([k, v]) => v != null && form.append(k, String(v)));
        const xhr = new XMLHttpRequest();
        xhr.open('POST', `/api/athletes/${athleteId}/media`);
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable && onProgress) onProgress(Math.round((e.loaded / e.total) * 100));
        };
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) resolve(JSON.parse(xhr.responseText));
          else {
            try {
              reject(new Error(JSON.parse(xhr.responseText).error || `Upload failed (${xhr.status})`));
            } catch {
              reject(new Error(`Upload failed (${xhr.status})`));
            }
          }
        };
        xhr.onerror = () => reject(new Error('Network error during upload'));
        xhr.send(form);
      });
    },
  },

  analysis: {
    aiStatus: () => fetch('/api/ai/status').then(j<AiStatus>),
    saveGeometry: (mediaId: number, payload: Record<string, unknown>) =>
      fetch(`/api/media/${mediaId}/analysis/geometry`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      }).then(j<PoseAnalysis>),
    runAi: (mediaId: number, payload: Record<string, unknown>) =>
      fetch(`/api/media/${mediaId}/analysis/ai`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      }).then(j<{ id: number; ai_feedback: AiCoaching }>),
    series: (athleteId: number, poseType?: string) => {
      const q = poseType ? `?pose_type=${encodeURIComponent(poseType)}` : '';
      return fetch(`/api/athletes/${athleteId}/analyses${q}`).then(j<PoseAnalysis[]>);
    },
  },

  bodycomp: {
    list: (athleteId: number) => fetch(`/api/athletes/${athleteId}/bodycomp`).then(j<BodyComp[]>),
    create: (athleteId: number, payload: Partial<BodyComp>) =>
      fetch(`/api/athletes/${athleteId}/bodycomp`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) }).then(j<BodyComp>),
    update: (id: number, payload: Partial<BodyComp>) =>
      fetch(`/api/bodycomp/${id}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) }).then(j<BodyComp>),
    remove: (id: number) => fetch(`/api/bodycomp/${id}`, { method: 'DELETE' }).then(j<null>),
  },
};

export const api = (IS_STATIC ? (localApi as unknown as typeof serverApi) : serverApi);

/**
 * `latest_thumb` is a file name on the server and an object URL in the browser build — one helper so
 * avatar call sites don't branch on the backend.
 */
export function thumbSrc(nameOrUrl: string | null | undefined): string | undefined {
  if (!nameOrUrl) return undefined;
  return nameOrUrl.startsWith('blob:') ? nameOrUrl : `/thumbs/${nameOrUrl}`;
}
