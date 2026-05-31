import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../state/store';
import { api } from '../api';
import { posesForCategory, findPose } from '../lib/poses';
import { PageHead, EmptyState } from '../components/Layout';
import { Icon } from '../components/Icon';
import { loadImage } from '../lib/poseDetect';
import { drawFrame, exportTimelapseWebm, alignmentFromLandmarks, type TimelapseFrame } from '../lib/timelapse';
import { formatDate } from '../lib/format';

const W = 540;
const H = 720;

export function Timelapse() {
  const { current, toast } = useApp();
  const poses = current ? posesForCategory(current.category) : [];
  const [poseId, setPoseId] = useState('');
  const [frames, setFrames] = useState<TimelapseFrame[]>([]);
  const [building, setBuilding] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [idx, setIdx] = useState(0);
  const [align, setAlign] = useState(true);
  const [holdMs, setHoldMs] = useState(650);
  const [exporting, setExporting] = useState<number | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (poses.length && !poseId) setPoseId(poses[0].id);
  }, [poses, poseId]);

  const theme = () => {
    const cs = getComputedStyle(document.documentElement);
    return { bg: cs.getPropertyValue('--bg').trim() || '#0c0b08', accent: cs.getPropertyValue('--accent-bright').trim() || '#e7c47a' };
  };

  async function build() {
    if (!current || !poseId) return;
    setBuilding(true);
    setPlaying(false);
    setFrames([]);
    try {
      const list = await api.media.list(current.id, { pose_type: poseId, kind: 'photo' });
      if (!list.length) {
        toast('No photos for this pose yet.');
        return;
      }
      const built: TimelapseFrame[] = [];
      for (const m of list) {
        const img = await loadImage(m.url).catch(() => null);
        if (!img) continue;
        let alignment = null;
        if (align) {
          const full = await api.media.get(m.id);
          const geo = full.analyses?.find((a) => a.source === 'geometry');
          if (geo?.landmarks) alignment = alignmentFromLandmarks(geo.landmarks, img.naturalWidth, img.naturalHeight);
        }
        built.push({ img, caption: formatDate(m.captured_at), alignment });
      }
      setFrames(built);
      setIdx(0);
      // draw first frame
      requestAnimationFrame(() => drawAt(built, 0));
    } finally {
      setBuilding(false);
    }
  }

  function drawAt(fr: TimelapseFrame[], i: number) {
    const canvas = canvasRef.current;
    if (!canvas || !fr[i]) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const t = theme();
    drawFrame(ctx, fr[i], W, H, { align, bg: t.bg, caption: true, accent: t.accent });
  }

  // playback loop
  useEffect(() => {
    if (!playing || frames.length === 0) return;
    const id = window.setInterval(() => {
      setIdx((prev) => {
        const next = (prev + 1) % frames.length;
        drawAt(frames, next);
        return next;
      });
    }, holdMs);
    return () => window.clearInterval(id);
  }, [playing, frames, holdMs, align]);

  useEffect(() => {
    if (frames.length) drawAt(frames, idx);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [align]);

  async function exportWebm() {
    if (!frames.length) return;
    setExporting(0);
    setPlaying(false);
    try {
      const t = theme();
      const blob = await exportTimelapseWebm(frames, { width: 1080, height: 1440, holdMs, align, bg: t.bg, accent: t.accent, onProgress: (p) => setExporting(Math.round(p * 100)) });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${current?.name ?? 'athlete'}-${poseId}-timelapse.webm`.replace(/\s+/g, '_');
      a.click();
      URL.revokeObjectURL(url);
      toast('Timelapse exported');
    } catch (err) {
      toast((err as Error).message);
    } finally {
      setExporting(null);
    }
  }

  if (!current)
    return (
      <div>
        <PageHead title="Timelapse" lede="Select an athlete first." />
        <Link to="/athletes" className="btn primary">Go to athletes</Link>
      </div>
    );

  return (
    <div>
      <PageHead
        kicker="Timelapse"
        title="Progress in motion"
        lede="Sequence one pose across every date you've shot it. Body-aligned framing keeps you the same size and centred frame-to-frame, so the change you see is real — not the camera moving."
      />

      <div className="grid" style={{ gridTemplateColumns: '320px 1fr', gap: 24, alignItems: 'start' }}>
        <div className="card">
          <label className="field">
            <span className="lab">Pose</span>
            <select value={poseId} onChange={(e) => setPoseId(e.target.value)}>
              {poses.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span className="lab">Seconds per frame</span>
            <input type="range" min={200} max={1500} step={50} value={holdMs} onChange={(e) => setHoldMs(Number(e.target.value))} />
            <span className="tiny muted mono">{(holdMs / 1000).toFixed(2)}s</span>
          </label>
          <label className="row" style={{ gap: 8, marginBottom: 16, cursor: 'pointer' }}>
            <input type="checkbox" checked={align} style={{ width: 'auto' }} onChange={(e) => setAlign(e.target.checked)} />
            <span className="tiny">Align by body (recommended — uses analyzed photos)</span>
          </label>
          <button className="btn primary" style={{ width: '100%', marginBottom: 8 }} onClick={build} disabled={building}>
            <Icon name="timelapse" size={14} /> {building ? 'Building…' : 'Build timelapse'}
          </button>
          {frames.length > 0 && (
            <>
              <div className="row" style={{ gap: 8 }}>
                <button className="btn" style={{ flex: 1 }} onClick={() => setPlaying((p) => !p)}>
                  <Icon name="play" size={14} /> {playing ? 'Pause' : 'Play'}
                </button>
                <button className="btn" onClick={exportWebm} disabled={exporting != null}>
                  <Icon name="download" size={14} /> {exporting != null ? `${exporting}%` : 'Export'}
                </button>
              </div>
              <p className="tiny muted" style={{ marginTop: 10 }}>{frames.length} frames · exports a .webm video</p>
            </>
          )}
          {align && (
            <p className="tiny muted" style={{ marginTop: 12 }}>
              Tip: analyze each photo in <Link to="/pose">Pose Studio</Link> first so alignment has landmarks to work with.
            </p>
          )}
        </div>

        <div className="card" style={{ display: 'grid', placeItems: 'center' }}>
          {frames.length === 0 ? (
            <EmptyState title="No timelapse built yet">Pick a pose and press “Build timelapse”. You'll need at least two dated photos of that pose.</EmptyState>
          ) : (
            <>
              <canvas ref={canvasRef} width={W} height={H} style={{ width: '100%', maxWidth: W, borderRadius: 6, border: '1px solid var(--line)' }} />
              <input
                type="range"
                min={0}
                max={frames.length - 1}
                value={idx}
                onChange={(e) => {
                  const i = Number(e.target.value);
                  setPlaying(false);
                  setIdx(i);
                  drawAt(frames, i);
                }}
                style={{ marginTop: 14 }}
              />
              <p className="tiny muted mono">{frames[idx]?.caption}</p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
