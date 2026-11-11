// cowork v2 (house standard) description of the "coach" channel: the shared panel shows `preview`
// for review (on by default), calls `apply` once accepted, and can `undo` from its run history.
export const COACH_REPLY_KEY = 'bpc-coach-reply';

export function replyText(reply: unknown): string {
  const r = reply as { reply?: string; payload?: { reply?: string } } | string;
  return typeof r === 'string' ? r : r?.reply ?? r?.payload?.reply ?? JSON.stringify(reply, null, 2);
}

function read(): string {
  try { return localStorage.getItem(COACH_REPLY_KEY) || ''; } catch { return ''; }
}
function write(text: string, show: (t: string) => void) {
  try { localStorage.setItem(COACH_REPLY_KEY, text); } catch { /* quota */ }
  show(text);
}

export function coachChannel(show: (text: string) => void) {
  return {
    label: 'Physique coach',
    preview: (reply: unknown) => [
      { id: 'reply', label: 'Show this advice (replaces the current one)', detail: replyText(reply).slice(0, 400) },
    ],
    apply: (reply: unknown) => {
      const prev = read();
      write(replyText(reply), show);
      return { summary: 'new coaching advice shown', undo: { prev } };
    },
    undo: (d: { prev?: string }) => write(d?.prev || '', show),
  };
}
