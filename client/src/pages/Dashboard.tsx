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
import { COACH_REPLY_KEY } from '../lib/coachChannel';
import { mountCowork } from '../lib/coworkSetup';
import { setCoworkPanel } from '../lib/coworkQueue';
import { latestCheckinReview, type CheckinReview } from '../lib/checkinReview';
import { reviewFor } from '../lib/poseReview';
import { photosEnabled, setPhotosEnabled, engineTakesPhotos } from '../lib/coworkPhotos';
import { t, fmt } from '../lib/i18n';

/** Put React nodes into a translated sentence at its {placeholders} (so markup never splits a sentence). */
function fill(text: string, parts: Record<string, React.ReactNode>): React.ReactNode[] {
  return text.split(/(\{\w+\})/).map((bit, i) => {
    const k = bit.slice(1, -1);
    return bit.startsWith('{') && k in parts ? <span key={i}>{parts[k]}</span> : bit;
  });
}


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

  // The shared cowork panel (lib/coworkSetup.ts); it reads the athlete through a ref, so never goes stale.
  const coworkHost = useRef<HTMLDivElement>(null);
  const athleteRef = useRef(current);
  athleteRef.current = current;
  const [coachReply, setCoachReply] = useState(() => {
    try { return localStorage.getItem(COACH_REPLY_KEY) || ''; } catch { return ''; }
  });
  useEffect(() => {
    const host = coworkHost.current;
    if (!host) return;
    void mountCowork(host, () => athleteRef.current, setCoachReply);
    return () => { setCoworkPanel(null); host.replaceChildren(); };
  }, []);

  // The AI's read of the latest check-in leads the page when there is one.
  const [reviewTick, setReviewTick] = useState(0);
  useEffect(() => {
    const bump = () => setReviewTick((n) => n + 1);
    for (const e of ['bpc-checkin-reviews', 'bpc-pose-reviews', 'storage']) window.addEventListener(e, bump);
    return () => { for (const e of ['bpc-checkin-reviews', 'bpc-pose-reviews', 'storage']) window.removeEventListener(e, bump); };
  }, []);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const checkin = useMemo(() => latestCheckinReview(current?.name), [current, reviewTick]);

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
    // the AI judge's grade of the newest photo of each pose, when it has one
    const newest = new Map<string, MediaAsset>();
    for (const m of media) if (m.kind === 'photo' && m.pose_type && (!newest.get(m.pose_type) || m.captured_at >= newest.get(m.pose_type)!.captured_at)) newest.set(m.pose_type, m);
    return posesForCategory(current.category).map((p) => ({
      pose: p,
      score: byPose.get(p.id)?.form_score ?? null,
      grade: reviewFor(newest.get(p.id)?.file_name)?.grade ?? null,
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [analyses, media, current, reviewTick]);

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

      {checkin ? (
        <CheckinCard day={checkin.day} r={checkin.review} />
      ) : (
        <div className="banner" style={{ marginBottom: 26 }}>
          <b>{t('Honest & fair by design.')}</b>{' '}
          {t('Your cowork agent reads your posing photos the way a judge would: muscularity, conditioning, symmetry, proportion and presentation, and what changed since last time. Underneath, the app measures reproducible geometry (left/right balance and proportions) as an objective check.')}
        </div>
      )}

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
          {poseScores.some((p) => p.score != null || p.grade) ? (
            <>
              {poseScores.map((p) => (
                <ScoreBar key={p.pose.id} label={p.grade ? t('{pose} · AI grade {grade}', { pose: p.pose.label, grade: p.grade }) : p.pose.label} value={p.score} />
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
        <h3>{t('AI judge & coach · folder cowork')}</h3>
        <p className="muted tiny" style={{ marginBottom: 10 }}>
          {t('An agent you choose (Claude Desktop, CoworkSyncHub, or a person) works through a folder you pick: it judges each posing photo, reviews each check-in against your earlier photos, and coaches from the trend. You approve each reply before it is added, and can undo it. This app uploads nothing itself.')}
        </p>
        <PhotoSwitch />
        <div ref={coworkHost} />
        {coachReply && <pre className="card" data-clamp="" style={{ whiteSpace: 'pre-wrap', marginTop: 10, font: 'inherit', fontSize: 13 }}>{coachReply}</pre>}
      </div>
    </div>
  );
}

/** Whether posing photos go into the cowork folder (on by default). */
function PhotoSwitch() {
  const [on, setOn] = useState(photosEnabled);
  return (
    <div className="card" style={{ marginBottom: 12, padding: '14px 18px' }}>
      <label className="row" style={{ gap: 10, cursor: 'pointer', alignItems: 'flex-start' }}>
        <input type="checkbox" checked={on} style={{ width: 'auto', marginTop: 4 }} onChange={(e) => { setOn(e.target.checked); setPhotosEnabled(e.target.checked); }} />
        <span>
          <b>{t('Send my posing photos to the cowork folder')}</b>
          <span className="tiny muted" style={{ display: 'block', marginTop: 4 }}>
            {on
              ? t('The agent sees the photos, downsized to 1600 px with location and camera details removed. If the folder is synced (Google Drive, Dropbox, OneDrive), the photos go to that service too. Turn this off and the agent works from the numbers only.')
              : t('Off: the agent gets the numbers only (measurements, geometry scores and body landmarks), which cannot show muscle or conditioning.')}
          </span>
          {on && !engineTakesPhotos() && (
            <span className="tiny" style={{ display: 'block', marginTop: 6, color: 'var(--warn)' }}>
              {t('Waiting for the shared cowork panel to be updated: until then requests carry the numbers only.')}
            </span>
          )}
        </span>
      </label>
    </div>
  );
}

/** The AI's read of the latest check-in: leads the Dashboard when there is one. */
function CheckinCard({ day, r }: { day: string; r: CheckinReview }) {
  const trend: Record<string, string> = { improving: t('improving'), steady: t('steady'), declining: t('declining') };
  return (
    <div className="card" style={{ marginBottom: 26 }}>
      <div className="row spread wrap" style={{ marginBottom: 10 }}>
        <p className="kicker"><Icon name="ai" size={12} /> {t('Check-in review · {date}', { date: formatDate(day) })}</p>
        <span className="pill solid">{t('grade {grade}', { grade: r.grade })}</span>
      </div>
      <div className="row wrap" style={{ gap: 18, marginBottom: 12 }}>
        {r.bodyFat && <Kv k={t('Body fat (visual)')} v={r.bodyFat} />}
        {r.conditioning && <Kv k={t('Conditioning')} v={trend[r.conditioning]} />}
        {r.improved.length > 0 && <Kv k={t('Improved')} v={r.improved.join(', ')} />}
        {r.lagging.length > 0 && <Kv k={t('Lagging')} v={r.lagging.join(', ')} />}
      </div>
      <div data-clamp="6">
        <p style={{ color: 'var(--text-dim)', fontSize: 14 }}>{r.summary}</p>
        {r.fixes.length > 0 && (
          <ul className="tiny" style={{ marginTop: 8, paddingInlineStart: 18, color: 'var(--text-dim)' }}>
            {r.fixes.map((f, i) => <li key={i}>{f}</li>)}
          </ul>
        )}
        {r.next && <p className="tiny" style={{ marginTop: 8 }}><b>{t('Next:')}</b> {r.next}</p>}
      </div>
      {!r.fromPhoto && <p className="tiny muted" style={{ marginTop: 8 }}>{t('Read from the numbers only: no photos went with this request.')}</p>}
    </div>
  );
}

function Kv({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <div className="tiny" style={{ color: 'var(--text-mute)', fontFamily: 'var(--mono)', letterSpacing: '0.12em', textTransform: 'uppercase', fontSize: 10 }}>{k}</div>
      <div style={{ fontSize: 15 }}>{v}</div>
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
