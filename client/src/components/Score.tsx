import { scoreColor, scoreWord } from '../lib/format';
import { t, fmt } from '../lib/i18n';

export function ScoreBar({ label, value, hint }: { label: string; value: number | null; hint?: string }) {
  const v = value == null ? 0 : value;
  return (
    <div className="scorebar-row" title={hint}>
      <span className="lab">{label}</span>
      <div className="meter">
        <span style={{ width: `${v}%`, background: value == null ? 'var(--line)' : undefined }} />
      </div>
      <span className="val" style={{ color: scoreColor(value) }}>
        {value == null ? '—' : fmt.number(Math.round(value), 0)}
      </span>
    </div>
  );
}

export function BigScore({ value, caption }: { value: number | null; caption?: string }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div className="display" style={{ fontSize: 72, lineHeight: 1, color: scoreColor(value) }}>
        {value == null ? '—' : fmt.number(Math.round(value), 0)}
      </div>
      <div className="kicker" style={{ marginTop: 8 }}>
        {caption ?? scoreWord(value)}
      </div>
    </div>
  );
}

export function Delta({ value, unit = '', invert = false }: { value: number | null; unit?: string; invert?: boolean }) {
  if (value == null || Number.isNaN(value)) return <span className="muted tiny">—</span>;
  const positive = value > 0;
  const good = invert ? !positive : positive;
  if (Math.abs(value) < 0.05) return <span className="muted tiny">{t('no change')}</span>;
  return (
    <span className={good ? 'delta-up' : 'delta-down'} style={{ fontFamily: 'var(--mono)', fontSize: 12 }}>
      {positive ? '▲' : '▼'} {fmt.fixed(Math.abs(value), 1)}
      {unit}
    </span>
  );
}
