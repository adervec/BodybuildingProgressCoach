import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

const API = 'http://localhost:8787';

export default defineConfig({
  plugins: [react()],
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
