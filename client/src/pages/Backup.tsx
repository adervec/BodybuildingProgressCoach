import { useCallback, useEffect, useRef, useState } from 'react';
import { useApp } from '../state/store';
import { PageHead } from '../components/Layout';
import { Icon } from '../components/Icon';
import {
  SYNC_PROVIDERS,
  getSyncProvider,
  getDriveProfile,
  driveOriginAllowed,
  BUILTIN_DRIVE_CLIENT_ID,
  type SyncConfig,
} from '../lib/sync/syncProviders';
import { backupToProvider, restoreFromProvider, syncWithProvider } from '../lib/sync/syncManager';
import { IS_STATIC } from '../api';
import { storageEstimate } from '../lib/local/store';

const CFG_KEY = 'ls.sync';

function loadCfg(): SyncConfig {
  try {
    const raw = JSON.parse(localStorage.getItem(CFG_KEY) || '{}') as Partial<SyncConfig>;
    return { provider: raw.provider || 'googleDrive', driveClientId: raw.driveClientId || '', auto: !!raw.auto, media: raw.media !== false, lastSync: raw.lastSync || 0 };
  } catch {
    return { provider: 'googleDrive', driveClientId: '', auto: false, media: true, lastSync: 0 };
  }
}

export function Backup() {
  const { toast, refreshAthletes } = useApp();
  const [cfg, setCfg] = useState<SyncConfig>(loadCfg);
  const [busy, setBusy] = useState<string | null>(null);
  const [progress, setProgress] = useState<string>('');
  const [profile, setProfile] = useState(getDriveProfile());
  const [storage, setStorage] = useState<{ usage: number; quota: number; persisted: boolean } | null>(null);
  const didBoot = useRef(false);

  useEffect(() => {
    if (IS_STATIC) storageEstimate().then(setStorage);
  }, []);

  const save = useCallback((next: SyncConfig) => {
    setCfg(next);
    localStorage.setItem(CFG_KEY, JSON.stringify(next));
  }, []);

  const provider = getSyncProvider(cfg.provider);
  const gate = provider?.available(cfg) ?? { ok: false as const, reason: 'Unknown target.' };

  const onProgress = (done: number, total: number) => setProgress(total ? `media ${done}/${total}` : '');

  const run = useCallback(
    async (label: string, fn: () => Promise<string>) => {
      setBusy(label);
      setProgress('');
      try {
        const msg = await fn();
        const next = { ...cfg, lastSync: Date.now() };
        save(next);
        setProfile(getDriveProfile());
        await refreshAthletes();
        toast(msg);
      } catch (err) {
        toast((err as Error).message);
      } finally {
        setBusy(null);
        setProgress('');
      }
    },
    [cfg, save, toast, refreshAthletes]
  );

  const doSync = () =>
    run('sync', async () => {
      const r = await syncWithProvider(cfg.provider, cfg, { onProgress });
      const a = r.added;
      const gained = a ? a.athletes + a.media + a.analyses + a.bodycomp : 0;
      const m = r.media ? ` · media ↑${r.media.uploaded} ↓${r.media.downloaded}` : '';
      return `Synced — ${gained ? `pulled ${gained} new record${gained === 1 ? '' : 's'}` : 'already up to date'}${m}`;
    });

  // Boot auto-sync: silent only — reuses an existing grant, never pops a sign-in on a timer.
  useEffect(() => {
    if (didBoot.current || !cfg.auto || !provider || gate !== true) return;
    didBoot.current = true;
    (async () => {
      try {
        await syncWithProvider(cfg.provider, cfg, { silent: true, onProgress });
        save({ ...cfg, lastSync: Date.now() });
        await refreshAthletes();
      } catch {
        /* offline or no prior grant — press “Sync now” once to grant */
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div>
      <PageHead
        kicker="Backup"
        title="Sync & backup"
        lede={
          IS_STATIC
            ? 'This version keeps everything inside this browser, so backing up isn’t optional housekeeping — it’s how your work survives a cleared cache or a new device.'
            : 'Your photos, analyses and measurements live in one folder on this machine. Copy them somewhere safe — and keep two devices in step — without any of it passing through a server of ours.'
        }
      />

      {IS_STATIC && (
        <p className="banner" style={{ marginBottom: 18 }}>
          <b>Browser-only build.</b> Your data lives in this browser’s storage on this device — clearing site data erases
          it. Back up here, and use the same backup to move between devices.
          {storage && storage.quota > 0 && (
            <>
              {' '}
              Using {(storage.usage / 1e6).toFixed(0)} MB of roughly {(storage.quota / 1e9).toFixed(1)} GB available
              {storage.persisted ? ' (storage marked persistent).' : '.'}
            </>
          )}
        </p>
      )}

      <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', gap: 22, alignItems: 'start' }}>
        <div className="card">
          <p className="kicker" style={{ marginBottom: 14 }}>Target</p>

          <label className="field">
            <span className="lab">Sync to</span>
            <select value={cfg.provider} onChange={(e) => save({ ...cfg, provider: e.target.value })}>
              {SYNC_PROVIDERS.map((p) => (
                <option key={p.id} value={p.id} disabled={!p.supported()}>
                  {p.label}
                  {p.supported() ? '' : ' — not supported in this browser'}
                </option>
              ))}
            </select>
          </label>

          {cfg.provider === 'googleDrive' && (
            <>
              {!driveOriginAllowed() && (
                <label className="field">
                  <span className="lab">Google OAuth client ID</span>
                  <input
                    value={cfg.driveClientId || ''}
                    placeholder="…apps.googleusercontent.com"
                    onChange={(e) => save({ ...cfg, driveClientId: e.target.value })}
                  />
                  <span className="tiny muted">
                    This deployment isn’t on an authorized origin, so it needs its own client ID (Google Cloud →
                    Credentials → OAuth client → Web application).
                  </span>
                </label>
              )}
              {profile && (
                <div className="row" style={{ gap: 10, marginBottom: 12 }}>
                  {profile.picture && <img src={profile.picture} alt="" className="avatar" style={{ width: 28, height: 28 }} />}
                  <span className="tiny muted">Signed in as {profile.email || profile.name}</span>
                </div>
              )}
            </>
          )}

          <label className="row" style={{ gap: 8, marginBottom: 10, cursor: 'pointer' }}>
            <input type="checkbox" checked={!!cfg.media} style={{ width: 'auto' }} onChange={(e) => save({ ...cfg, media: e.target.checked })} />
            <span className="tiny">Include photos &amp; video (large — without this only your data syncs)</span>
          </label>
          <label className="row" style={{ gap: 8, marginBottom: 16, cursor: 'pointer' }}>
            <input type="checkbox" checked={!!cfg.auto} style={{ width: 'auto' }} onChange={(e) => save({ ...cfg, auto: e.target.checked })} />
            <span className="tiny">Sync automatically when the app starts</span>
          </label>

          {gate !== true && <p className="banner" style={{ marginBottom: 14 }}>{gate.reason}</p>}

          <button className="btn primary" style={{ width: '100%', marginBottom: 8 }} onClick={doSync} disabled={!!busy || gate !== true}>
            <Icon name="timelapse" size={14} /> {busy === 'sync' ? progress || 'Syncing…' : 'Sync now'}
          </button>
          <div className="row" style={{ gap: 8 }}>
            <button
              className="btn"
              style={{ flex: 1 }}
              disabled={!!busy || gate !== true}
              onClick={() => run('backup', async () => `Backed up (${Math.ceil((await backupToProvider(cfg.provider, cfg)).bytes / 1024)} KB)`)}
            >
              Back up only
            </button>
            <button
              className="btn"
              style={{ flex: 1 }}
              disabled={!!busy || gate !== true}
              onClick={() =>
                run('restore', async () => {
                  const a = (await restoreFromProvider(cfg.provider, cfg)).added;
                  const n = a ? a.athletes + a.media + a.analyses + a.bodycomp : 0;
                  return n ? `Restored ${n} record${n === 1 ? '' : 's'}` : 'Nothing new to restore';
                })
              }
            >
              Restore only
            </button>
          </div>
          {cfg.lastSync ? (
            <p className="tiny muted mono" style={{ marginTop: 12 }}>Last sync: {new Date(cfg.lastSync).toLocaleString()}</p>
          ) : null}
        </div>

        <div className="card">
          <p className="kicker" style={{ marginBottom: 14 }}>What travels</p>
          <p style={{ fontSize: 14, color: 'var(--text-dim)', marginBottom: 12 }}>
            Google Drive sync writes to a <b>private app folder</b> — a hidden area of your Drive that only this app can
            read. It can’t see the rest of your Drive, and your photos never touch a server of ours: your browser talks
            to Google directly.
          </p>
          <table className="data">
            <tbody>
              <tr><td>Athletes, analyses, measurements</td><td className="mono tiny">always</td></tr>
              <tr><td>Photos &amp; video</td><td className="mono tiny">{cfg.media ? 'included' : 'excluded'}</td></tr>
              <tr><td>Your Anthropic API key</td><td className="mono tiny">never</td></tr>
            </tbody>
          </table>
          <p className="tiny muted" style={{ marginTop: 14 }}>
            Merging is by natural key — the same backup applied twice changes nothing, and two devices converge rather
            than overwrite each other. Media files are immutable, so they’re only ever copied to the side that’s
            missing them.
          </p>
          {cfg.provider === 'googleDrive' && driveOriginAllowed() && (
            <p className="tiny muted mono" style={{ marginTop: 12, wordBreak: 'break-all' }}>
              client: {(cfg.driveClientId || BUILTIN_DRIVE_CLIENT_ID).slice(0, 28)}…
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
