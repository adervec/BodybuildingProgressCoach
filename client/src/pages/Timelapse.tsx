import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../state/store';
import { api } from '../api';
import { posesForCategory, findPose } from '../lib/poses';
import { PageHead, EmptyState } from '../components/Layout';
import { Icon } from '../components/Icon';
import { loadImage } from '../lib/poseDetect';
import { drawFrame, exportTimelapseWebm, extForMime, alignmentFromLandmarks, type TimelapseFrame } from '../lib/timelapse';
import { formatDate } from '../lib/format';
import { t, fmt } from '../lib/i18n';

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
        toast(t('No photos for this pose yet.'));
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
    const th = theme();
    drawFrame(ctx, fr[i], W, H, { align, bg: th.bg, caption: true, accent: th.accent });
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
      const th = theme();
      const blob = await exportTimelapseWebm(frames, { width: 1080, height: 1440, holdMs, align, bg: th.bg, accent: th.accent, onProgress: (p) => setExporting(Math.round(p * 100)) });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${current?.name ?? 'athlete'}-${poseId}-timelapse.${extForMime(blob.type)}`.replace(/\s+/g, '_');
      a.click();
      URL.revokeObjectURL(url);
      toast(t('Timelapse exported'));
    } catch (err) {
      toast((err as Error).message);
    } finally {
      setExporting(null);
    }
  }

  if (!current)
    return (
      <div>
        <PageHead title={t('Timelapse')} lede={t('Select an athlete first.')} />
        <Link to="/athletes" className="btn primary">{t('Go to athletes')}</Link>
      </div>
    );

  // The link sits inside one whole sentence; split the translation at its {link} placeholder.
  const tip = t('Tip: analyze each photo in {link} first so alignment has landmarks to work with.').split('{link}');

  return (
    <div>
      <PageHead
        kicker={t('Timelapse')}
        title={t('Progress in motion')}
        lede={t("Sequence one pose across every date you've shot it. Body-aligned framing keeps you the same size and centred frame-to-frame, so the change you see is real — not the camera moving.")}
      />

      <div className="grid" style={{ gridTemplateColumns: '320px 1fr', gap: 24, alignItems: 'start' }}>
        <div className="card">
          <label className="field">
            <span className="lab">{t('Pose')}</span>
            <select value={poseId} onChange={(e) => setPoseId(e.target.value)}>
              {poses.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span className="lab">{t('Seconds per frame')}</span>
            <input type="range" min={200} max={1500} step={50} value={holdMs} onChange={(e) => setHoldMs(Number(e.target.value))} />
            <span className="tiny muted mono">{t('{s} s', { s: fmt.fixed(holdMs / 1000, 2) })}</span>
          </label>
          <label className="row" style={{ gap: 8, marginBottom: 16, cursor: 'pointer' }}>
            <input type="checkbox" checked={align} style={{ width: 'auto' }} onChange={(e) => setAlign(e.target.checked)} />
            <span className="tiny">{t('Align by body (recommended — uses analyzed photos)')}</span>
          </label>
          <button className="btn primary" style={{ width: '100%', marginBottom: 8 }} onClick={build} disabled={building}>
            <Icon name="timelapse" size={14} /> {building ? t('Building…') : t('Build timelapse')}
          </button>
          {frames.length > 0 && (
            <>
              <div className="row" style={{ gap: 8 }}>
                <button className="btn" style={{ flex: 1 }} onClick={() => setPlaying((p) => !p)}>
                  <Icon name="play" size={14} /> {playing ? t('Pause') : t('Play')}
                </button>
                <button className="btn" onClick={exportWebm} disabled={exporting != null}>
                  <Icon name="download" size={14} /> {exporting != null ? fmt.percent(exporting / 100) : t('Export')}
                </button>
              </div>
              <p className="tiny muted" style={{ marginTop: 10 }}>{t.n('{n} frame · exports a .webm video', '{n} frames · exports a .webm video', frames.length)}</p>
            </>
          )}
          {align && (
            <p className="tiny muted" style={{ marginTop: 12 }}>
              {tip[0]}<Link to="/pose">{t('Pose Studio')}</Link>{tip[1]}
            </p>
          )}
        </div>

        <div className="card" style={{ display: 'grid', placeItems: 'center' }}>
          {frames.length === 0 ? (
            <EmptyState title={t('No timelapse built yet')}>{t("Pick a pose and press “Build timelapse”. You'll need at least two dated photos of that pose.")}</EmptyState>
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
