/**
 * Uji asap end-to-end: menjalankan hasil build di Chrome sungguhan dengan
 * kamera palsu yang "melihat" kartu penanda.
 *
 *   npm run build && npm run test:smoke
 *
 * Latar belakang: dua bug pernah lolos ke produksi karena typecheck dan build
 * sama-sama hijau, padahal aplikasinya tidak jalan (paket native gagal di
 * Vercel, lalu registry.bind yang terhapus). Keduanya hanya kelihatan saat
 * aplikasi benar-benar dijalankan.
 *
 * Chrome bisa memakai berkas Y4M sebagai kamera. Karena ffmpeg tidak ada di
 * mesin ini, frame-nya dibangkitkan langsung: gambar marker digambar ke
 * canvas, lalu dikonversi RGB -> YUV420 dan ditulis sebagai Y4M mentah.
 */
import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';

import { createCanvas, loadImage } from '@napi-rs/canvas';
import { chromium } from 'playwright-core';
import { preview } from 'vite';

const WIDTH = 640;
const HEIGHT = 480;
const FRAMES = 12;
const MARKER = process.argv[2] ?? 'public/markers/object-1.png';

if (!existsSync('dist/index.html')) {
  console.error('dist/ belum ada. Jalankan `npm run build` dulu.');
  process.exit(1);
}

/**
 * object-N.png -> targetIndex N-1 -> displayName di app-data.json.
 * Diambil dari data, bukan ditulis ulang, supaya tidak bisa melenceng.
 */
const appData = JSON.parse(readFileSync('public/data/app-data.json', 'utf8'));
const markerNumber = Number(path.basename(MARKER).match(/(\d+)/)?.[1]);
const expected = appData.objects.find((o) => o.targetIndex === markerNumber - 1);
if (!expected) {
  console.error(`Tidak ada objek dengan targetIndex ${markerNumber - 1} di app-data.json`);
  process.exit(1);
}
const EXPECT_DETECT = expected.displayName;
const EXPECT_LABELS = expected.measurements.filter(
  (m) => m.visibleOnStart ?? true,
).length;

// ---------------------------------------------------------------- kamera palsu

async function buildY4M(markerPath) {
  const image = await loadImage(markerPath);
  const canvas = createCanvas(WIDTH, HEIGHT);
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // Marker sengaja tidak memenuhi frame: kalau kartunya sebesar layar,
  // kamera efektifnya menempel di kartu dan objek 3D-nya terpotong habis.
  //
  // 0.6 dipilih karena di bawah itu pengenalan mulai tidak andal: pada 0.45
  // object-4 tertukar menjadi target 0. Marker 1-3 masih benar di 0.45.
  // Jadi 0.6 kira-kira batas aman "kartu masih cukup besar di layar".
  const scale = (HEIGHT * Number(process.env.SMOKE_MARKER_SCALE ?? 0.6)) / image.height;
  const w = image.width * scale;
  const h = image.height * scale;
  ctx.drawImage(image, (WIDTH - w) / 2, (HEIGHT - h) / 2, w, h);

  const { data } = ctx.getImageData(0, 0, WIDTH, HEIGHT);

  const luma = Buffer.alloc(WIDTH * HEIGHT);
  const cb = Buffer.alloc((WIDTH / 2) * (HEIGHT / 2));
  const cr = Buffer.alloc((WIDTH / 2) * (HEIGHT / 2));

  for (let y = 0; y < HEIGHT; y++) {
    for (let x = 0; x < WIDTH; x++) {
      const i = (y * WIDTH + x) * 4;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      luma[y * WIDTH + x] = clamp(0.299 * r + 0.587 * g + 0.114 * b);
    }
  }

  // 4:2:0 — satu nilai U/V untuk tiap blok 2x2 piksel.
  for (let y = 0; y < HEIGHT / 2; y++) {
    for (let x = 0; x < WIDTH / 2; x++) {
      let r = 0;
      let g = 0;
      let b = 0;
      for (const [dy, dx] of [[0, 0], [0, 1], [1, 0], [1, 1]]) {
        const i = ((y * 2 + dy) * WIDTH + (x * 2 + dx)) * 4;
        r += data[i];
        g += data[i + 1];
        b += data[i + 2];
      }
      r /= 4;
      g /= 4;
      b /= 4;
      const j = y * (WIDTH / 2) + x;
      cb[j] = clamp(-0.169 * r - 0.331 * g + 0.5 * b + 128);
      cr[j] = clamp(0.5 * r - 0.419 * g - 0.081 * b + 128);
    }
  }

  const chunks = [Buffer.from(`YUV4MPEG2 W${WIDTH} H${HEIGHT} F15:1 Ip A1:1 C420jpeg\n`)];
  for (let n = 0; n < FRAMES; n++) {
    chunks.push(Buffer.from('FRAME\n'), luma, cb, cr);
  }

  const outDir = path.join(os.tmpdir(), 'matematika-ar-smoke');
  mkdirSync(outDir, { recursive: true });
  const outFile = path.join(outDir, 'marker.y4m');
  writeFileSync(outFile, Buffer.concat(chunks));
  return outFile;
}

const clamp = (v) => Math.max(0, Math.min(255, Math.round(v)));

// ---------------------------------------------------------------------- test

const y4m = await buildY4M(MARKER);
console.log(`Kamera palsu: ${path.basename(MARKER)} -> ${y4m}`);

const server = await preview({
  preview: { port: 4173, host: '127.0.0.1', open: false },
  logLevel: 'silent',
});
const url = `http://127.0.0.1:4173/`;

const browser = await chromium.launch({
  channel: 'chrome',
  args: [
    '--use-fake-device-for-media-stream',
    '--use-fake-ui-for-media-stream',
    `--use-file-for-fake-video-capture=${y4m}`,
    // WebGL di headless jalan lewat SwiftShader; tfjs milik MindAR butuh ini.
    '--enable-unsafe-swiftshader',
    '--ignore-gpu-blocklist',
  ],
});

const context = await browser.newContext({
  permissions: ['camera'],
  viewport: { width: 480, height: 900 },
});
const page = await context.newPage();

const errors = [];
const notFound = [];
page.on('console', (msg) => {
  if (msg.type() === 'error') errors.push(msg.text());
});
page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));
// Pesan console untuk 404 tidak menyebut URL-nya, jadi dicatat terpisah.
page.on('response', (response) => {
  if (response.status() === 404) notFound.push(new URL(response.url()).pathname);
});

const failures = [];
const check = (ok, label, detail = '') => {
  console.log(`  ${ok ? 'OK  ' : 'GAGAL'} ${label}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failures.push(label);
};

try {
  await page.goto(url, { waitUntil: 'load', timeout: 30_000 });

  // 1. Bootstrap selesai: app-data.json termuat, tombol siap.
  const statusBefore = await page.textContent('#status');
  check(
    statusBefore?.includes('Siapkan kartu penanda') ?? false,
    'bootstrap + app-data.json termuat',
    statusBefore ?? '(kosong)',
  );

  // 2. Kamera + Controller + targets.mind. Kalau registry.bind terlupa,
  //    ARSession.start() melempar dan langkah ini gagal.
  await page.click('#start');
  await page.waitForFunction(
    () => document.querySelector('#status')?.textContent !== 'Menyalakan kamera...',
    { timeout: 90_000 },
  );
  const statusAfter = await page.textContent('#status');
  check(
    statusAfter?.includes('Arahkan kamera') || statusAfter?.includes('terdeteksi'),
    'sesi AR mulai (kamera + targets.mind + handler terpasang)',
    statusAfter ?? '(kosong)',
  );

  // 3. Marker terbaca dari kamera palsu.
  let detected = statusAfter?.includes('terdeteksi') ?? false;
  if (!detected) {
    detected = await page
      .waitForFunction(
        () => document.querySelector('#status')?.textContent?.includes('terdeteksi'),
        { timeout: 60_000 },
      )
      .then(() => true)
      .catch(() => false);
  }
  const finalStatus = await page.textContent('#status');
  check(detected, 'marker terdeteksi dari kamera palsu', finalStatus ?? '(kosong)');

  // 4. Objek benar yang muncul, dan garis ukurnya terbangun.
  if (detected) {
    check(
      finalStatus?.includes(EXPECT_DETECT) ?? false,
      `objek yang muncul = ${EXPECT_DETECT}`,
      finalStatus ?? '',
    );

    // Objek 4 memakai model .glb terkompresi Draco: kalau langkah ini lolos,
    // berarti unduhan + dekode Draco + fitToMarker semuanya berhasil.
    const meshes = await page.evaluate(() => {
      const canvas = document.querySelector('#app > canvas');
      return canvas instanceof HTMLCanvasElement && canvas.width > 0;
    });
    check(meshes, 'canvas 3D aktif');

    const labels = await page.locator('.measurement-label').count();
    check(
      labels === EXPECT_LABELS,
      `label ukur ter-render (harap ${EXPECT_LABELS})`,
      `${labels} label`,
    );
  }

  // Tangkapan layar: satu-satunya cara melihat hasil render tanpa HP.
  if (process.env.SMOKE_SHOT) {
    await page.screenshot({ path: process.env.SMOKE_SHOT });
    console.log(`  (tangkapan layar -> ${process.env.SMOKE_SHOT})`);
  }

  // 5. Tidak ada aset yang hilang. favicon dikecualikan: belum dibuat, dan
  //    tidak berpengaruh ke jalannya AR.
  const missing = notFound.filter((p) => !/favicon/i.test(p));
  check(missing.length === 0, 'tidak ada aset 404', missing.join(', '));

  // 6. Tidak ada error di console (selain 404 yang sudah dicek di atas).
  const ignorable = /favicon|Failed to load resource|WebGL.*deprecated|SwiftShader|Automatic fallback/i;
  const real = errors.filter((e) => !ignorable.test(e));
  check(real.length === 0, 'tidak ada error console', real.slice(0, 3).join(' | '));
} finally {
  await browser.close();
  await server.close();
}

console.log('');
if (failures.length > 0) {
  console.error(`UJI ASAP GAGAL: ${failures.join(', ')}`);
  process.exit(1);
}
console.log('UJI ASAP LULUS');
