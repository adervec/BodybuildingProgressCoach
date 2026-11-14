import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../state/store';
import { api, thumbSrc } from '../api';
import { CATEGORIES, categoryLabel, themeFor } from '../lib/poses';
import type { Category } from '../lib/types';
import { PageHead } from '../components/Layout';
import { Icon } from '../components/Icon';
import { t } from '../lib/i18n';

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
      toast(t('Created {name}', { name: a.name }));
      navigate('/');
    } catch (err) {
      toast((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: number, n: string) {
    if (!confirm(t('Delete {name} and all their photos, analyses and measurements? This cannot be undone.', { name: n }))) return;
    await api.athletes.remove(id);
    const list = await refreshAthletes();
    if (current?.id === id) selectAthlete(list[0]?.id ?? null);
    toast(t('Deleted {name}', { name: n }));
  }

  return (
    <div>
      <PageHead
        kicker={t('Profiles')}
        title={t('Athletes')}
        lede={t("Each athlete has their own gallery, analyses and measurements. The interface reskins to the division — bronze-on-ink for the men's stage, gold-on-marble for the women's.")}
      />

      <div className="cards-grid" style={{ marginBottom: 34 }}>
        {athletes.map((a) => (
          <div key={a.id} className="plate hoverable" style={{ padding: 20 }} data-theme={themeFor(a.category)}>
            <div className="row" style={{ alignItems: 'flex-start' }}>
              <div className="avatar" style={{ width: 50, height: 50 }}>
                {a.latest_thumb ? <img src={thumbSrc(a.latest_thumb)} alt="" /> : a.name[0]?.toUpperCase()}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="display" style={{ fontSize: 21 }}>{a.name}</div>
                <div className="cat kicker" style={{ fontSize: 9.5 }}>{categoryLabel(a.category)}</div>
              </div>
            </div>
            <div className="row tiny muted" style={{ marginTop: 14, gap: 18, fontFamily: 'var(--mono)' }}>
              <span>{t.n('{n} media', '{n} media', a.media_count ?? 0)}</span>
              <span>{t.n('{n} check-in', '{n} check-ins', a.comp_count ?? 0)}</span>
            </div>
            <div className="row" style={{ marginTop: 16, gap: 8 }}>
              <button
                className="btn sm primary"
                onClick={() => {
                  selectAthlete(a.id);
                  navigate('/');
                }}
              >
                {t('Open')}
              </button>
              <button className="btn sm danger" onClick={() => remove(a.id, a.name)} aria-label={t('Delete')}>
                <Icon name="trash" size={14} />
              </button>
            </div>
          </div>
        ))}
        {athletes.length === 0 && <p className="muted">{t('No athletes yet — create your first profile below.')}</p>}
      </div>

      <div className="card" style={{ maxWidth: 540 }}>
        <p className="kicker" style={{ marginBottom: 16 }}>{t('New athlete')}</p>
        <form onSubmit={create}>
          <label className="field">
            <span className="lab">{t('Name')}</span>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder={t('e.g. Alex Rivera')} />
          </label>
          <label className="field">
            <span className="lab">{t('Division / Category')}</span>
            <select value={category} onChange={(e) => setCategory(e.target.value as Category)}>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {categoryLabel(c)}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span className="lab">{t('Height (cm, optional)')}</span>
            <input value={height} onChange={(e) => setHeight(e.target.value)} type="number" placeholder="178" />
          </label>
          <button className="btn primary" disabled={busy || !name.trim()}>
            <Icon name="plus" size={14} /> {busy ? t('Creating…') : t('Create athlete')}
          </button>
        </form>
      </div>
    </div>
  );
}
