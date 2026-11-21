import { createElement, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { useApp } from '../state/store';
import { api } from '../api';
import type { BodyComp, MediaAsset, PoseAnalysis } from '../lib/types';
import { posesForCategory, poseLabel } from '../lib/poses';
import { PageHead, EmptyState } from '../components/Layout';
import { ScoreBar, Delta } from '../components/Score';
import { Icon } from '../components/Icon';
import { shortDate, formatDate, scoreColor } from '../lib/format';
import { coachChannel, COACH_REPLY_KEY } from '../lib/coachChannel';
import { POSE_REVIEW_CHANNEL, POSE_REVIEW_INSTRUCTIONS, buildReviewPayload, poseReviewChannel, setCoworkPanel } from '../lib/poseReview';
import { t, fmt } from '../lib/i18n';

/** Put React nodes into a translated sentence at its {placeholders} (so markup never splits a sentence). */
function fill(text: string, parts: Record<string, React.ReactNode>): React.ReactNode[] {
  return text.split(/(\{\w+\})/).map((bit, i) => {
    const k = bit.slice(1, -1);
    return bit.startsWith('{') && k in parts ? <span key={i}>{parts[k]}</span> : bit;
  });
}

// Folder cowork through the maker's shared panel (https://adervec.github.io/cowork.js, fs mode):
// the panel drives a folder you pick; we hand it the numbers (body comp + pose scores — never photos)
// as coach/request.json and show whatever an agent writes to coach/reply.json.
type CoworkGlobal = { mount: (host: HTMLElement, cfg: unknown) => { push(only?: string): unknown } };
function loadCowork(): Promise<CoworkGlobal | null> {
  const w = window as unknown as { cowork?: CoworkGlobal };
  if (w.cowork) return Promise.resolve(w.cowork);
  return new Promise((res) => {
    const s = document.createElement('script');
    s.src = 'https://adervec.github.io/cowork.js';
    s.async = true;
    s.onload = () => res(w.cowork ?? null);
    s.onerror = () => res(null);
    document.head.appendChild(s);
  });
}
function djb2(text: string): string {
  let h = 5381;
  for (let i = 0; i < text.length; i++) h = ((h * 33) ^ text.charCodeAt(i)) >>> 0;
  return h.toString(16);
}
const COACH_INSTRUCTIONS = `# Bodybuilding Progress Coach — coach channel

Read \`coach/request.json\`: \`payload.athlete\` (name, category, height), \`payload.bodyComp\` (dated weight /
body-fat / lean-mass / measurements, oldest first) and \`payload.poseScores\` (dated geometry scores per pose:
form, symmetry, reference match). No photos travel. Write \`coach/reply.json\`:

\`\`\`json
{ "requestHash": "<copy the request's requestHash verbatim>",
  "reply": "<honest, specific coaching in markdown: what the trends show, which pose or measurement to work on and how, what is clearly improving. Not medical advice; encouraging, no shaming.>" }
\`\`\`
`;

export function Dashboard() {
  const { current } = useApp();
  const [comp, setComp] = useState<BodyComp[]>([]);
  const [media, setMedia] = useState<MediaAsset[]>([]);
  const [analyses, setAnalyses] = useState<PoseAnalysis[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!current) return;
    setLoading(true);
    Promise.all([api.bodycomp.list(current.id), api.media.list(current.id), api.analysis.series(current.id)])
      .then(([c, m, a]) => {
        setComp(c);
        setMedia(m);
        setAnalyses(a);
      })
      .finally(() => setLoading(false));
  }, [current]);

  const latest = comp.at(-1) ?? null;
  const prev = comp.length > 1 ? comp.at(-2)! : null;

  // the shared cowork panel reads the freshest data through refs, so it never goes stale
  const coworkHost = useRef<HTMLDivElement>(null);
  const dataRef = useRef({ current, comp, analyses });
  dataRef.current = { current, comp, analyses };
  const [coachReply, setCoachReply] = useState(() => {
    try { return localStorage.getItem(COACH_REPLY_KEY) || ''; } catch { return ''; }
  });
  useEffect(() => {
    const host = coworkHost.current;
    if (!host) return;
    loadCowork().then((cw) => {
      if (!cw || !host.isConnected || host.childElementCount) return;
      const coach = coachChannel(setCoachReply);
      const freshAnalyses = () => (dataRef.current.current ? api.analysis.series(dataRef.current.current.id) : Promise.resolve([]));
      const poseReview = poseReviewChannel(freshAnalyses);
      const panel = cw.mount(host, {
        app: 'bodybuildingprogresscoach',
        manifest: { protocol: 'cowork-manifest', protocolVersion: 1, app: 'bodybuildingprogresscoach',
          channels: [
            { name: 'coach', request: ['coach/request.json'], instructions: 'coach/INSTRUCTIONS.md', replyPath: 'coach/reply.json' },
            { name: 'pose-review', request: ['pose-review/request.json'], instructions: 'pose-review/INSTRUCTIONS.md', replyPath: 'pose-review/reply.json' },
          ] },
        files: async (ch: string) => {
          const d = dataRef.current;
          if (ch === POSE_REVIEW_CHANNEL) {
            const payload = buildReviewPayload(d.current, await freshAnalyses());
            return {
              'pose-review/request.json': { protocol: 'bodybuildingprogresscoach-pose-review', protocolVersion: 1, kind: 'pose-review-request',
                generatedAt: new Date().toISOString(), requestHash: djb2(JSON.stringify(payload)), payload },
              'pose-review/INSTRUCTIONS.md': POSE_REVIEW_INSTRUCTIONS,
            };
          }
          const payload = {
            athlete: d.current ? { name: d.current.name, category: d.current.category, heightCm: d.current.height_cm } : null,
            bodyComp: d.comp.slice(-30).map((c) => ({ at: c.measured_at, weight: c.weight, unit: c.weight_unit, bodyFatPct: c.body_fat_pct,
              leanMass: c.lean_mass, measurements: c.measurements })),
            poseScores: d.analyses.slice(-40).map((a) => ({ at: a.captured_at ?? null, pose: a.pose_type ?? a.media_pose ?? null,
              form: a.form_score, symmetry: a.symmetry_score, refMatch: a.ref_match_score, source: a.source })),
          };
          return {
            'coach/request.json': { protocol: 'bodybuildingprogresscoach-coach', protocolVersion: 1, kind: 'coach-request',
              generatedAt: new Date().toISOString(), requestHash: djb2(JSON.stringify(payload)), payload },
            'coach/INSTRUCTIONS.md': COACH_INSTRUCTIONS,
          };
        },
        // v1 fallback; cowork v2 uses `channels` (review before applying, undo from the history)
        apply: (ch: string, reply: unknown) => (ch === POSE_REVIEW_CHANNEL ? poseReview.apply(reply) : coach.apply(reply)),
        channels: { coach, [POSE_REVIEW_CHANNEL]: poseReview },
      });
      setCoworkPanel(panel);
    });
    return () => { setCoworkPanel(null); host.replaceChildren(); };
  }, []);

  const chartData = useMemo(
    () => comp.map((c) => ({ date: shortDate(c.measured_at), weight: c.weight, bf: c.body_fat_pct })),
    [comp]
  );

  // Latest geometry form score per pose.
  const poseScores = useMemo(() => {
    if (!current) return [];
    const byPose = new Map<string, PoseAnalysis>();
    for (const a of analyses) {
      const key = a.pose_type ?? a.media_pose ?? '';
      if (!key) continue;
      const existing = byPose.get(key);
      if (!existing || (a.captured_at ?? '') >= (existing.captured_at ?? '')) byPose.set(key, a);
    }
    return posesForCategory(current.category).map((p) => ({
      pose: p,
      score: byPose.get(p.id)?.form_score ?? null,
    }));
  }, [analyses, current]);

  const focus = useMemo(() => {
    const scored = poseScores.filter((p) => p.score != null) as { pose: { id: string; label: string }; score: number }[];
    if (!scored.length) return null;
    return scored.reduce((lo, p) => (p.score < lo.score ? p : lo));
  }, [poseScores]);

  if (!current) {
    return (
      <div>
        <PageHead title={t('Welcome')} lede={t('Create or select an athlete to begin.')} />
        <Link to="/athletes" className="btn primary">
          <Icon name="athletes" size={14} /> {t('Go to athletes')}
        </Link>
        <Appearance />
      </div>
    );
  }

  return (
    <div>
      <PageHead kicker={t('Dashboard · {date}', { date: formatDate(latest?.measured_at) })} title={current.name} />

      <div className="banner" style={{ marginBottom: 26 }}>
        <b>{t('Honest & fair by design.')}</b>{' '}
        {t('Scores come first from reproducible geometry — left/right symmetry and scale-normalized proportions measured from your own photos — judged against the criteria in the posing guides. AI commentary is optional and clearly labelled.')}
      </div>

      {/* KPI row */}
      <div className="cards-grid" style={{ marginBottom: 22 }}>
        <Kpi label={t('Weight')} value={latest?.weight != null ? fmt.number(latest.weight, 1) : '—'} unit={latest?.weight_unit ?? ''}>
          {prev && latest?.weight != null && prev.weight != null && (
            <Delta value={latest.weight - prev.weight} unit={latest.weight_unit} invert />
          )}
        </Kpi>
        <Kpi label={t('Body fat')} value={latest?.body_fat_pct != null ? fmt.number(latest.body_fat_pct, 1) : '—'} unit="%">
          {prev && latest?.body_fat_pct != null && prev.body_fat_pct != null && (
            <Delta value={latest.body_fat_pct - prev.body_fat_pct} unit="%" invert />
          )}
        </Kpi>
        <Kpi label={t('Lean mass')} value={latest?.lean_mass != null ? fmt.number(latest.lean_mass, 1) : '—'} unit={latest?.weight_unit ?? ''}>
          {prev && latest?.lean_mass != null && prev.lean_mass != null && <Delta value={latest.lean_mass - prev.lean_mass} unit={latest.weight_unit} />}
        </Kpi>
        <Kpi label={t('Check-ins')} value={fmt.number(comp.length, 0)} unit={t('logged')} />
      </div>

      <div className="grid" style={{ gridTemplateColumns: '1.4fr 1fr', gap: 22, alignItems: 'start' }}>
        {/* Trend chart */}
        <div className="card">
          <div className="row spread" style={{ marginBottom: 12 }}>
            <p className="kicker">{t('Body composition trend')}</p>
            <Link to="/physique" className="btn sm">{t('Log / view')}</Link>
          </div>
          {chartData.length > 1 ? (
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={chartData} margin={{ top: 6, right: 10, left: -16, bottom: 0 }}>
                <CartesianGrid stroke="var(--line-soft)" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: 'var(--text-mute)' }} stroke="var(--line)" />
                <YAxis yAxisId="w" tick={{ fontSize: 11, fill: 'var(--text-mute)' }} stroke="var(--line)" />
                <YAxis yAxisId="bf" orientation="right" tick={{ fontSize: 11, fill: 'var(--text-mute)' }} stroke="var(--line)" />
                <Tooltip contentStyle={{ background: 'var(--surface-solid)', border: '1px solid var(--line)', borderRadius: 4, fontSize: 12 }} />
                <Line yAxisId="w" type="monotone" dataKey="weight" stroke="var(--accent-bright)" strokeWidth={2} dot={false} name={t('Weight')} />
                <Line yAxisId="bf" type="monotone" dataKey="bf" stroke="var(--patina, #789081)" strokeWidth={2} dot={false} name={t('Body fat %')} strokeDasharray="4 3" />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <p className="muted tiny">{t('Log at least two check-ins to see a trend.')}</p>
          )}
        </div>

        {/* Pose readiness */}
        <div className="card">
          <p className="kicker" style={{ marginBottom: 14 }}>{t('Pose readiness')}</p>
          {(() => {
            const shot = new Set(media.map((m) => m.pose_type).filter(Boolean));
            const all = posesForCategory(current.category);
            const covered = all.filter((p) => shot.has(p.id)).length;
            return (
              <p className="tiny muted" style={{ marginBottom: 12 }}>
                {fill(t('{count} mandatories photographed'), {
                  count: (
                    <b style={{ color: covered === all.length ? 'var(--good)' : 'var(--text-dim)' }}>
                      {t('{covered} of {total}', { covered: fmt.number(covered, 0), total: fmt.number(all.length, 0) })}
                    </b>
                  ),
                })}
                {covered < all.length && (
                  <> — <Link to="/mirror">{t('practice the rest in the Mirror →')}</Link></>
                )}
              </p>
            );
          })()}
          {poseScores.some((p) => p.score != null) ? (
            <>
              {poseScores.map((p) => (
                <ScoreBar key={p.pose.id} label={p.pose.label} value={p.score} />
              ))}
              {focus && (
                <div className="banner" style={{ marginTop: 14 }}>
                  {fill(t('Focus next: {pose} — your lowest geometric form score.'), { pose: <b>{poseLabel(focus.pose.id)}</b> })}{' '}
                  <Link to={`/pose?pose=${focus.pose.id}`}>{t('Open in Pose Studio →')}</Link>
                </div>
              )}
            </>
          ) : (
            <p className="muted tiny">
              {fill(t('No analyzed poses yet. {upload}, then run analysis in {studio}.'), {
                upload: <Link to="/capture">{t('Upload pose photos')}</Link>,
                studio: <Link to="/pose">{t('Pose Studio')}</Link>,
              })}
            </p>
          )}
        </div>
      </div>

      {/* Recent captures */}
      <div className="card" style={{ marginTop: 22 }}>
        <div className="row spread" style={{ marginBottom: 14 }}>
          <p className="kicker">{t('Recent captures')}</p>
          <Link to="/capture" className="btn sm"><Icon name="plus" size={13} /> {t('Add')}</Link>
        </div>
        {media.length ? (
          <div className="media-grid">
            {media.slice(-8).reverse().map((m) => (
              <Link key={m.id} to={`/pose?pose=${m.pose_type ?? ''}`} className="thumb">
                {m.thumb_url ? <img src={m.thumb_url} alt="" /> : <div style={{ display: 'grid', placeItems: 'center', height: '100%' }}><Icon name="timelapse" size={28} /></div>}
                {m.kind === 'video' && <span className="badge">{t('video')}</span>}
                <span className="meta">{poseLabel(m.pose_type)} · {shortDate(m.captured_at)}</span>
              </Link>
            ))}
          </div>
        ) : (
          <EmptyState title={t('No captures yet')}>
            {fill(t('Head to {capture} to add current or historical photos and videos.'), { capture: <Link to="/capture">{t('Capture')}</Link> })}
          </EmptyState>
        )}
      </div>
      {loading && <p className="muted tiny" style={{ marginTop: 16 }}>{t('Loading…')}</p>}

      <Appearance />

      <div style={{ marginTop: 24 }}>
        <h3>{t('Coach · folder cowork')}</h3>
        <p className="muted tiny" style={{ marginBottom: 10 }}>
          {t('Hand the numbers — body comp and pose scores, never photos — to an agent through a folder (CoworkSyncHub, Claude Desktop, or a person). The reply shows here. Nothing is uploaded.')}
        </p>
        <div ref={coworkHost} />
        {coachReply && <pre className="card" data-clamp="" style={{ whiteSpace: 'pre-wrap', marginTop: 10, font: 'inherit', fontSize: 13 }}>{coachReply}</pre>}
      </div>
    </div>
  );
}

/** Font and theme, reachable before any athlete exists. */
function Appearance() {
  return (
    <div style={{ marginTop: 24 }}>
      <h3>{t('Font')}</h3>
      {/* shared picker from https://adervec.github.io/font.js; the choice applies to every app by this maker */}
      {createElement('app-font-picker')}
      <div style={{ marginTop: 12 }}>
        {/* shared theme list (font.js) plus this app's Ink and Marble; the choice is kept per app */}
        {createElement('app-theme-picker', { label: t('Theme') })}
      </div>
    </div>
  );
}

function Kpi({ label, value, unit, children }: { label: string; value: string; unit?: string; children?: React.ReactNode }) {
  return (
    <div className="card stat">
      <div className="num" style={{ color: value === '—' ? 'var(--text-mute)' : undefined }}>
        {value}
        {unit && <span style={{ fontSize: 15, color: 'var(--text-dim)', marginInlineStart: 6, fontFamily: 'var(--mono)' }}>{unit}</span>}
      </div>
      <div className="lab">{label}</div>
      {children && <div style={{ marginTop: 8 }}>{children}</div>}
    </div>
  );
}
