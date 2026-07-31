/**
 * Membuat QR code aplikasi -> public/qr.svg
 *
 *   npm run make:qr -- https://alamat-anda.vercel.app
 *
 * SVG, bukan PNG: tajam saat dicetak sebesar apa pun dan ukurannya hanya
 * beberapa kB. QR ini dipakai di layar Tentang dan bisa dicetak untuk
 * ditempel di kelas.
 */
import { writeFile } from 'node:fs/promises';
import QRCode from 'qrcode';

/**
 * Urutan sumber alamat:
 * 1. argumen baris perintah
 * 2. domain produksi dari Vercel saat build — supaya QR ikut benar sendiri
 *    kalau domainnya diganti, tanpa perlu diingat-ingat
 * 3. alamat bawaan
 */
const fromVercel = process.env.VERCEL_PROJECT_PRODUCTION_URL;
const url =
  process.argv[2] ??
  (fromVercel ? `https://${fromVercel}` : 'https://matematika-ar.vercel.app');
const outFile = 'public/qr.svg';

const svg = await QRCode.toString(url, {
  type: 'svg',
  margin: 1,
  // Level H tahan sampai 30% permukaannya rusak — penting untuk QR cetak
  // yang bisa terlipat, kotor, atau tergores di ruang kelas.
  errorCorrectionLevel: 'H',
  color: { dark: '#0b1020', light: '#ffffff' },
});

await writeFile(outFile, svg);
console.log(`${outFile} dibuat untuk ${url} (${(svg.length / 1024).toFixed(1)} kB)`);
