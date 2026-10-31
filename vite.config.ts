import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: './',
  plugins: [react()],
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 2000,
    rollupOptions: {
      output: {
        manualChunks: {
          human: ['@vladmandic/human'],
          vendor: ['react', 'react-dom', 'zustand', 'lucide-react', 'jszip', 'idb', 'clsx'],
        },
      },
    },
  },
  worker: {
    format: 'es',
  },
  server: {
    port: 5199,
    host: '127.0.0.1',
    watch: {
      ignored: ['**/node_modules/**', '**/.git/**', '**/dist/**'],
    },
  },
  preview: {
    port: 4173,
    host: '127.0.0.1',
  },
});
