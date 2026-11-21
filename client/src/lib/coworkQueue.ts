/**
 * "Send when a session ends" for every cowork channel. The panel lives on the Dashboard, so a check-in
 * or graded photo finished elsewhere marks its channels due, and the panel sends them when it next
 * mounts; the daily schedule is the backstop.
 * ponytail: if the folder handle has not been restored 2.5 s after mount, that send waits for the schedule.
 */
const DUE_KEY = 'bpc-cowork-due';
type Panel = { push(only?: string): unknown };
let panel: Panel | null = null;

function readDue(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(DUE_KEY) || '[]');
    return Array.isArray(v) ? v.filter((x) => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

export function setCoworkPanel(p: Panel | null) {
  panel = p;
  if (!p) return;
  setTimeout(() => {
    const due = readDue();
    try { localStorage.removeItem(DUE_KEY); } catch { /* storage off */ }
    for (const ch of due) void p.push(ch);
  }, 2500); // give the panel time to restore its folder handle
}

/** Ask for these channels' requests to be written now (or as soon as the panel is up). */
export function requestCowork(...channels: string[]) {
  if (panel) { for (const ch of channels) void panel.push(ch); return; }
  try { localStorage.setItem(DUE_KEY, JSON.stringify([...new Set([...readDue(), ...channels])])); } catch { /* storage off */ }
}
