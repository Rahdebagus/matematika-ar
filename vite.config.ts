import { resolve } from 'node:path';
import { defineConfig } from 'vite';

export default defineConfig({
  // host: true -> dev server bisa dibuka dari HP lewat IP lokal (lihat docs/06).
  // Kamera hanya jalan di origin aman: localhost, atau HTTPS (deploy Vercel).
  server: {
    host: true,
    port: 5173,
  },
  build: {
    outDir: 'dist',
    target: 'es2022',
    rollupOptions: {
      input: {
        // Editor titik ukur adalah halaman terpisah. Anak yang membuka
        // aplikasi tidak ikut mengunduh sebarispun kodenya.
        main: resolve(__dirname, 'index.html'),
        editor: resolve(__dirname, 'editor.html'),
      },
    },
  },
});
