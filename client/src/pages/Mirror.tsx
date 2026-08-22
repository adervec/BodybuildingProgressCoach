import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../state/store';
import { api } from '../api';
import { posesForCategory } from '../lib/poses';
import type { PoseDef } from '../lib/poses';
import { analyzePose, SKELETON } from '../lib/geometry';
import { detectPoseVideo, type DetectResult } from '../lib/poseDetect';
import { PageHead } from '../components/Layout';
import { PoseDiagram } from '../components/PoseDiagram';
import { ScoreBar, BigScore } from '../components/Score';
import { Icon } from '../components/Icon';
import { todayISO } from '../lib/format';

/** Judge's call-out, spoken. Native speech synthesis — silently absent where unsupported. */
function speak(text: string) {
  if (!('speechSynthesis' in window)) return;
  speechSynthesis.cancel();
  speechSynthesis.speak(new SpeechSynthesisUtterance(text));
}

/** A short tone, so you can follow the countdown without reading the screen from across the room. */
let actx: AudioContext | null = null;
function beep(freq = 880, ms = 90) {
  try {
    actx ??= new AudioContext();
    void actx.resume();
    const o = actx.createOscillator();
    const g = actx.createGain();
    o.frequency.value = freq;
    g.gain.value = 0.08;
    o.connect(g).connect(actx.destination);
    o.start();
    o.stop(actx.currentTime + ms / 1000);
  } catch {
    /* no audio output — the visuals still work */
  }
}

interface LiveScores {
  form: number | null;
  symmetry: number | null;
  ref: number | null;
  confidence: number;
}

/** Live posing practice: your camera as a smart mirror with real-time scoring. */
export function Mirror() {
  const { current, toast, refreshAthletes } = useApp();
  const poses = current ? posesForCategory(current.category) : [];
  const [poseIdx, setPoseIdx] = useState(0);
  const pose: PoseDef | undefined = poses.length ? poses[poseIdx % poses.length] : undefined;
  const [on, setOn] = useState(false);
  const [routine, setRoutine] = useState(false);
  const [holdSecs, setHoldSecs] = useState(10);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [callouts, setCallouts] = useState(true);
  const [autoSnap, setAutoSnap] = useState(false);
  const [snapIn, setSnapIn] = useState<number | null>(null); // self-timer for a hands-free save
  const [live, setLive] = useState<LiveScores | null>(null);
  const [saving, setSaving] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef(0);
  const poseRef = useRef<PoseDef | undefined>(pose);
  const lastRes = useRef<DetectResult | null>(null);
  const ema = useRef<LiveScores | null>(null);
  poseRef.current = pose;

  async function start() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      streamRef.current = stream;
      const v = videoRef.current!;
      v.srcObject = stream;
      await v.play();
      setOn(true);
      rafRef.current = requestAnimationFrame(tick);
    } catch (err) {
      toast(`Camera unavailable: ${(err as Error).message}`);
    }
  }

  function stop() {
    cancelAnimationFrame(rafRef.current);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    lastRes.current = null;
    ema.current = null;
    setOn(false);
    setLive(null);
    setSnapIn(null);
    if ('speechSynthesis' in window) speechSynthesis.cancel();
  }

  // Detection loop: rAF-paced but self-throttling — the next frame is only
  // scheduled after the current detection resolves, so CPU machines just run slower.
  async function tick() {
    const v = videoRef.current;
    if (!v || !streamRef.current) return;
    if (v.readyState >= 2 && v.videoWidth) {
      try {
        const res = await detectPoseVideo(v, performance.now());
        lastRes.current = res;
        drawOverlay(res);
        if (res) {
          const out = analyzePose(res.landmarks, res.width, res.height, poseRef.current);
          const next: LiveScores = {
            form: out.form_score,
            symmetry: out.symmetry_score,
            ref: out.ref_match_score,
            confidence: out.confidence,
          };
          // ponytail: EMA (α .25) to stop per-frame jitter; a Kalman filter would be theater.
          const mix = (a: number | null, b: number | null) => (a == null || b == null ? b : Math.round(a * 0.75 + b * 0.25));
          ema.current = ema.current
            ? { form: mix(ema.current.form, next.form), symmetry: mix(ema.current.symmetry, next.symmetry), ref: mix(ema.current.ref, next.ref), confidence: next.confidence }
            : next;
          setLive(ema.current);
        }
      } catch {
        /* one bad frame is not news */
      }
    }
    rafRef.current = requestAnimationFrame(tick);
  }

  function drawOverlay(res: DetectResult | null) {
    const v = videoRef.current, c = overlayRef.current;
    if (!v || !c) return;
    if (c.width !== v.videoWidth) { c.width = v.videoWidth; c.height = v.videoHeight; }
    const g = c.getContext('2d')!;
    g.clearRect(0, 0, c.width, c.height);
    if (!res) return;
    g.strokeStyle = 'rgba(231,196,122,.85)';
    g.lineWidth = Math.max(2, c.width / 320);
    for (const [a, b] of SKELETON) {
      const p = res.landmarks[a], q = res.landmarks[b];
      if (p.visibility < 0.3 || q.visibility < 0.3) continue;
      g.beginPath();
      g.moveTo(p.x * c.width, p.y * c.height);
      g.lineTo(q.x * c.width, q.y * c.height);
      g.stroke();
    }
    g.fillStyle = '#fff';
    for (const p of res.landmarks) {
      if (p.visibility < 0.3) continue;
      g.beginPath();
      g.arc(p.x * c.width, p.y * c.height, Math.max(2.5, c.width / 400), 0, Math.PI * 2);
      g.fill();
    }
  }

  // Routine mode: auto-advance through the division's mandatories, like a judge's call-outs.
  useEffect(() => {
    if (!on || !routine || poses.length < 2) {
      setCountdown(null);
      return;
    }
    setCountdown(holdSecs);
    const iv = setInterval(() => {
      setCountdown((c) => {
        if (c == null) return c;
        if (c <= 1) {
          setPoseIdx((i) => (i + 1) % poses.length);
          return holdSecs;
        }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(iv);
  }, [on, routine, holdSecs, poses.length]);

  // Call the pose aloud whenever the routine advances.
  useEffect(() => {
    if (on && routine && callouts && pose) speak(pose.label);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [poseIdx, on, routine]);

  // Last three seconds of a hold tick audibly; a hold ending with auto-save fires the save.
  const snapRef = useRef<() => Promise<void>>(async () => {});
  useEffect(() => {
    if (countdown == null) return;
    if (countdown <= 3) beep(countdown === 1 ? 1320 : 880);
    if (countdown === 1 && autoSnap) void snapRef.current();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [countdown]);

  // Self-timer: 3…2…1 then save, so you can step back into the pose first.
  useEffect(() => {
    if (snapIn == null) return;
    if (snapIn === 0) {
      setSnapIn(null);
      void snapRef.current();
      return;
    }
    beep(snapIn === 1 ? 1320 : 880);
    const t = setTimeout(() => setSnapIn(snapIn - 1), 1000);
    return () => clearTimeout(t);
  }, [snapIn]);

  useEffect(() => stop, []); // eslint-disable-line react-hooks/exhaustive-deps

  /** Save the current frame (un-mirrored) into the library, with its geometry analysis attached. */
  async function snap() {
    const v = videoRef.current;
    if (!v || !current || !pose) return;
    setSaving(true);
    try {
      const c = document.createElement('canvas');
      c.width = v.videoWidth;
      c.height = v.videoHeight;
      c.getContext('2d')!.drawImage(v, 0, 0);
      const blob = await new Promise<Blob | null>((r) => c.toBlob(r, 'image/jpeg', 0.92));
      if (!blob) throw new Error('Could not read the camera frame');
      const f = new File([blob], `mirror-${Date.now()}.jpg`, { type: 'image/jpeg' });
      const m = await api.media.upload(current.id, f, {
        captured_at: todayISO(),
        pose_type: pose.id,
        division: current.category,
        notes: 'Captured in the Mirror',
      });
      const res = lastRes.current;
      if (res) {
        const out = analyzePose(res.landmarks, res.width, res.height, pose);
        await api.analysis.saveGeometry(m.id, {
          pose_type: pose.id,
          form_score: out.form_score,
          symmetry_score: out.symmetry_score,
          ref_match_score: out.ref_match_score,
          confidence: out.confidence,
          metrics: out.metrics,
          landmarks: res.landmarks,
        });
      }
      toast(`Saved ${pose.label}${live?.form != null ? ` · form ${live.form}` : ''}`);
      await refreshAthletes();
    } catch (err) {
      toast((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  snapRef.current = snap;

  if (!current)
    return (
      <div>
        <PageHead title="Mirror" lede="Select an athlete first." />
        <Link to="/athletes" className="btn primary">Go to athletes</Link>
      </div>
    );

  return (
    <div>
      <PageHead
        kicker="Mirror"
        title="Live posing practice"
        lede="Your camera becomes a scoring mirror: hit the pose, watch symmetry and reference-form track in real time, and save the best frame straight into your library. Routine mode calls each pose aloud and can save a frame at the end of every hold — prop the phone up and run your whole round hands-free. Everything runs on this device; the video never leaves it."
      />

      <div className="grid" style={{ gridTemplateColumns: '300px 1fr', gap: 24, alignItems: 'start' }}>
        <div className="stack" style={{ gap: 16 }}>
          <div className="card">
            <p className="kicker" style={{ marginBottom: 10 }}>Pose</p>
            <select value={poseIdx % Math.max(poses.length, 1)} onChange={(e) => setPoseIdx(Number(e.target.value))} style={{ width: '100%' }}>
              {poses.map((p, i) => (
                <option key={p.id} value={i}>{p.label}</option>
              ))}
            </select>
            {pose && <div style={{ marginTop: 12 }}><PoseDiagram poseId={pose.id} maxWidth={170} /></div>}
            {pose && (
              <ul className="stack" style={{ gap: 6, listStyle: 'none', marginTop: 10 }}>
                {pose.cues.map((c, i) => (
                  <li key={i} className="tiny muted" style={{ paddingLeft: 14, position: 'relative' }}>
                    <span style={{ position: 'absolute', left: 0, top: 7, width: 7, height: 1, background: 'var(--accent)' }} />
                    {c}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="card">
            <p className="kicker" style={{ marginBottom: 10 }}>Routine</p>
            <label className="row" style={{ gap: 8, marginBottom: 10, cursor: 'pointer' }}>
              <input type="checkbox" checked={routine} style={{ width: 'auto' }} onChange={(e) => setRoutine(e.target.checked)} />
              <span className="tiny">Auto-advance through all {poses.length} poses — judge's call-outs</span>
            </label>
            <label className="row" style={{ gap: 8, marginBottom: 10, cursor: 'pointer' }}>
              <input type="checkbox" checked={callouts} style={{ width: 'auto' }} onChange={(e) => setCallouts(e.target.checked)} />
              <span className="tiny">Call each pose aloud</span>
            </label>
            <label className="row" style={{ gap: 8, marginBottom: 10, cursor: 'pointer' }}>
              <input type="checkbox" checked={autoSnap} style={{ width: 'auto' }} onChange={(e) => setAutoSnap(e.target.checked)} />
              <span className="tiny">Auto-save a frame at the end of every hold</span>
            </label>
            <label className="field" style={{ marginBottom: 0 }}>
              <span className="lab">Hold each pose (seconds)</span>
              <input type="number" min={3} max={60} value={holdSecs} onChange={(e) => setHoldSecs(Math.max(3, Math.min(60, Number(e.target.value) || 10)))} />
            </label>
          </div>

          <div className="card">
            <p className="kicker" style={{ marginBottom: 10 }}>Live score</p>
            {live ? (
              <>
                <BigScore value={live.form} caption={live.form == null ? 'Pose not geometrically scored — watch symmetry' : 'Form (live)'} />
                <div style={{ marginTop: 14 }}>
                  <ScoreBar label="Symmetry" value={live.symmetry} />
                  <ScoreBar label="Reference-form" value={live.ref} />
                </div>
                <p className="tiny muted" style={{ marginTop: 10 }}>Landmark confidence {Math.round(live.confidence * 100)}%</p>
              </>
            ) : (
              <p className="tiny muted">{on ? 'Step back until your whole body is in frame.' : 'Start the mirror to see live scores.'}</p>
            )}
          </div>
        </div>

        <div className="card">
          <div style={{ position: 'relative', background: '#0c0b08', borderRadius: 6, overflow: 'hidden' }}>
            {/* Mirrored like a real mirror; saved photos are flipped back to how a judge sees you. */}
            <video ref={videoRef} playsInline muted style={{ width: '100%', display: 'block', transform: 'scaleX(-1)', minHeight: 240 }} />
            <canvas ref={overlayRef} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', transform: 'scaleX(-1)' }} />
            {on && pose && (
              <div style={{ position: 'absolute', top: 10, left: 12, right: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center', pointerEvents: 'none' }}>
                <span className="pill" style={{ background: 'rgba(0,0,0,.55)', color: '#f3ecdd' }}>{pose.label}</span>
                {(snapIn ?? countdown) != null && (
                  <span
                    className="display"
                    style={{ fontSize: snapIn != null ? 56 : 34, color: (snapIn ?? countdown!) <= 3 ? 'var(--bad)' : '#f3ecdd', textShadow: '0 1px 6px rgba(0,0,0,.7)' }}
                  >
                    {snapIn ?? countdown}
                  </span>
                )}
              </div>
            )}
            {!on && (
              <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center' }}>
                <button className="btn primary" onClick={start}>
                  <Icon name="camera" size={15} /> Start the mirror
                </button>
              </div>
            )}
          </div>
          <div className="row" style={{ gap: 8, marginTop: 14 }}>
            {on && (
              <>
                <button className="btn primary" onClick={() => setSnapIn(3)} disabled={saving || snapIn != null || !pose}>
                  <Icon name="capture" size={14} /> {saving ? 'Saving…' : snapIn != null ? `Saving in ${snapIn}…` : 'Save in 3 s'}
                </button>
                <button className="btn" onClick={snap} disabled={saving || snapIn != null || !pose} title="Save the current frame immediately">
                  Save now
                </button>
                <button className="btn" onClick={stop}>Stop</button>
              </>
            )}
            <span className="tiny muted" style={{ marginLeft: 'auto', alignSelf: 'center' }}>
              First start downloads the pose model (~5 MB), then it's all local.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
