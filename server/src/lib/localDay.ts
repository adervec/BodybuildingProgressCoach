/**
 * A calendar day is the user's LOCAL day. `toISOString().slice(0, 10)` is the UTC day, which files a
 * photo taken at 22:00 in UTC-3 under tomorrow. Shared by the server and the browser-only client.
 * Read a stored day back as `day + 'T00:00:00'` (local midnight), never `new Date(day)` (UTC).
 */
const pad = (n: number) => String(n).padStart(2, '0');

export function localDay(at: number | Date = Date.now()): string {
  const d = new Date(at);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
