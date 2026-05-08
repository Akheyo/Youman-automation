import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  // Tauri erwartet einen fixen Dev-Port
  clearScreen: false,
  server: {
    port: 5173,
    strictPort: true,
    host: true,
    watch: {
      ignored: ['**/src-tauri/**'],
    },
  },
});
