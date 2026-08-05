// Cloud-sync providers — ported from Tachyread (app/src/features/sync/syncProviders.js) so both apps
// behave identically: same provider interface, same OAuth client, same private appDataFolder, same
// in-memory-only token, same cheap stat() change probe.
//
// A provider is a tiny async interface the sync manager drives:
//   supported()        -> can this browser use it at all?
//   available(cfg)     -> true | { ok:false, reason }   (config gate, e.g. a missing client ID)
//   connect(cfg,opts)  -> an opaque connection (dir handle, access token, …) or throws
//   isConnected() / disconnect()
//   upload(conn,name,blob) / download(conn,name) -> Blob | null
//   stat(conn,name)    -> mtime ms | null (no file yet) — used to skip no-op syncs
//
// Two ship, exactly as in Tachyread:
//   • LOCAL FOLDER — a File System Access directory handle. Point it at a Drive/Dropbox/OneDrive
//     *desktop sync folder* and you get cloud sync for free, no accounts or API keys.
//   • GOOGLE DRIVE — direct upload into a private app-data folder via Google Identity Services +
//     the Drive REST API. Your browser talks to your Drive; nothing transits a server of ours.

export interface SyncConfig {
  provider: string;
  driveClientId?: string;
  auto?: boolean;
  media?: boolean;
  lastSync?: number;
}

export interface SyncProvider {
  id: string;
  label: string;
  supported(): boolean;
  available(cfg?: SyncConfig): true | { ok: false; reason: string };
  connect(cfg?: SyncConfig, opts?: { silent?: boolean }): Promise<unknown>;
  isConnected(): Promise<boolean>;
  disconnect(): Promise<void>;
  upload(conn: never, name: string, blob: Blob): Promise<void>;
  download(conn: never, name: string): Promise<Blob | null>;
  stat?(conn: never, name: string): Promise<number | null>;
  /** Every file name in the sync location — lets media sync diff in one call instead of N probes. */
  list(conn: never): Promise<string[]>;
  folderName?(): Promise<string | null>;
}

/** The data bundle: every athlete, analysis and measurement. Media bytes ride as separate files. */
export const DATA_FILE_NAME = 'living-sculpture-data.json';

// ---- Local folder (File System Access) ----------------------------------------------------------
// ponytail: the handle lives in one IndexedDB key rather than a storage layer — this is the only
// non-serializable thing the app persists.
const IDB_NAME = 'ls-sync';
function idb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore('handles');
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
async function getHandle(key: string): Promise<FileSystemDirectoryHandle | null> {
  const db = await idb();
  return new Promise((resolve) => {
    const r = db.transaction('handles').objectStore('handles').get(key);
    r.onsuccess = () => resolve(r.result ?? null);
    r.onerror = () => resolve(null);
  });
}
async function setHandle(key: string, value: FileSystemDirectoryHandle | null): Promise<void> {
  const db = await idb();
  await new Promise((resolve) => {
    const tx = db.transaction('handles', 'readwrite');
    tx.objectStore('handles').put(value, key);
    tx.oncomplete = resolve;
    tx.onerror = resolve;
  });
}

type PermHandle = FileSystemDirectoryHandle & {
  queryPermission(o: { mode: string }): Promise<string>;
  requestPermission(o: { mode: string }): Promise<string>;
};
async function ensureDirPermission(handle: FileSystemDirectoryHandle | null, mode = 'readwrite'): Promise<boolean> {
  if (!handle) return false;
  const h = handle as PermHandle;
  if ((await h.queryPermission({ mode })) === 'granted') return true;
  return (await h.requestPermission({ mode })) === 'granted';
}

export const localFolderProvider: SyncProvider = {
  id: 'localFolder',
  label: 'Local folder (or a Drive / Dropbox sync folder)',
  supported: () => typeof window !== 'undefined' && typeof (window as { showDirectoryPicker?: unknown }).showDirectoryPicker === 'function',
  available: () => true,
  async connect() {
    let handle = await getHandle('syncDir');
    if (handle && (await ensureDirPermission(handle))) return handle;
    handle = await (window as unknown as { showDirectoryPicker(o: object): Promise<FileSystemDirectoryHandle> })
      .showDirectoryPicker({ id: 'living-sculpture-sync', mode: 'readwrite' });
    if (!(await ensureDirPermission(handle))) throw new Error('Folder permission was denied.');
    await setHandle('syncDir', handle);
    return handle;
  },
  async isConnected() {
    const h = await getHandle('syncDir');
    return !!h && (await (h as PermHandle).queryPermission({ mode: 'readwrite' })) === 'granted';
  },
  async folderName() {
    return (await getHandle('syncDir'))?.name ?? null;
  },
  async disconnect() {
    await setHandle('syncDir', null);
  },
  async upload(dir: never, name: string, blob: Blob) {
    const fh = await (dir as FileSystemDirectoryHandle).getFileHandle(name, { create: true });
    const w = await (fh as FileSystemFileHandle & { createWritable(): Promise<FileSystemWritableFileStream> }).createWritable();
    await w.write(blob);
    await w.close();
  },
  async download(dir: never, name: string) {
    try {
      const fh = await (dir as FileSystemDirectoryHandle).getFileHandle(name);
      return await fh.getFile();
    } catch {
      return null;
    }
  },
  async stat(dir: never, name: string) {
    try {
      const fh = await (dir as FileSystemDirectoryHandle).getFileHandle(name);
      return (await fh.getFile()).lastModified || null;
    } catch {
      return null;
    }
  },
  async list(dir: never) {
    const names: string[] = [];
    for await (const key of (dir as unknown as { keys(): AsyncIterable<string> }).keys()) names.push(key);
    return names;
  },
};

// ---- Google Drive (private appDataFolder) -------------------------------------------------------
// Public OAuth client id, shared with Tachyread and GymTracker — an identifier, not a secret (it
// ships in their JS too). It only works from the JavaScript origins registered with Google; the
// origin gate below ALSO refuses it app-side anywhere else, so a fork deployed elsewhere must supply
// its own id in Settings.
export const BUILTIN_DRIVE_CLIENT_ID = '547617739897-br6dj2facmsc34qnkjb5u4dbfhju39pu.apps.googleusercontent.com';
const OAUTH_ORIGINS = ['https://adervec.github.io'];
export function driveOriginAllowed(): boolean {
  try {
    const h = location.hostname;
    if (h === 'localhost' || h === '127.0.0.1' || h === '[::1]') return true; // self-hosted, any port
    return OAUTH_ORIGINS.indexOf(location.origin) !== -1;
  } catch {
    return false;
  }
}
/** A user-supplied id (fork / self-host) wins; otherwise the built-in id on an authorized origin. */
export function driveClientId(cfg?: SyncConfig): string {
  return (cfg?.driveClientId || '').trim() || (driveOriginAllowed() ? BUILTIN_DRIVE_CLIENT_ID : '');
}

interface GoogleOAuth {
  accounts: {
    oauth2: {
      initTokenClient(o: {
        client_id: string;
        scope: string;
        callback: (r: { access_token?: string; expires_in?: number; error?: string }) => void;
        error_callback: (e: { message?: string; type?: string }) => void;
      }): { requestAccessToken(o: { prompt: string }): void };
    };
  };
}
declare global {
  interface Window { google?: GoogleOAuth }
}

let gisLoaded: Promise<void> | null = null;
function loadGis(): Promise<void> {
  if (gisLoaded) return gisLoaded;
  gisLoaded = new Promise((resolve, reject) => {
    if (window.google?.accounts?.oauth2) return resolve();
    const s = document.createElement('script');
    s.src = 'https://accounts.google.com/gsi/client';
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('Could not load Google sign-in.'));
    document.head.appendChild(s);
  });
  return gisLoaded;
}

// The private app-data folder for sync, plus identity scopes so we can show which account is signed
// in. `drive.appdata` can only ever see this app's own folder — never the rest of your Drive.
const DRIVE_SCOPE = 'openid email profile https://www.googleapis.com/auth/drive.appdata';

// Access token cached in memory only (never persisted), exactly as in Tachyread.
let _driveToken: { value: string; exp: number } | null = null;
let _driveProfile: { name: string; picture: string; email: string } | null = null;
function driveTokenValid(): boolean {
  return !!_driveToken && _driveToken.exp > Date.now() + 60000;
}
export function getDriveProfile() {
  return _driveProfile;
}

async function fetchDriveProfile(token: string) {
  try {
    const r = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', { headers: { Authorization: `Bearer ${token}` } });
    if (r.ok) {
      const j = (await r.json()) as { name?: string; picture?: string; email?: string };
      _driveProfile = { name: j.name || j.email || 'Google account', picture: j.picture || '', email: j.email || '' };
    }
  } catch {
    /* cosmetic only */
  }
  return _driveProfile;
}

function requestToken(clientId: string, prompt = ''): Promise<string> {
  return new Promise((resolve, reject) => {
    const client = window.google!.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: DRIVE_SCOPE,
      callback: (resp) => {
        if (resp?.access_token) {
          _driveToken = { value: resp.access_token, exp: Date.now() + (resp.expires_in || 3600) * 1000 };
          resolve(resp.access_token);
        } else reject(new Error(resp?.error || 'Sign-in failed.'));
      },
      // Without this the promise hangs when the popup is dismissed or blocked.
      error_callback: (err) => reject(new Error(err?.message || err?.type || 'Sign-in was dismissed.')),
    });
    // prompt:'' → silent when a prior grant + active Google session exist; 'consent' forces the chooser.
    client.requestAccessToken({ prompt });
  });
}

interface DriveConn { token: string }
interface DriveFile { id: string; name: string; modifiedTime?: string }

async function driveFind(token: string, name: string): Promise<DriveFile | null> {
  const q = encodeURIComponent(`name='${name}' and trashed=false`);
  const r = await fetch(`https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&q=${q}&fields=files(id,name,modifiedTime)`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!r.ok) throw new Error(`Drive list failed (${r.status}).`);
  return ((await r.json()) as { files?: DriveFile[] }).files?.[0] || null;
}

/** Paged listing of the whole app folder — lets media sync diff without one probe per file. */
async function driveListAll(token: string): Promise<DriveFile[]> {
  const out: DriveFile[] = [];
  let pageToken = '';
  do {
    const url = `https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&pageSize=1000&fields=nextPageToken,files(id,name)${pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : ''}`;
    const r = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!r.ok) throw new Error(`Drive list failed (${r.status}).`);
    const j = (await r.json()) as { files?: DriveFile[]; nextPageToken?: string };
    out.push(...(j.files || []));
    pageToken = j.nextPageToken || '';
  } while (pageToken);
  return out;
}

export const googleDriveProvider: SyncProvider = {
  id: 'googleDrive',
  label: 'Google Drive (private app folder)',
  supported: () => true,
  available: (cfg) =>
    driveClientId(cfg)
      ? true
      : { ok: false, reason: 'Google Drive sync isn’t enabled on this deployment — add your own OAuth client ID below.' },
  // `silent` (auto-sync / boot) only reuses an existing grant — it never opens a popup.
  async connect(cfg, { silent = false } = {}) {
    const clientId = driveClientId(cfg);
    if (!clientId) throw new Error('Google Drive sync isn’t available here.');
    if (driveTokenValid()) {
      if (!_driveProfile) await fetchDriveProfile(_driveToken!.value);
      return { token: _driveToken!.value } satisfies DriveConn;
    }
    await loadGis();
    let token: string;
    try {
      token = await requestToken(clientId, ''); // silent (existing grant) first
    } catch (e) {
      if (silent) throw e; // auto/boot: never pop a sign-in
      token = await requestToken(clientId, 'consent'); // user-initiated: ask once
    }
    await fetchDriveProfile(token);
    return { token } satisfies DriveConn;
  },
  async isConnected() {
    return driveTokenValid();
  },
  async disconnect() {
    _driveToken = null;
    _driveProfile = null;
  },
  async upload(conn: never, name: string, blob: Blob) {
    const c = conn as unknown as DriveConn;
    const existing = (await driveFind(c.token, name))?.id || null;
    const meta = existing ? {} : { name, parents: ['appDataFolder'] };
    // Drive's multipart upload is capped at 5 MB and photos/videos blow straight past it, so
    // anything sizeable goes through the RESUMABLE protocol (init → one PUT of the bytes).
    if (blob.size > 4 * 1024 * 1024) {
      const initUrl = existing
        ? `https://www.googleapis.com/upload/drive/v3/files/${existing}?uploadType=resumable`
        : 'https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable';
      const init = await fetch(initUrl, {
        method: existing ? 'PATCH' : 'POST',
        headers: {
          Authorization: `Bearer ${c.token}`,
          'Content-Type': 'application/json; charset=UTF-8',
          'X-Upload-Content-Type': blob.type || 'application/octet-stream',
        },
        body: JSON.stringify(meta),
      });
      if (!init.ok) throw new Error(`Drive upload init failed (${init.status}).`);
      const session = init.headers.get('Location');
      if (!session) throw new Error('Drive upload init returned no session URL.');
      const put = await fetch(session, { method: 'PUT', body: blob });
      if (!put.ok) throw new Error(`Drive upload failed (${put.status}).`);
      return;
    }
    const form = new FormData();
    form.append('metadata', new Blob([JSON.stringify(meta)], { type: 'application/json' }));
    form.append('file', blob);
    const url = existing
      ? `https://www.googleapis.com/upload/drive/v3/files/${existing}?uploadType=multipart`
      : 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart';
    const r = await fetch(url, { method: existing ? 'PATCH' : 'POST', headers: { Authorization: `Bearer ${c.token}` }, body: form });
    if (!r.ok) throw new Error(`Drive upload failed (${r.status}).`);
  },
  async download(conn: never, name: string) {
    const c = conn as unknown as DriveConn;
    const id = (await driveFind(c.token, name))?.id || null;
    if (!id) return null;
    const r = await fetch(`https://www.googleapis.com/drive/v3/files/${id}?alt=media`, { headers: { Authorization: `Bearer ${c.token}` } });
    return r.ok ? await r.blob() : null;
  },
  async stat(conn: never, name: string) {
    const f = await driveFind((conn as unknown as DriveConn).token, name);
    return f?.modifiedTime ? Date.parse(f.modifiedTime) : null;
  },
  async list(conn: never) {
    return (await driveListAll((conn as unknown as DriveConn).token)).map((f) => f.name);
  },
};

export const SYNC_PROVIDERS = [localFolderProvider, googleDriveProvider];
export function getSyncProvider(id: string): SyncProvider | null {
  return SYNC_PROVIDERS.find((p) => p.id === id) || null;
}
