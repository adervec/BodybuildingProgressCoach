import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles/theme.css';
import './styles/app.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// Installable + offline in production builds only (a SW in dev just caches stale code).
// BASE_URL keeps this right when the app is served from a subpath (GitHub Pages).
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  const sw = `${import.meta.env.BASE_URL}sw.js`.replace(/\/{2,}/g, '/');
  window.addEventListener('load', () => navigator.serviceWorker.register(sw).catch(() => {}));
}

// Tell the app portal (same origin, adervec.github.io) that this app is installed.
// Only when actually launched as an installed app — a plain browser tab writes nothing.
try {
  const modes = ['standalone', 'minimal-ui', 'fullscreen', 'window-controls-overlay'];
  if (modes.some((m) => matchMedia(`(display-mode: ${m})`).matches)) {
    const KEY = 'portal-installed';
    const installed = JSON.parse(localStorage.getItem(KEY) || '{}') as Record<string, number>;
    installed['BodybuildingProgressCoach'] = Date.now();
    localStorage.setItem(KEY, JSON.stringify(installed));
  }
} catch {
  /* storage disabled or no matchMedia — the portal just won't see us */
}
