import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

const API = 'http://localhost:8787';

// Two builds from one source tree:
//   • default — the client half of the self-hosted app; talks to the Express/SQLite server.
//   • VITE_STATIC=1 — the browser-only build for GitHub Pages: IndexedDB instead of a server, served
//     from a repo subpath, so assets resolve relative to wherever it lands.
const STATIC = process.env.VITE_STATIC === '1';

export default defineConfig({
  base: STATIC ? './' : '/',
  define: { 'import.meta.env.VITE_STATIC': JSON.stringify(STATIC ? '1' : '') },
  plugins: [
    react(),
    // The CSP in index.html forbids inline scripts, but the dev server's React refresh preamble is
    // one. Drop the tag in dev only; every build keeps it.
    {
      name: 'csp-dev-only-off',
      apply: 'serve',
      transformIndexHtml: (html) => html.replace(/\s*<meta http-equiv="Content-Security-Policy"[^>]*>/, ''),
    },
  ],
  server: {
    port: 5188,
    strictPort: true,
    proxy: {
      '/api': API,
      '/media': API,
      '/thumbs': API,
      '/guides': API,
    },
  },
  test: {
    environment: 'node',
  },
});
