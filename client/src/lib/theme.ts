/**
 * House standard 24: the shared base theme list (font.js) plus this app's two own looks as extras.
 *   Ink    (The Sandow Plates)   bronze on near-black
 *   Marble (The Atalanta Plates) gold on warm paper
 * "System" (the default) follows the device: dark -> Ink, light -> Marble, the app's own dark and
 * light. Ink and Marble keep their full styling (gradients, grain) in theme.css; any base theme
 * (Midnight, Paper, High contrast, ...) maps its palette onto the app's variables via
 * :root[data-theme='house'].
 */
import { t } from './i18n';

type Look = 'ink' | 'marble' | 'house';
interface HouseTheme { id: string; dark: boolean }
interface HouseThemes {
  addThemes?(list: { id: string; label: string; dark: boolean; colors: Record<string, string> }[]): number;
  theme?(): string;
  themeNow?(): HouseTheme;
}
const house = (): HouseThemes => (window as unknown as { appFont?: HouseThemes }).appFont ?? {};

// All eleven house colours, from theme.css (lines blended onto the background, since the house
// palette is opaque hex).
// i18n-keys: Ink | Marble
export const EXTRA_THEMES = [
  { id: 'ink', label: 'Ink', dark: true, colors: {
    bg: '#0c0b08', surface: '#15120c', surface2: '#1d1910', line: '#3d3220', text: '#ece4d4', dim: '#b3a88f',
    accent: '#c69a4c', 'on-accent': '#0c0b08', good: '#7bbf8a', warn: '#d8a14a', bad: '#cf6f5e' } },
  { id: 'marble', label: 'Marble', dark: false, colors: {
    bg: '#f3ecdd', surface: '#efe7d5', surface2: '#e9dfcb', line: '#d6c8a9', text: '#2c2318', dim: '#6e6150',
    accent: '#8a6626', 'on-accent': '#fffaf0', good: '#4f7a53', warn: '#94631f', bad: '#a14b35' } },
];

/** Which of the app's looks to wear: an own extra by name, the device's dark/light for System, else the house palette. */
export function lookFor(choice: string, deviceDark: boolean): Look {
  if (choice === 'ink' || choice === 'marble') return choice;
  if (choice === 'system') return deviceDark ? 'ink' : 'marble';
  return 'house';
}

/** Register Ink and Marble once, at start-up (labels in the reader's language). */
export function registerThemes() {
  house().addThemes?.(EXTRA_THEMES.map((x) => ({ ...x, label: t(x.label) })));
}

/** Keep <html data-theme> in step with the reader's choice and the device; returns an unsubscribe. */
export function followTheme(): () => void {
  const mq = matchMedia('(prefers-color-scheme: dark)');
  const apply = () => {
    const h = house();
    const choice = h.theme?.() ?? 'system';
    const dark = choice === 'system' ? h.themeNow?.().dark ?? mq.matches : mq.matches;
    document.documentElement.setAttribute('data-theme', lookFor(choice, dark));
  };
  apply();
  mq.addEventListener('change', apply);
  document.addEventListener('app-theme-change', apply);
  document.addEventListener('app-themes-added', apply);
  return () => {
    mq.removeEventListener('change', apply);
    document.removeEventListener('app-theme-change', apply);
    document.removeEventListener('app-themes-added', apply);
  };
}
