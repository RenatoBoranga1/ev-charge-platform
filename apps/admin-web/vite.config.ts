import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 4173,
    proxy: {
      '/v1': {
        changeOrigin: true,
        target: process.env.ADMIN_API_PROXY_TARGET ?? 'http://localhost:8000',
      },
    },
  },
});