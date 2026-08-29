import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const backendPort = process.env.VITE_BACKEND_PORT || process.env.BACKEND_PORT || '8000';
const backendUrl = process.env.VITE_BACKEND_URL || `http://127.0.0.1:${backendPort}`;

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    cssCodeSplit: false,
    rollupOptions: {
      output: {
        entryFileNames: 'app.js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: (assetInfo) => {
          if (assetInfo.name && assetInfo.name.endsWith('.css')) {
            return 'style.css';
          }
          return 'assets/[name]-[hash][extname]';
        },
      },
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: backendUrl,
        changeOrigin: true,
      },
    },
  },
});
