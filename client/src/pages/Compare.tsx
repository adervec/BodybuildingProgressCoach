import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useApp } from '../state/store';
import { api } from '../api';
import type { MediaAsset, PoseAnalysis } from '../lib/types';
import { posesForCategory, findPose } from '../lib/poses';
import { PageHead, EmptyState } from '../components/Layout';
import { LandmarkCanvas } from '../components/LandmarkCanvas';
import { Delta } from '../components/Score';
import { formatDate, daysBetween, scoreColor } from '../lib/format';

export function Compare() {
  const { current } = useApp();
  const poses = current ? posesForCategory(current.category) : [];
  const [params, setParams] = useSearchParams();
  const poseId = params.get('pose') || poses[0]?.id || '';
  const pose = findPose(poseId);

  const [media, setMedia] = useState<MediaAsset[]>([]);
  const [aId, setAId] = useState<number | null>(null);
  const [bId, setBId] = useState<number | null>(null);
  const [aFull, setAFull] = useState<MediaAsset | null>(null);
  const [bFull, setBFull] = useState<MediaAsset | null>(null);

  useEffect(() => {
    if (!current || !poseId) return;
    api.media.list(current.id, { pose_type: poseId, kind: 'photo' }).then((list) => {
      setMedia(list);
      setAId(list[0]?.id ?? null);
      setBId(list.at(-1)?.id ?? null);
    });
  }, [current, poseId]);

  useEffect(() => {
    if (aId) api.media.get(aId).then(setAFull);
  }, [aId]);
  useEffect(() => {
    if (bId) api.media.get(bId).then(setBFull);
  }, [bId]);

  const geo = (m: MediaAsset | null): PoseAnalysis | undefined => m?.analyses?.find((a) => a.source === 'geometry');
  const gA = geo(aFull);
  const gB = geo(bFull);

  const span = useMemo(() => {
    if (aFull && bFull) return daysBetween(aFull.captured_at, bFull.captured_at);
    return null;
  }, [aFull, bFull]);

  if (!current)
    return (
      <div>
        <PageHead title="Compare" lede="Select an athlete first." />
        <Link to="/athletes" className="btn primary">Go to athletes</Link>
      </div>
    );

  return (
    <div>
      <PageHead kicker="Compare" title="Side by side" lede="Hold two dates of the same pose against each other — the numbers move with the picture." />

      <div className="row wrap" style={{ gap: 8, marginBottom: 20 }}>
        {poses.map((p) => (
          <button key={p.id} className={`btn sm ${p.id === poseId ? 'primary' : ''}`} onClick={() => setParams({ pose: p.id })}>
            {p.label}
          </button>
        ))}
      </div>

      {media.length < 2 ? (
        <EmptyState title="Need at least two photos">
          Add two or more {pose?.label} photos in <Link to="/capture">Capture</Link> (taken on different dates) to compare them.
        </EmptyState>
      ) : (
        <div className="grid" style={{ gridTemplateColumns: '1fr 120px 1fr', gap: 20, alignItems: 'start' }}>
          <Side label="Before" media={media} selId={aId} onSelect={setAId} full={aFull} g={gA} />

          {/* delta column */}
          <div className="card" style={{ textAlign: 'center' }}>
            <p className="kicker" style={{ marginBottom: 10 }}>Change</p>
            {span != null && <p className="tiny muted" style={{ marginBottom: 12 }}>{Math.abs(span)} days</p>}
            <DeltaRow label="Form" a={gA?.form_score} b={gB?.form_score} />
            <DeltaRow label="Symmetry" a={gA?.symmetry_score} b={gB?.symmetry_score} />
            <DeltaRow label="Ref-form" a={gA?.ref_match_score} b={gB?.ref_match_score} />
            <DeltaRow label="Sh:waist" a={gA?.metrics?.vTaper} b={gB?.metrics?.vTaper} digits={2} />
            {(!gA || !gB) && <p className="tiny muted" style={{ marginTop: 10 }}>Analyze both photos in Pose Studio for full deltas.</p>}
          </div>

          <Side label="After" media={media} selId={bId} onSelect={setBId} full={bFull} g={gB} />
        </div>
      )}
    </div>
  );
}

function Side({
  label,
  media,
  selId,
  onSelect,
  full,
  g,
}: {
  label: string;
  media: MediaAsset[];
  selId: number | null;
  onSelect: (id: number) => void;
  full: MediaAsset | null;
  g?: PoseAnalysis;
}) {
  return (
    <div className="card">
      <div className="row spread" style={{ marginBottom: 10 }}>
        <p className="kicker">{label}</p>
        <select value={selId ?? ''} onChange={(e) => onSelect(Number(e.target.value))} style={{ width: 'auto' }}>
          {media.map((m) => (
            <option key={m.id} value={m.id}>
              {formatDate(m.captured_at)}
            </option>
          ))}
        </select>
      </div>
      {full && <LandmarkCanvas imageUrl={full.url} landmarks={g?.landmarks ?? null} height={420} />}
      <div className="row" style={{ gap: 18, marginTop: 12, fontFamily: 'var(--mono)' }}>
        <Stat label="Form" value={g?.form_score} />
        <Stat label="Sym" value={g?.symmetry_score} />
        <Stat label="Sh:waist" value={g?.metrics?.vTaper} digits={2} />
      </div>
    </div>
  );
}

function Stat({ label, value, digits = 0 }: { label: string; value: number | null | undefined; digits?: number }) {
  return (
    <div>
      <div style={{ fontFamily: 'var(--display)', fontSize: 22, color: digits === 0 ? scoreColor(value ?? null) : 'var(--text)' }}>
        {value == null ? '—' : value.toFixed(digits)}
      </div>
      <div className="tiny" style={{ color: 'var(--text-mute)' }}>{label}</div>
    </div>
  );
}

function DeltaRow({ label, a, b, digits = 0 }: { label: string; a: number | null | undefined; b: number | null | undefined; digits?: number }) {
  const d = a != null && b != null ? b - a : null;
  return (
    <div className="row spread" style={{ marginBottom: 8 }}>
      <span className="tiny mono" style={{ color: 'var(--text-dim)' }}>{label}</span>
      <Delta value={d == null ? null : Number(d.toFixed(digits || 1))} />
    </div>
  );
}
