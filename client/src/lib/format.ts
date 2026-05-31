export const round = (n: number, d = 1): number => {
  const f = 10 ** d;
  return Math.round(n * f) / f;
};

export const clamp = (n: number, lo = 0, hi = 100): number => Math.min(hi, Math.max(lo, n));

export const kgToLb = (kg: number): number => kg * 2.2046226218;
export const lbToKg = (lb: number): number => lb / 2.2046226218;
export const cmToIn = (cm: number): number => cm / 2.54;

export function formatDate(iso: string | undefined | null): string {
  if (!iso) return '—';
  const d = new Date(iso.length <= 10 ? `${iso}T00:00:00` : iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

export function shortDate(iso: string | undefined | null): string {
  if (!iso) return '—';
  const d = new Date(iso.length <= 10 ? `${iso}T00:00:00` : iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export function daysBetween(a: string, b: string): number {
  const da = new Date(`${a}T00:00:00`).getTime();
  const db = new Date(`${b}T00:00:00`).getTime();
  return Math.round((db - da) / 86_400_000);
}

/** Map a 0–100 score to a CSS color var. */
export function scoreColor(score: number | null | undefined): string {
  if (score == null) return 'var(--text-mute)';
  if (score >= 80) return 'var(--good)';
  if (score >= 60) return 'var(--accent-bright)';
  if (score >= 40) return 'var(--warn)';
  return 'var(--bad)';
}

export function scoreWord(score: number | null | undefined): string {
  if (score == null) return 'n/a';
  if (score >= 85) return 'Excellent';
  if (score >= 70) return 'Strong';
  if (score >= 55) return 'Developing';
  if (score >= 40) return 'Needs work';
  return 'Early';
}

export const MEASUREMENT_FIELDS: { key: string; label: string }[] = [
  { key: 'chest', label: 'Chest' },
  { key: 'waist', label: 'Waist' },
  { key: 'hips', label: 'Hips' },
  { key: 'arm_l', label: 'Arm (L)' },
  { key: 'arm_r', label: 'Arm (R)' },
  { key: 'thigh_l', label: 'Thigh (L)' },
  { key: 'thigh_r', label: 'Thigh (R)' },
  { key: 'calf', label: 'Calf' },
];
