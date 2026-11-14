/**
 * House standard 20. English is written straight into the code — `t('Saved {n} photos', { n })`,
 * plurals with `t.n('{n} photo', '{n} photos', count)` — and font.js swaps in the chosen language
 * from client/public/locales/<lang>.json (machine translated, and the app says so). The English IS
 * the key. Outside a browser (tests) or before font.js loads, the English is used as written.
 *
 * Numbers, dates and weights the reader sees go through `fmt` (appFont.fmt: the shared language,
 * units, week start and clock), never toFixed or toLocaleString with a hard-coded locale.
 */
type Params = Record<string, string | number>;
interface Fmt {
  number(n: number, o?: { max?: number; min?: number }): string;
  percent(x: number, max?: number): string;
  date(d: Date | string | number, style?: 'full' | 'long' | 'medium' | 'short'): string;
  dateTime(d: Date | string | number, style?: 'full' | 'long' | 'medium' | 'short'): string;
  custom(d: Date | string | number, opts: Intl.DateTimeFormatOptions): string;
  unit(value: number, unit: string, max?: number): string;
  weight(kg: number, max?: number): string;
}
type House = {
  t?: ((k: string, p?: Params) => string) & { n(one: string, other: string, n: number, p?: Params): string };
  fmt?: Fmt;
  ready?: Promise<unknown>;
  units?: () => 'metric' | 'imperial';
};
const house = (): House => (typeof window !== 'undefined' ? ((window as unknown as { appFont?: House }).appFont ?? {}) : {});

const interp = (s: string, p?: Params) =>
  p ? s.replace(/\{(\w+)\}/g, (m, k) => (Object.prototype.hasOwnProperty.call(p, k) ? String(p[k]) : m)) : s;

export function t(key: string, params?: Params): string {
  const h = house().t;
  return h ? h(key, params) : interp(key, params);
}
t.n = (one: string, other: string, n: number, params?: Params): string => {
  const h = house().t;
  return h ? h.n(one, other, n, params) : interp(n === 1 ? one : other, { n: fmtNumber(n), ...params });
};

function fmtNumber(n: number, max = 2) {
  const f = house().fmt;
  return f ? f.number(n, { max }) : String(Math.round(n * 10 ** max) / 10 ** max);
}

/** The shared formatters, with plain fallbacks for tests. */
export const fmt = {
  number: (n: number, max = 2) => fmtNumber(n, max),
  /** A fixed number of decimals (the replacement for toFixed in text the reader sees). */
  fixed: (n: number, digits: number) => {
    const f = house().fmt;
    return f ? f.number(n, { max: digits, min: digits }) : n.toFixed(digits);
  },
  percent: (x: number, max = 0) => house().fmt?.percent(x, max) ?? `${Math.round(x * 100)}%`,
  date: (d: Date, style: 'full' | 'long' | 'medium' | 'short' = 'medium') => house().fmt?.date(d, style) ?? d.toDateString(),
  dateTime: (d: Date) => house().fmt?.dateTime(d) ?? d.toString(),
  custom: (d: Date, opts: Intl.DateTimeFormatOptions) => house().fmt?.custom(d, opts) ?? d.toDateString(),
  unit: (v: number, unit: string, max = 1) => house().fmt?.unit(v, unit, max) ?? `${fmtNumber(v, max)} ${unit}`,
};

/** Resolve once font.js has the chosen language's words (or after a short wait), so the first render is translated. */
export function i18nReady(timeoutMs = 2000): Promise<void> {
  const r = house().ready;
  if (!r) return Promise.resolve();
  return Promise.race([r.then(() => undefined, () => undefined), new Promise<void>((res) => setTimeout(res, timeoutMs))]);
}
