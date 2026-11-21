import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../state/store';
import { api } from '../api';
import type { MediaAsset } from '../lib/types';
import { posesForCategory, poseLabel } from '../lib/poses';
import { PageHead, EmptyState } from '../components/Layout';
import { Icon } from '../components/Icon';
import { shortDate, todayISO } from '../lib/format';
import { DropZone } from '../components/DropZone';
import { captureDate } from '../lib/exif';
import { t } from '../lib/i18n';
import { requestCowork } from '../lib/coworkQueue';

interface QueueItem {
  name: string;
  state: 'waiting' | 'uploading' | 'done' | 'failed';
  detail?: string;
}

export function Capture() {
  const { current, toast, refreshAthletes } = useApp();
  const poses = current ? posesForCategory(current.category) : [];
  const [files, setFiles] = useState<File[]>([]);
  const [pose, setPose] = useState('');
  const [date, setDate] = useState(todayISO());
  const [dateSrc, setDateSrc] = useState<'exif' | 'file' | 'manual'>('manual');
  const [notes, setNotes] = useState('');
  const [progress, setProgress] = useState<number | null>(null);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [media, setMedia] = useState<MediaAsset[]>([]);
  const [grab, setGrab] = useState<MediaAsset | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const reload = () => current && api.media.list(current.id).then(setMedia);
  useEffect(() => {
    reload();
  }, [current]);

  /** Adopt the first file's capture date so the form shows what will actually be saved. */
  async function pickFiles(picked: File[]) {
    setFiles(picked);
    if (!picked.length) return;
    const cd = await captureDate(picked[0]);
    setDate(cd.date);
    setDateSrc(cd.src);
  }

  /**
   * Uploads sequentially so the server isn't hit with N concurrent thumbnails.
   * Each file keeps its own EXIF date; only files without one inherit the form's.
   */
  async function uploadMany(list: File[], useFormDate = false) {
    if (!current || !list.length) return;
    setQueue(list.map((f) => ({ name: f.name, state: 'waiting' })));
    const mark = (i: number, patch: Partial<QueueItem>) =>
      setQueue((q) => q.map((row, n) => (n === i ? { ...row, ...patch } : row)));
    let fromExif = 0;
    let failed = 0;
    setProgress(0);
    for (const [i, f] of list.entries()) {
      mark(i, { state: 'uploading' });
      try {
        const cd = await captureDate(f);
        const shotOn = !useFormDate && cd.src === 'exif' ? cd.date : date;
        if (cd.src === 'exif') fromExif++;
        await api.media.upload(
          current.id,
          f,
          { captured_at: shotOn, pose_type: pose || undefined, division: current.category, notes: notes || undefined },
          setProgress
        );
        mark(i, { state: 'done', detail: cd.src === 'exif' ? t('{date} · EXIF', { date: shortDate(shotOn) }) : shortDate(shotOn) });
      } catch (err) {
        failed++;
        mark(i, { state: 'failed', detail: (err as Error).message });
      }
    }
    setProgress(null);
    setFiles([]);
    setNotes('');
    if (fileRef.current) fileRef.current.value = '';
    toast(
      failed
        ? t('{ok} uploaded, {failed} failed', { ok: list.length - failed, failed })
        : fromExif
          ? t('Uploaded {n} · {exif} dated from EXIF', { n: list.length, exif: fromExif })
          : t('Uploaded {n}', { n: list.length })
    );
    await reload();
    await refreshAthletes();
    if (failed < list.length) requestCowork('pose-review', 'checkin-review'); // a check-in ended: ask the AI judge
  }

  async function doUpload(e: React.FormEvent) {
    e.preventDefault();
    await uploadMany(files, files.length === 1);
  }

  async function del(m: MediaAsset) {
    if (!confirm(t('Delete this item and its analyses?'))) return;
    await api.media.remove(m.id);
    await reload();
    await refreshAthletes();
    toast(t('Deleted'));
  }

  if (!current) return <NeedAthlete />;

  return (
    <div>
      <PageHead
        kicker={t('Capture')}
        title={t('Photos & video')}
        lede={t('Add current and historical shots. Tag each with the pose and the date it was actually taken so progress lines up honestly over time.')}
      />

      <DropZone
        onFiles={(dropped) => uploadMany(dropped)}
        label={pose ? t('Drop to add as {pose}', { pose: poseLabel(pose) }) : t('Drop photos or video to upload')}
      >
      <div className="grid" style={{ gridTemplateColumns: '380px 1fr', gap: 24, alignItems: 'start' }}>
        <form className="card" onSubmit={doUpload}>
          <p className="kicker" style={{ marginBottom: 16 }}>{t('Upload')}</p>
          <p className="drop-hint">
            {t('Drag photos or video anywhere on this page — or')}
            <button type="button" className="btn sm" style={{ margin: 0, marginInlineStart: 8 }} onClick={() => fileRef.current?.click()}>
              {t('browse…')}
            </button>
          </p>
          <label className="field">
            <span className="lab">{t('File (photo or video)')}</span>
            <input
              ref={fileRef}
              type="file"
              multiple
              accept="image/*,video/*"
              onChange={(e) => pickFiles(Array.from(e.target.files ?? []))}
            />
          </label>
          <label className="field">
            <span className="lab">{t('Pose')}</span>
            <select value={pose} onChange={(e) => setPose(e.target.value)}>
              <option value="">{t('— untagged —')}</option>
              {poses.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span className="lab">{t('Date taken')}</span>
            <input
              type="date"
              value={date}
              onChange={(e) => {
                setDate(e.target.value);
                setDateSrc('manual');
              }}
            />
            {dateSrc !== 'manual' && (
              <span className="tiny muted">
                {dateSrc === 'exif'
                  ? t('Read from the photo’s EXIF — the day it was actually shot.')
                  : t('No EXIF in this file; using its last-modified date. Correct it if you know better.')}
              </span>
            )}
          </label>
          <label className="field">
            <span className="lab">{t('Notes (optional)')}</span>
            <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={t('e.g. 6 weeks out, morning, pumped')} />
          </label>
          {progress != null && (
            <div className="meter" style={{ margin: '4px 0 14px' }}>
              <span style={{ width: `${progress}%` }} />
            </div>
          )}
          {queue.length > 0 && (
            <div style={{ margin: '4px 0 14px' }}>
              {/* i18n-keys: waiting | uploading | done | failed */}
              {queue.map((q, i) => (
                <div className="queue-row" key={`${q.name}-${i}`}>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{q.name}</span>
                  <span style={{ color: q.state === 'failed' ? 'var(--bad)' : q.state === 'done' ? 'var(--good)' : 'inherit' }}>
                    {q.detail ?? t(q.state)}
                  </span>
                </div>
              ))}
            </div>
          )}
          <button className="btn primary" disabled={!files.length || progress != null}>
            <Icon name="upload" size={14} />{' '}
            {progress != null ? t('Uploading {p}%', { p: progress }) : files.length > 1 ? t('Upload {n} files', { n: files.length }) : t('Upload')}
          </button>
          <p className="tiny muted" style={{ marginTop: 12 }}>
            {t('Photos stay on your machine. If you have connected a cowork folder (Dashboard), posing photos also go into that folder for your AI judge, downsized and with location data removed; you can switch that off there.')}
          </p>
        </form>

        <div>
          {poses.map((p) => {
            const items = media.filter((m) => m.pose_type === p.id);
            if (!items.length) return null;
            return (
              <section key={p.id} style={{ marginBottom: 22 }}>
                <p className="kicker" style={{ marginBottom: 10 }}>{p.label} · {items.length}</p>
                <div className="media-grid">
                  {items.map((m) => (
                    <MediaTile key={m.id} m={m} onDelete={() => del(m)} onGrab={() => setGrab(m)} />
                  ))}
                </div>
              </section>
            );
          })}
          {(() => {
            const untagged = media.filter((m) => !m.pose_type);
            if (!untagged.length) return null;
            return (
              <section style={{ marginBottom: 22 }}>
                <p className="kicker" style={{ marginBottom: 10 }}>{t('Untagged · {n}', { n: untagged.length })}</p>
                <div className="media-grid">
                  {untagged.map((m) => (
                    <MediaTile key={m.id} m={m} poses={poses} onDelete={() => del(m)} onGrab={() => setGrab(m)} onRetag={reload} />
                  ))}
                </div>
              </section>
            );
          })()}
          {media.length === 0 && (
            <EmptyState title={t('Nothing captured yet')}>
              {t('Drag a photo or video onto this page — or use the form. Photos keep the date they were shot, read from their own EXIF.')}
            </EmptyState>
          )}
        </div>
      </div>
      </DropZone>

      {grab && current && (
        <FrameGrabber
          media={grab}
          onClose={() => setGrab(null)}
          onCaptured={async (blob) => {
            const f = new File([blob], `frame-${Date.now()}.jpg`, { type: 'image/jpeg' });
            await api.media.upload(current.id, f, { captured_at: grab.captured_at, pose_type: grab.pose_type ?? undefined, division: current.category, notes: 'Frame captured from video' });
            toast(t('Frame saved as photo'));
            setGrab(null);
            await reload();
          }}
        />
      )}
    </div>
  );
}

function MediaTile({
  m,
  poses,
  onDelete,
  onGrab,
  onRetag,
}: {
  m: MediaAsset;
  poses?: { id: string; label: string }[];
  onDelete: () => void;
  onGrab: () => void;
  onRetag?: () => void;
}) {
  return (
    <div className="thumb" style={{ cursor: 'default' }}>
      {m.thumb_url ? (
        <img src={m.thumb_url} alt="" />
      ) : (
        <div style={{ display: 'grid', placeItems: 'center', height: '100%', color: 'var(--accent)' }}>
          <Icon name="timelapse" size={30} />
        </div>
      )}
      {m.kind === 'video' && <span className="badge">{t('video')}</span>}
      <span className="meta">{shortDate(m.captured_at)}</span>
      <div style={{ position: 'absolute', top: 6, insetInlineEnd: 6, display: 'flex', gap: 4 }}>
        {m.kind === 'video' && (
          <button className="btn sm" style={{ padding: 4 }} title={t('Capture frame')} onClick={onGrab}>
            <Icon name="camera" size={13} />
          </button>
        )}
        <button className="btn sm danger" style={{ padding: 4 }} title={t('Delete')} onClick={onDelete}>
          <Icon name="trash" size={13} />
        </button>
      </div>
      {poses && onRetag && (
        <select
          style={{ position: 'absolute', bottom: 28, insetInlineStart: 6, insetInlineEnd: 6, width: 'auto', fontSize: 11, padding: '3px 6px' }}
          defaultValue=""
          onChange={async (e) => {
            await api.media.update(m.id, { pose_type: e.target.value });
            onRetag();
          }}
        >
          <option value="" disabled>
            {t('tag pose…')}
          </option>
          {poses.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
        </select>
      )}
    </div>
  );
}

function FrameGrabber({ media, onClose, onCaptured }: { media: MediaAsset; onClose: () => void; onCaptured: (b: Blob) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  function capture() {
    const v = videoRef.current;
    if (!v) return;
    const canvas = document.createElement('canvas');
    canvas.width = v.videoWidth;
    canvas.height = v.videoHeight;
    canvas.getContext('2d')?.drawImage(v, 0, 0);
    canvas.toBlob((b) => b && onCaptured(b), 'image/jpeg', 0.92);
  }
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.7)', display: 'grid', placeItems: 'center', zIndex: 9000 }} onClick={onClose}>
      <div className="card solid" style={{ maxWidth: 720, width: '92%' }} onClick={(e) => e.stopPropagation()}>
        <div className="row spread" style={{ marginBottom: 12 }}>
          <p className="kicker">{t('Capture a frame — {pose}', { pose: poseLabel(media.pose_type) })}</p>
          <button className="btn sm" onClick={onClose}>{t('Close')}</button>
        </div>
        <video ref={videoRef} src={media.url} controls style={{ width: '100%', borderRadius: 4 }} />
        <p className="tiny muted" style={{ margin: '12px 0' }}>{t('Scrub to the moment you hit the pose, then capture it as an analyzable photo.')}</p>
        <button className="btn primary" onClick={capture}>
          <Icon name="camera" size={14} /> {t('Capture current frame')}
        </button>
      </div>
    </div>
  );
}

function NeedAthlete() {
  return (
    <div>
      <PageHead title={t('Capture')} lede={t('Select an athlete first.')} />
      <Link to="/athletes" className="btn primary">{t('Go to athletes')}</Link>
    </div>
  );
}
