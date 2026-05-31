import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../state/store';
import { api } from '../api';
import type { MediaAsset } from '../lib/types';
import { posesForCategory, poseLabel } from '../lib/poses';
import { PageHead, EmptyState } from '../components/Layout';
import { Icon } from '../components/Icon';
import { shortDate, todayISO } from '../lib/format';

export function Capture() {
  const { current, toast, refreshAthletes } = useApp();
  const poses = current ? posesForCategory(current.category) : [];
  const [file, setFile] = useState<File | null>(null);
  const [pose, setPose] = useState('');
  const [date, setDate] = useState(todayISO());
  const [notes, setNotes] = useState('');
  const [progress, setProgress] = useState<number | null>(null);
  const [media, setMedia] = useState<MediaAsset[]>([]);
  const [grab, setGrab] = useState<MediaAsset | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const reload = () => current && api.media.list(current.id).then(setMedia);
  useEffect(() => {
    reload();
  }, [current]);

  async function doUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!current || !file) return;
    setProgress(0);
    try {
      await api.media.upload(current.id, file, { captured_at: date, pose_type: pose || undefined, division: current.category, notes: notes || undefined }, setProgress);
      toast('Uploaded');
      setFile(null);
      setNotes('');
      if (fileRef.current) fileRef.current.value = '';
      await reload();
      await refreshAthletes();
    } catch (err) {
      toast((err as Error).message);
    } finally {
      setProgress(null);
    }
  }

  async function del(m: MediaAsset) {
    if (!confirm('Delete this item and its analyses?')) return;
    await api.media.remove(m.id);
    await reload();
    await refreshAthletes();
    toast('Deleted');
  }

  if (!current) return <NeedAthlete />;

  return (
    <div>
      <PageHead
        kicker="Capture"
        title="Photos & video"
        lede="Add current and historical shots. Tag each with the pose and the date it was actually taken so progress lines up honestly over time."
      />

      <div className="grid" style={{ gridTemplateColumns: '380px 1fr', gap: 24, alignItems: 'start' }}>
        <form className="card" onSubmit={doUpload}>
          <p className="kicker" style={{ marginBottom: 16 }}>Upload</p>
          <label className="field">
            <span className="lab">File (photo or video)</span>
            <input ref={fileRef} type="file" accept="image/*,video/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          </label>
          <label className="field">
            <span className="lab">Pose</span>
            <select value={pose} onChange={(e) => setPose(e.target.value)}>
              <option value="">— untagged —</option>
              {poses.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span className="lab">Date taken</span>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </label>
          <label className="field">
            <span className="lab">Notes (optional)</span>
            <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. 6 weeks out, morning, pumped" />
          </label>
          {progress != null && (
            <div className="meter" style={{ margin: '4px 0 14px' }}>
              <span style={{ width: `${progress}%` }} />
            </div>
          )}
          <button className="btn primary" disabled={!file || progress != null}>
            <Icon name="upload" size={14} /> {progress != null ? `Uploading ${progress}%` : 'Upload'}
          </button>
          <p className="tiny muted" style={{ marginTop: 12 }}>
            Photos are processed on your machine for geometry analysis and never leave it unless you explicitly run AI coaching.
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
                <p className="kicker" style={{ marginBottom: 10 }}>Untagged · {untagged.length}</p>
                <div className="media-grid">
                  {untagged.map((m) => (
                    <MediaTile key={m.id} m={m} poses={poses} onDelete={() => del(m)} onGrab={() => setGrab(m)} onRetag={reload} />
                  ))}
                </div>
              </section>
            );
          })()}
          {media.length === 0 && (
            <EmptyState title="Nothing captured yet">Upload your first photo or video using the form on the left.</EmptyState>
          )}
        </div>
      </div>

      {grab && current && (
        <FrameGrabber
          media={grab}
          onClose={() => setGrab(null)}
          onCaptured={async (blob) => {
            const f = new File([blob], `frame-${Date.now()}.jpg`, { type: 'image/jpeg' });
            await api.media.upload(current.id, f, { captured_at: grab.captured_at, pose_type: grab.pose_type ?? undefined, division: current.category, notes: 'Frame captured from video' });
            toast('Frame saved as photo');
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
      {m.kind === 'video' && <span className="badge">video</span>}
      <span className="meta">{shortDate(m.captured_at)}</span>
      <div style={{ position: 'absolute', top: 6, right: 6, display: 'flex', gap: 4 }}>
        {m.kind === 'video' && (
          <button className="btn sm" style={{ padding: 4 }} title="Capture frame" onClick={onGrab}>
            <Icon name="camera" size={13} />
          </button>
        )}
        <button className="btn sm danger" style={{ padding: 4 }} title="Delete" onClick={onDelete}>
          <Icon name="trash" size={13} />
        </button>
      </div>
      {poses && onRetag && (
        <select
          style={{ position: 'absolute', bottom: 28, left: 6, right: 6, width: 'auto', fontSize: 11, padding: '3px 6px' }}
          defaultValue=""
          onChange={async (e) => {
            await api.media.update(m.id, { pose_type: e.target.value });
            onRetag();
          }}
        >
          <option value="" disabled>
            tag pose…
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
          <p className="kicker">Capture a frame — {poseLabel(media.pose_type)}</p>
          <button className="btn sm" onClick={onClose}>Close</button>
        </div>
        <video ref={videoRef} src={media.url} controls style={{ width: '100%', borderRadius: 4 }} />
        <p className="tiny muted" style={{ margin: '12px 0' }}>Scrub to the moment you hit the pose, then capture it as an analyzable photo.</p>
        <button className="btn primary" onClick={capture}>
          <Icon name="camera" size={14} /> Capture current frame
        </button>
      </div>
    </div>
  );
}

function NeedAthlete() {
  return (
    <div>
      <PageHead title="Capture" lede="Select an athlete first." />
      <Link to="/athletes" className="btn primary">Go to athletes</Link>
    </div>
  );
}
