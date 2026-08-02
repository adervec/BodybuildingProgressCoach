/**
 * Orientation is a choice, not whatever the accelerometer says: portrait by
 * default, switchable in the sidebar. Browsers only honor lock() in an
 * installed app / fullscreen (Android); elsewhere the preference is saved and
 * the caller can tell the user the browser won't enforce it.
 */
export type OrientationMode = 'portrait' | 'landscape' | 'auto';

const KEY = 'ls.orientation';

export function savedOrientation(): OrientationMode {
  const v = localStorage.getItem(KEY);
  return v === 'landscape' || v === 'auto' ? v : 'portrait';
}

export function saveOrientation(mode: OrientationMode): void {
  localStorage.setItem(KEY, mode);
}

/** Apply the mode. Resolves false where the browser refuses to lock (iOS, desktop tab). */
export async function applyOrientation(mode: OrientationMode): Promise<boolean> {
  // ponytail: cast — TS's dom lib and real browsers disagree on lock()'s existence.
  const so =
    typeof screen !== 'undefined'
      ? (screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void>; unlock?: () => void })
      : undefined;
  try {
    if (mode === 'auto') {
      so?.unlock?.();
      return true;
    }
    if (!so?.lock) return false;
    await so.lock(mode);
    return true;
  } catch {
    return false;
  }
}
