import { useCallback, useEffect, useRef, useState } from 'react';
import { useApp } from '../state/store';
import { PageHead } from '../components/Layout';
import { Icon } from '../components/Icon';
import { cloud, syncOnce, store, loadSyncConfig, saveSyncConfig, type SyncConfig } from '../lib/sync/syncManager';
import { IS_STATIC } from '../api';
import { storageEstimate } from '../lib/local/store';
import { eraseEverything } from '../lib/local/erase';
import { t, fmt } from '../lib/i18n';
import { localDay } from '../../../server/src/lib/localDay';

async function confirmErase(toast: (m: string) => void) {
  const ok = window.confirm(
    t('Erase everything this app stores on this device — athletes, photos, video, analyses, measurements and settings?') +
      '\n\n' +
      t('Cloud sync is disconnected. Your cloud copy is NOT touched, so you can restore from it later.') +
      '\n\n' +
      t('This cannot be undone.')
  );
  if (!ok) return;
  try {
    await eraseEverything();
    location.reload();
  } catch (e) {
    toast((e as Error).message);
  }
}

/** Save the reader's own copy as a file (house standard 6). */
async function downloadBackup(): Promise<number> {
  const blob = new Blob([JSON.stringify(await store.exportBundle())], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `living-sculpture-backup-${localDay()}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  return blob.size;
}

export function Backup() {
  const { toast, refreshAthletes } = useApp();
  const [cfg, setCfg] = useState<SyncConfig>(loadSyncConfig);
  const [busy, setBusy] = useState<string | null>(null);
  const [progress, setProgress] = useState<string>('');
  const [storage, setStorage] = useState<{ usage: number; quota: number; persisted: boolean } | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const c = cloud();

  useEffect(() => {
    if (IS_STATIC) storageEstimate().then(setStorage);
  }, []);

  const save = useCallback((next: SyncConfig) => {
    setCfg(next);
    saveSyncConfig(next);
  }, []);

  const onProgress = (done: number, total: number) => setProgress(total ? t('media {done}/{total}', { done, total }) : '');

  const run = useCallback(
    async (label: string, fn: () => Promise<string>) => {
      setBusy(label);
      setProgress('');
      try {
        const msg = await fn();
        setCfg(loadSyncConfig());
        await refreshAthletes();
        toast(msg);
      } catch (err) {
        toast((err as Error).message);
      } finally {
        setBusy(null);
        setProgress('');
      }
    },
    [toast, refreshAthletes]
  );

  const doSync = () =>
    run('sync', async () => {
      const r = await syncOnce({ media: cfg.media, onProgress });
      const m = r.media ? ' · ' + t('media ↑{up} ↓{down}', { up: r.media.uploaded, down: r.media.downloaded }) : '';
      return (r.pulled ? t('Synced — brought in changes from your other devices') : t('Synced — already up to date')) + m;
    });

  const restoreFile = (f: File) =>
    run('restore', async () => {
      const { parseJSON } = (window as unknown as { appFont?: { parseJSON?: (s: string, max: number) => unknown } }).appFont ?? {};
      const text = await f.text();
      const bundle = parseJSON ? parseJSON(text, 512e6) : JSON.parse(text);
      if (!bundle) throw new Error(t('Not a Living Sculpture backup file.'));
      await store.importBundle(bundle);
      return t('Restored — anything already here was kept');
    });

  return (
    <div>
      <PageHead
        kicker={t('Backup')}
        title={t('Sync & backup')}
        lede={
          IS_STATIC
            ? t('This version keeps everything inside this browser, so backing up isn’t optional housekeeping — it’s how your work survives a cleared cache or a new device.')
            : t('Your photos, analyses and measurements live in one folder on this machine. Copy them somewhere safe — and keep two devices in step — without any of it passing through a server of ours.')
        }
      />

      {IS_STATIC && (
        <p className="banner" style={{ marginBottom: 18 }}>
          <b>{t('Browser-only build.')}</b>{' '}
          {t('Your data lives in this browser’s storage on this device — clearing site data erases it. Back up here, and use the same backup to move between devices.')}
          {storage && storage.quota > 0 && (
            <>
              {' '}
              {storage.persisted
                ? t('Using {used} of roughly {quota} available (storage marked persistent).', {
                    used: fmt.unit(storage.usage / 1e6, 'megabyte', 0),
                    quota: fmt.unit(storage.quota / 1e9, 'gigabyte', 1),
                  })
                : t('Using {used} of roughly {quota} available.', {
                    used: fmt.unit(storage.usage / 1e6, 'megabyte', 0),
                    quota: fmt.unit(storage.quota / 1e9, 'gigabyte', 1),
                  })}
            </>
          )}
        </p>
      )}

      <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', gap: 22, alignItems: 'start' }}>
        <div className="card">
          <p className="kicker" style={{ marginBottom: 14 }}>{t('Cloud')}</p>
          <p className="tiny muted" style={{ marginBottom: 12 }}>
            {c
              ? t('Syncs with {cloud}, the cloud you chose for all these apps on the hub.', { cloud: c.label() })
              : t('Cloud sync is not available (the shared house script did not load).')}
          </p>

          <label className="row" style={{ gap: 8, marginBottom: 10, cursor: 'pointer' }}>
            <input type="checkbox" checked={!!cfg.media} style={{ width: 'auto' }} onChange={(e) => save({ ...cfg, media: e.target.checked })} />
            <span className="tiny">{t('Include photos & video (large — without this only your data syncs)')}</span>
          </label>
          <label className="row" style={{ gap: 8, marginBottom: 16, cursor: 'pointer' }}>
            <input type="checkbox" checked={!!cfg.auto} style={{ width: 'auto' }} onChange={(e) => save({ ...cfg, auto: e.target.checked })} />
            <span className="tiny">{t('Sync automatically when the app starts')}</span>
          </label>

          <button className="btn primary" style={{ width: '100%', marginBottom: 8 }} onClick={doSync} disabled={!!busy || !c}>
            <Icon name="timelapse" size={14} /> {busy === 'sync' ? progress || t('Syncing…') : t('Sync now')}
          </button>
          <div className="row" style={{ gap: 8 }}>
            <button
              className="btn"
              style={{ flex: 1 }}
              disabled={!!busy}
              onClick={() => run('backup', async () => t('Backed up ({size})', { size: fmt.unit(Math.ceil((await downloadBackup()) / 1024), 'kilobyte', 0) }))}
            >
              {t('Download a backup file')}
            </button>
            <button className="btn" style={{ flex: 1 }} disabled={!!busy} onClick={() => fileInput.current?.click()}>
              {t('Restore from a file')}
            </button>
            <input
              ref={fileInput}
              type="file"
              accept="application/json,.json"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = '';
                if (f) restoreFile(f);
              }}
            />
          </div>
          {cfg.lastSync ? (
            <p className="tiny muted mono" style={{ marginTop: 12 }}>{t('Last sync: {when}', { when: fmt.dateTime(new Date(cfg.lastSync)) })}</p>
          ) : null}
        </div>

        <div className="card">
          <p className="kicker" style={{ marginBottom: 14 }}>{t('What travels')}</p>
          <p style={{ fontSize: 14, color: 'var(--text-dim)', marginBottom: 12 }}>
            {t('Sync writes to a')} <b>{t('private app folder')}</b>{' '}
            {t('— a hidden area of your cloud that only these apps can read. It can’t see the rest of your files, and your photos never touch a server of ours: your browser talks to your cloud directly.')}
          </p>
          <table className="data">
            <tbody>
              <tr><td>{t('Athletes, analyses, measurements')}</td><td className="mono tiny">{t('always')}</td></tr>
              <tr><td>{t('Photos & video')}</td><td className="mono tiny">{cfg.media ? t('included') : t('excluded')}</td></tr>
              <tr><td>{t('Your Anthropic API key')}</td><td className="mono tiny">{t('never')}</td></tr>
            </tbody>
          </table>
          <p className="tiny muted" style={{ marginTop: 14 }}>
            {t('Sync merges record by record: the newest change to each athlete, photo, analysis or measurement wins, and a deletion on one device stays deleted on the others. No device ever overwrites newer data with an older copy. Media files are immutable, so they’re only ever copied to the side that’s missing them.')}
          </p>
        </div>
      </div>

      {IS_STATIC && (
        <div className="card" style={{ marginTop: 22 }}>
          <p className="kicker" style={{ marginBottom: 10 }}>{t('Erase this device')}</p>
          <p className="tiny muted" style={{ marginBottom: 12 }}>
            {t('Removes everything this app keeps in this browser and disconnects sync. Your cloud copy is not touched. Other apps on this site keep their data.')}
          </p>
          <button className="btn" disabled={!!busy} onClick={() => confirmErase(toast)}>{t('Erase everything…')}</button>
        </div>
      )}
    </div>
  );
}
