import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles/theme.css';
import './styles/app.css';
import { i18nReady } from './lib/i18n';
import { registerThemes } from './lib/theme';

// Render once the chosen language's words are in, so the first paint is already translated
// (and the app's own Ink and Marble themes carry translated names in the picker).
i18nReady().then(() => {
  registerThemes();
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
});

// Installable + offline in production builds only (a SW in dev just caches stale code).
// BASE_URL keeps this right when the app is served from a subpath (GitHub Pages).
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  const sw = `${import.meta.env.BASE_URL}sw.js`.replace(/\/{2,}/g, '/');
  window.addEventListener('load', () => navigator.serviceWorker.register(sw).catch(() => {}));
}
