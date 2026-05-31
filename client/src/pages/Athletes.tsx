import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../state/store';
import { api } from '../api';
import { CATEGORIES, categoryLabel, themeFor } from '../lib/poses';
import type { Category } from '../lib/types';
import { PageHead } from '../components/Layout';
import { Icon } from '../components/Icon';

export function Athletes() {
  const { athletes, refreshAthletes, selectAthlete, current, toast } = useApp();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [category, setCategory] = useState<Category>('men_bodybuilding');
  const [height, setHeight] = useState('');
  const [busy, setBusy] = useState(false);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    try {
      const a = await api.athletes.create({ name: name.trim(), category, height_cm: height ? Number(height) : null });
      await refreshAthletes();
      selectAthlete(a.id);
      setName('');
      setHeight('');
      toast(`Created ${a.name}`);
      navigate('/');
    } catch (err) {
      toast((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: number, n: string) {
    if (!confirm(`Delete ${n} and all their photos, analyses and measurements? This cannot be undone.`)) return;
    await api.athletes.remove(id);
    const list = await refreshAthletes();
    if (current?.id === id) selectAthlete(list[0]?.id ?? null);
    toast(`Deleted ${n}`);
  }

  return (
    <div>
      <PageHead
        kicker="Profiles"
        title="Athletes"
        lede="Each athlete has their own gallery, analyses and measurements. The interface reskins to the division — bronze-on-ink for the men's stage, gold-on-marble for the women's."
      />

      <div className="cards-grid" style={{ marginBottom: 34 }}>
        {athletes.map((a) => (
          <div key={a.id} className="plate hoverable" style={{ padding: 20 }} data-theme={themeFor(a.category)}>
            <div className="row" style={{ alignItems: 'flex-start' }}>
              <div className="avatar" style={{ width: 50, height: 50 }}>
                {a.latest_thumb ? <img src={`/thumbs/${a.latest_thumb}`} alt="" /> : a.name[0]?.toUpperCase()}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="display" style={{ fontSize: 21 }}>{a.name}</div>
                <div className="cat kicker" style={{ fontSize: 9.5 }}>{categoryLabel(a.category)}</div>
              </div>
            </div>
            <div className="row tiny muted" style={{ marginTop: 14, gap: 18, fontFamily: 'var(--mono)' }}>
              <span>{a.media_count ?? 0} media</span>
              <span>{a.comp_count ?? 0} check-ins</span>
            </div>
            <div className="row" style={{ marginTop: 16, gap: 8 }}>
              <button
                className="btn sm primary"
                onClick={() => {
                  selectAthlete(a.id);
                  navigate('/');
                }}
              >
                Open
              </button>
              <button className="btn sm danger" onClick={() => remove(a.id, a.name)} aria-label="Delete">
                <Icon name="trash" size={14} />
              </button>
            </div>
          </div>
        ))}
        {athletes.length === 0 && <p className="muted">No athletes yet — create your first profile below.</p>}
      </div>

      <div className="card" style={{ maxWidth: 540 }}>
        <p className="kicker" style={{ marginBottom: 16 }}>New athlete</p>
        <form onSubmit={create}>
          <label className="field">
            <span className="lab">Name</span>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Alex Rivera" />
          </label>
          <label className="field">
            <span className="lab">Division / Category</span>
            <select value={category} onChange={(e) => setCategory(e.target.value as Category)}>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {categoryLabel(c)}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span className="lab">Height (cm, optional)</span>
            <input value={height} onChange={(e) => setHeight(e.target.value)} type="number" placeholder="178" />
          </label>
          <button className="btn primary" disabled={busy || !name.trim()}>
            <Icon name="plus" size={14} /> {busy ? 'Creating…' : 'Create athlete'}
          </button>
        </form>
      </div>
    </div>
  );
}
