import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';
import { useApp } from '../state/store';
import { api } from '../api';
import type { BodyComp } from '../lib/types';
import { PageHead } from '../components/Layout';
import { Icon } from '../components/Icon';
import { MEASUREMENT_FIELDS, shortDate, formatDate, todayISO } from '../lib/format';

export function Physique() {
  const { current, toast, refreshAthletes } = useApp();
  const [entries, setEntries] = useState<BodyComp[]>([]);
  const [date, setDate] = useState(todayISO());
  const [weight, setWeight] = useState('');
  const [unit, setUnit] = useState('kg');
  const [bf, setBf] = useState('');
  const [meas, setMeas] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  const reload = () => current && api.bodycomp.list(current.id).then(setEntries);
  useEffect(() => {
    reload();
  }, [current]);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!current) return;
    setBusy(true);
    try {
      const measurements: Record<string, number> = {};
      for (const f of MEASUREMENT_FIELDS) if (meas[f.key]) measurements[f.key] = Number(meas[f.key]);
      const w = weight ? Number(weight) : null;
      const bfv = bf ? Number(bf) : null;
      const lean = w != null && bfv != null ? Math.round(w * (1 - bfv / 100) * 10) / 10 : null;
      await api.bodycomp.create(current.id, {
        measured_at: date,
        weight: w,
        weight_unit: unit,
        body_fat_pct: bfv,
        lean_mass: lean,
        measurements,
        source: 'manual',
      });
      toast('Check-in logged');
      setWeight('');
      setBf('');
      setMeas({});
      await reload();
      await refreshAthletes();
    } catch (err) {
      toast((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function del(id: number) {
    if (!confirm('Delete this check-in?')) return;
    await api.bodycomp.remove(id);
    await reload();
    await refreshAthletes();
  }

  const chart = useMemo(
    () =>
      entries.map((e) => ({
        date: shortDate(e.measured_at),
        weight: e.weight,
        bf: e.body_fat_pct,
        lean: e.lean_mass,
        chest: e.measurements?.chest,
        waist: e.measurements?.waist,
        arm: e.measurements?.arm_r ?? e.measurements?.arm_l,
      })),
    [entries]
  );

  if (!current)
    return (
      <div>
        <PageHead title="Physique" lede="Select an athlete first." />
        <Link to="/athletes" className="btn primary">Go to athletes</Link>
      </div>
    );

  return (
    <div>
      <PageHead
        kicker="Physique"
        title="Body composition"
        lede="Corroborate what the camera shows with the numbers. Manual entry now; smart-scale import is wired into the same schema for later."
      />

      <div className="grid" style={{ gridTemplateColumns: '360px 1fr', gap: 24, alignItems: 'start' }}>
        <form className="card" onSubmit={add}>
          <p className="kicker" style={{ marginBottom: 14 }}>New check-in</p>
          <label className="field">
            <span className="lab">Date</span>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </label>
          <div className="row" style={{ gap: 10 }}>
            <label className="field" style={{ flex: 2 }}>
              <span className="lab">Weight</span>
              <input type="number" step="0.1" value={weight} onChange={(e) => setWeight(e.target.value)} />
            </label>
            <label className="field" style={{ flex: 1 }}>
              <span className="lab">Unit</span>
              <select value={unit} onChange={(e) => setUnit(e.target.value)}>
                <option value="kg">kg</option>
                <option value="lb">lb</option>
              </select>
            </label>
          </div>
          <label className="field">
            <span className="lab">Body fat %</span>
            <input type="number" step="0.1" value={bf} onChange={(e) => setBf(e.target.value)} placeholder="optional" />
          </label>
          <p className="kicker" style={{ margin: '8px 0 8px' }}>Measurements (cm)</p>
          <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {MEASUREMENT_FIELDS.map((f) => (
              <label className="field" key={f.key} style={{ marginBottom: 6 }}>
                <span className="lab">{f.label}</span>
                <input
                  type="number"
                  step="0.1"
                  value={meas[f.key] ?? ''}
                  onChange={(e) => setMeas((m) => ({ ...m, [f.key]: e.target.value }))}
                />
              </label>
            ))}
          </div>
          <button className="btn primary" disabled={busy} style={{ marginTop: 8 }}>
            <Icon name="plus" size={14} /> {busy ? 'Saving…' : 'Log check-in'}
          </button>
        </form>

        <div className="stack">
          <div className="card">
            <p className="kicker" style={{ marginBottom: 12 }}>Weight &amp; body fat</p>
            {chart.length > 1 ? (
              <ResponsiveContainer width="100%" height={240}>
                <LineChart data={chart} margin={{ top: 6, right: 10, left: -16, bottom: 0 }}>
                  <CartesianGrid stroke="var(--line-soft)" vertical={false} />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: 'var(--text-mute)' }} stroke="var(--line)" />
                  <YAxis yAxisId="w" tick={{ fontSize: 11, fill: 'var(--text-mute)' }} stroke="var(--line)" />
                  <YAxis yAxisId="bf" orientation="right" tick={{ fontSize: 11, fill: 'var(--text-mute)' }} stroke="var(--line)" />
                  <Tooltip contentStyle={{ background: 'var(--surface-solid)', border: '1px solid var(--line)', borderRadius: 4, fontSize: 12 }} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Line yAxisId="w" type="monotone" dataKey="weight" name="Weight" stroke="var(--accent-bright)" strokeWidth={2} dot={false} />
                  <Line yAxisId="w" type="monotone" dataKey="lean" name="Lean" stroke="var(--good)" strokeWidth={2} dot={false} />
                  <Line yAxisId="bf" type="monotone" dataKey="bf" name="Body fat %" stroke="var(--warn)" strokeWidth={2} dot={false} strokeDasharray="4 3" />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <p className="muted tiny">Add at least two check-ins to chart a trend.</p>
            )}
          </div>

          <div className="card">
            <p className="kicker" style={{ marginBottom: 12 }}>Measurements</p>
            {chart.some((c) => c.chest || c.waist || c.arm) ? (
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={chart} margin={{ top: 6, right: 10, left: -16, bottom: 0 }}>
                  <CartesianGrid stroke="var(--line-soft)" vertical={false} />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: 'var(--text-mute)' }} stroke="var(--line)" />
                  <YAxis tick={{ fontSize: 11, fill: 'var(--text-mute)' }} stroke="var(--line)" />
                  <Tooltip contentStyle={{ background: 'var(--surface-solid)', border: '1px solid var(--line)', borderRadius: 4, fontSize: 12 }} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Line type="monotone" dataKey="chest" name="Chest" stroke="var(--accent-bright)" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="waist" name="Waist" stroke="var(--bad)" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="arm" name="Arm" stroke="var(--good)" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <p className="muted tiny">Add measurements to chart them.</p>
            )}
          </div>

          <div className="card">
            <p className="kicker" style={{ marginBottom: 8 }}>History</p>
            <div style={{ overflowX: 'auto' }}>
              <table className="data">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Weight</th>
                    <th>BF%</th>
                    <th>Lean</th>
                    <th>Waist</th>
                    <th>Source</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {[...entries].reverse().map((e) => (
                    <tr key={e.id}>
                      <td>{formatDate(e.measured_at)}</td>
                      <td>{e.weight != null ? `${e.weight} ${e.weight_unit}` : '—'}</td>
                      <td>{e.body_fat_pct ?? '—'}</td>
                      <td>{e.lean_mass ?? '—'}</td>
                      <td>{e.measurements?.waist ?? '—'}</td>
                      <td><span className="pill" style={{ fontSize: 9 }}>{e.source}</span></td>
                      <td>
                        <button className="btn sm danger" style={{ padding: 4 }} onClick={() => del(e.id)}>
                          <Icon name="trash" size={12} />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {entries.length === 0 && (
                    <tr>
                      <td colSpan={7} className="muted">No check-ins yet.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
