import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  root: 'web',
  plugins: [react()],
  server: {
    port: 5173,
    host: '127.0.0.1',
    proxy: {
      '/api': process.env.NEXUS_API_TARGET ?? process.env.BOBINA_API_TARGET ?? 'http://127.0.0.1:3333',
    },
  },
  build: { outDir: '../dist/web', emptyOutDir: true },
});
