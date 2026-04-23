import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    proxy: {
      '/api/openai': {
        target: 'https://api.openai.com',
        changeOrigin: true,
        secure: true,
        rewrite: (p) => p.replace(/^\/api\/openai/, ''),
      },
      '/api/anthropic': {
        target: 'https://api.anthropic.com',
        changeOrigin: true,
        secure: true,
        rewrite: (p) => p.replace(/^\/api\/anthropic/, ''),
        headers: { 'anthropic-dangerous-allow-browser': 'true' },
      },
      '/api/deepseek': {
        target: 'https://api.deepseek.com',
        changeOrigin: true,
        secure: true,
        rewrite: (p) => p.replace(/^\/api\/deepseek/, ''),
      },
    },
  },
});
