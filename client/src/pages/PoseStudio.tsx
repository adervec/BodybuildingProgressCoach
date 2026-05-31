import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useApp } from '../state/store';
import { api } from '../api';
import type { AiCoaching, Landmark, MediaAsset, PoseMetrics } from '../lib/types';
import { posesForCategory, findPose, poseLabel } from '../lib/poses';
import { analyzePose } from '../lib/geometry';
import { detectPose, loadImage } from '../lib/poseDetect';
import { PageHead, EmptyState } from '../components/Layout';
import { PoseDiagram } from '../components/PoseDiagram';
import { LandmarkCanvas } from '../components/LandmarkCanvas';
import { ScoreBar, BigScore } from '../components/Score';
import { Icon } from '../components/Icon';
import { shortDate, scoreColor } from '../lib/format';

interface LocalAnalysis {
  landmarks: Landmark[] | null;
  metrics: PoseMetrics | null;
  form_score: number | null;
  symmetry_score: number | null;
  ref_match_score: number | null;
  confidence: number | null;
}

export function PoseStudio() {
  const { current, aiEnabled, aiModel, toast } = useApp();
  const poses = current ? posesForCategory(current.category) : [];
  const [params, setParams] = useSearchParams();
  const poseId = params.get('pose') || poses[0]?.id || '';
  const pose = findPose(poseId);

  const [media, setMedia] = useState<MediaAsset[]>([]);
  const [selId, setSelId] = useState<number | null>(null);
  const [analysis, setAnalysis] = useState<LocalAnalysis | null>(null);
  const [ai, setAi] = useState<AiCoaching | null>(null);
  const [detecting, setDetecting] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);

  // Load photos for this pose.
  useEffect(() => {
    if (!current || !poseId) return;
    api.media.list(current.id, { pose_type: poseId, kind: 'photo' }).then((list) => {
      setMedia(list);
      setSelId(list.at(-1)?.id ?? null);
    });
  }, [current, poseId]);

  const selected = useMemo(() => media.find((m) => m.id === selId) ?? null, [media, selId]);

  // When a photo is selected, pull any stored analysis.
  useEffect(() => {
    setAnalysis(null);
    setAi(null);
    if (!selId) return;
    api.media.get(selId).then((full) => {
      const geo = full.analyses?.find((a) => a.source === 'geometry');
      const aiA = full.analyses?.find((a) => a.source === 'ai');
      if (geo) {
        setAnalysis({
          landmarks: geo.landmarks ?? null,
          metrics: geo.metrics ?? null,
          form_score: geo.form_score,
          symmetry_score: geo.symmetry_score,
          ref_match_score: geo.ref_match_score,
          confidence: geo.confidence,
        });
      }
      if (aiA?.ai_feedback) setAi(aiA.ai_feedback);
    });
  }, [selId]);

  async function runGeometry() {
    if (!selected) return;
    setDetecting(true);
    try {
      const img = await loadImage(selected.url);
      const res = await detectPose(img);
      if (!res) {
        toast('No body detected — try a clearer, full-body photo.');
        return;
      }
      const out = analyzePose(res.landmarks, res.width, res.height, pose);
      setAnalysis({ landmarks: res.landmarks, metrics: out.metrics, form_score: out.form_score, symmetry_score: out.symmetry_score, ref_match_score: out.ref_match_score, confidence: out.confidence });
      await api.analysis.saveGeometry(selected.id, {
        pose_type: poseId,
        form_score: out.form_score,
        symmetry_score: out.symmetry_score,
        ref_match_score: out.ref_match_score,
        confidence: out.confidence,
        metrics: out.metrics,
        landmarks: res.landmarks,
      });
      toast('Geometry analysis saved');
    } catch (err) {
      toast((err as Error).message);
    } finally {
      setDetecting(false);
    }
  }

  async function runAi() {
    if (!selected) return;
    setAiBusy(true);
    try {
      const res = await api.analysis.runAi(selected.id, {
        pose_type: poseId,
        division: current?.category,
        objectiveMetrics: analysis?.metrics ?? undefined,
      });
      setAi(res.ai_feedback);
      toast('AI coaching ready');
    } catch (err) {
      toast((err as Error).message);
    } finally {
      setAiBusy(false);
    }
  }

  if (!current)
    return (
      <div>
        <PageHead title="Pose Studio" lede="Select an athlete first." />
        <Link to="/athletes" className="btn primary">Go to athletes</Link>
      </div>
    );

  return (
    <div>
      <PageHead kicker="Pose Studio" title={pose?.label ?? 'Select a pose'} lede={pose?.reveals} />

      {/* Pose tabs */}
      <div className="row wrap" style={{ gap: 8, marginBottom: 22 }}>
        {poses.map((p) => (
          <button key={p.id} className={`btn sm ${p.id === poseId ? 'primary' : ''}`} onClick={() => setParams({ pose: p.id })}>
            {p.label}
          </button>
        ))}
      </div>

      <div className="grid" style={{ gridTemplateColumns: '300px 1fr', gap: 24, alignItems: 'start' }}>
        {/* Ideal diagram + criteria */}
        <div className="card">
          <p className="kicker" style={{ marginBottom: 8 }}>Reference form</p>
          {pose && <PoseDiagram poseId={pose.id} maxWidth={210} />}
          {pose && (
            <div style={{ marginTop: 16 }}>
              <Criteria label="Judge sees" text={pose.judgeSees} />
              <p className="kicker" style={{ margin: '14px 0 6px' }}>Execution</p>
              <ul className="stack" style={{ gap: 6, listStyle: 'none' }}>
                {pose.cues.map((c, i) => (
                  <li key={i} className="tiny muted" style={{ paddingLeft: 14, position: 'relative' }}>
                    <span style={{ position: 'absolute', left: 0, top: 7, width: 7, height: 1, background: 'var(--accent)' }} />
                    {c}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Selected photo + analysis */}
        <div className="stack">
          {media.length === 0 ? (
            <EmptyState title={`No ${pose?.label ?? ''} photos yet`}>
              Add some in <Link to="/capture">Capture</Link> (tag them with this pose), then analyze them here.
            </EmptyState>
          ) : (
            <>
              <div className="row wrap" style={{ gap: 8 }}>
                {media.map((m) => (
                  <button
                    key={m.id}
                    className="thumb"
                    style={{ width: 64, aspectRatio: '3/4', outline: m.id === selId ? '2px solid var(--accent)' : 'none' }}
                    onClick={() => setSelId(m.id)}
                  >
                    {m.thumb_url && <img src={m.thumb_url} alt="" />}
                    <span className="meta" style={{ fontSize: 8, padding: '3px 4px' }}>{shortDate(m.captured_at)}</span>
                  </button>
                ))}
              </div>

              {selected && (
                <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', gap: 20, alignItems: 'start' }}>
                  <div className="card">
                    <LandmarkCanvas imageUrl={selected.url} landmarks={analysis?.landmarks ?? null} />
                    <button className="btn primary" style={{ marginTop: 14, width: '100%' }} onClick={runGeometry} disabled={detecting}>
                      <Icon name="pose" size={14} /> {detecting ? 'Analyzing… (first run loads the model)' : analysis ? 'Re-run geometry analysis' : 'Analyze pose geometry'}
                    </button>
                  </div>

                  <div className="card">
                    {analysis ? (
                      <ScorePanel a={analysis} />
                    ) : (
                      <p className="muted tiny">Run geometry analysis to measure symmetry, proportions and reference-form match for this photo.</p>
                    )}
                  </div>
                </div>
              )}

              {/* AI coaching */}
              <div className="card">
                <div className="row spread" style={{ marginBottom: 10 }}>
                  <p className="kicker"><Icon name="ai" size={12} /> AI coach {aiEnabled ? `· ${aiModel}` : ''}</p>
                  {aiEnabled && selected && (
                    <button className="btn sm" onClick={runAi} disabled={aiBusy}>
                      {aiBusy ? 'Thinking…' : ai ? 'Re-analyze' : 'Get AI coaching'}
                    </button>
                  )}
                </div>
                {!aiEnabled ? (
                  <p className="tiny muted">
                    Optional AI coaching is disabled. Add <span className="mono">ANTHROPIC_API_KEY</span> to <span className="mono">server/.env</span> to
                    enable an honest, criteria-based written critique. The local geometry analysis above is always available and fully private.
                  </p>
                ) : ai ? (
                  <AiPanel ai={ai} />
                ) : (
                  <p className="tiny muted">
                    Runs the selected photo against the same judging rubric. Note: this sends the photo to Anthropic for that one request.
                  </p>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Criteria({ label, text }: { label: string; text: string }) {
  return (
    <div>
      <p className="kicker" style={{ marginBottom: 4 }}>{label}</p>
      <p className="tiny muted">{text}</p>
    </div>
  );
}

function ScorePanel({ a }: { a: LocalAnalysis }) {
  const m = a.metrics;
  return (
    <div>
      <BigScore value={a.form_score} caption={a.form_score == null ? 'Not geometrically scored' : 'Form score'} />
      <div style={{ marginTop: 18 }}>
        <ScoreBar label="Symmetry" value={a.symmetry_score} hint="Left/right balance — reproducible from your landmarks." />
        <ScoreBar label="Reference-form" value={a.ref_match_score} hint="Closeness of joint angles to the guide's stylized ideal." />
      </div>
      {m && (
        <>
          <div className="row wrap" style={{ gap: 14, marginTop: 14, fontFamily: 'var(--mono)', fontSize: 12 }}>
            <Metric label="Shoulder : waist" value={m.vTaper.toFixed(2)} />
            <Metric label="Shoulder width" value={m.shoulderWidth.toFixed(2)} />
            <Metric label="Hip width" value={m.hipWidth.toFixed(2)} />
            <Metric label="Confidence" value={`${Math.round((m.confidence ?? 0) * 100)}%`} />
          </div>
          <details style={{ marginTop: 12 }}>
            <summary className="tiny mono" style={{ cursor: 'pointer', color: 'var(--accent)' }}>Symmetry detail</summary>
            <div className="tiny muted" style={{ fontFamily: 'var(--mono)', marginTop: 8, lineHeight: 1.8 }}>
              shoulder tilt {m.symmetry.shoulderTilt}° · hip tilt {m.symmetry.hipTilt}° · arm Δ {m.symmetry.armElevationDiff}° · elbow Δ{' '}
              {m.symmetry.elbowAngleDiff}° · leg Δ {m.symmetry.legAngleDiff}°
            </div>
          </details>
          {m.notes.map((n, i) => (
            <p key={i} className="tiny" style={{ marginTop: 10, color: 'var(--text-dim)', fontStyle: 'italic' }}>
              {n}
            </p>
          ))}
        </>
      )}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ color: 'var(--text)', fontSize: 18, fontFamily: 'var(--display)' }}>{value}</div>
      <div className="tiny" style={{ color: 'var(--text-mute)' }}>{label}</div>
    </div>
  );
}

function AiPanel({ ai }: { ai: AiCoaching }) {
  return (
    <div className="stack" style={{ gap: 14 }}>
      <p style={{ fontStyle: 'italic' }}>{ai.overall_impression}</p>
      <div className="banner tiny">Pose match: {ai.estimated_pose_match}</div>
      <Section title="Strengths">
        {ai.strengths.map((s, i) => (
          <li key={i}><b>{s.area}.</b> {s.note}</li>
        ))}
      </Section>
      <Section title="Improvements">
        {ai.improvements.map((s, i) => (
          <li key={i}>
            <span className="pill" style={{ marginRight: 8, color: s.priority === 'high' ? 'var(--bad)' : s.priority === 'medium' ? 'var(--warn)' : 'var(--text-dim)' }}>{s.priority}</span>
            <b>{s.area}.</b> {s.note}
          </li>
        ))}
      </Section>
      {ai.pose_specific_cues.length > 0 && (
        <Section title="Drill these cues">
          {ai.pose_specific_cues.map((c, i) => (
            <li key={i}>{c}</li>
          ))}
        </Section>
      )}
      {ai.conditioning_notes && <p className="tiny muted">Conditioning: {ai.conditioning_notes}</p>}
      <p className="tiny" style={{ color: 'var(--text-mute)', fontStyle: 'italic' }}>
        Caveats: {ai.honesty_caveats} · confidence {Math.round((ai.confidence ?? 0) * 100)}% · model {ai.model}
      </p>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="kicker" style={{ marginBottom: 6 }}>{title}</p>
      <ul className="stack" style={{ gap: 6, listStyle: 'none', fontSize: 14, color: 'var(--text-dim)' }}>{children}</ul>
    </div>
  );
}
