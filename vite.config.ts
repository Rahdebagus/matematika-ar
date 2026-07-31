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
  },
});
