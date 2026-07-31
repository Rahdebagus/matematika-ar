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
const EXPECT_TOTAL = expected.measurements.length;
/** Jumlah label per kategori — angka harapan untuk tombol saring. */
const EXPECT_BY_CATEGORY = {};
for (const m of expected.measurements) {
  const key = m.category ?? 'default';
  EXPECT_BY_CATEGORY[key] = (EXPECT_BY_CATEGORY[key] ?? 0) + 1;
}

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

/**
 * Rata-rata kecerahan tampilan AR, diukur dari tangkapan layar.
 *
 * Membaca piksel canvas WebGL langsung tidak bisa: tanpa preserveDrawingBuffer
 * (yang memakan performa) buffer sudah dibersihkan setelah compositing dan
 * hasilnya selalu nol. Tangkapan layar menangkap hasil akhir halaman.
 */
const AR_CLIP = { x: 20, y: 180, width: 440, height: 420 };

const arPixels = async (page) => {
  const buffer = await page.screenshot({ clip: AR_CLIP });
  const image = await loadImage(buffer);
  const canvas = createCanvas(image.width, image.height);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(image, 0, 0);
  return ctx.getImageData(0, 0, image.width, image.height).data;
};

const screenBrightness = async (page) => {
  const data = await arPixels(page);
  let total = 0;
  for (let i = 0; i < data.length; i += 4) total += data[i] + data[i + 1] + data[i + 2];
  return total / ((data.length / 4) * 3);
};

/**
 * Rata-rata selisih piksel antara dua kondisi.
 *
 * Untuk gestur, rata-rata kecerahan terlalu tumpul: memutar kubus yang
 * simetris nyaris tidak mengubah kecerahan rata-rata walau bentuknya jelas
 * berubah. Selisih per piksel menangkap perpindahan garis dan rusuk.
 */
/**
 * Posisi layar tiap label ukur.
 *
 * Label CSS2D diletakkan dari hasil proyeksi titik 3D-nya, jadi pergeserannya
 * adalah bukti langsung bahwa objek benar-benar berputar atau berubah ukuran.
 * Selisih piksel tidak bisa dipakai di sini: objek yang menutupi seluruh area
 * sampel dengan warna rata tetap terlihat identik walau sudah diputar.
 */
const labelPositions = (page) =>
  page.$$eval('.measurement-label', (elements) =>
    elements
      .map((element) => element.getBoundingClientRect())
      .filter((rect) => rect.width > 0)
      .map((rect) => [Math.round(rect.x), Math.round(rect.y)]),
  );

/** Pergeseran label terjauh antara dua kondisi. */
const maxShift = (before, after) => {
  if (before.length === 0 || before.length !== after.length) return Infinity;
  let worst = 0;
  for (let i = 0; i < before.length; i++) {
    worst = Math.max(
      worst,
      Math.abs(before[i][0] - after[i][0]) + Math.abs(before[i][1] - after[i][1]),
    );
  }
  return worst;
};

const meanDiff = (a, b) => {
  let total = 0;
  let n = 0;
  for (let i = 0; i < a.length; i += 4) {
    total += Math.abs(a[i] - b[i]) + Math.abs(a[i + 1] - b[i + 1]) + Math.abs(a[i + 2] - b[i + 2]);
    n += 3;
  }
  return total / n;
};

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
  // Perlu agar Chromium menerima event sentuh untuk uji cubit dua jari.
  hasTouch: true,
});
const page = await context.newPage();

/**
 * Cubit dua jari. Playwright tidak punya API multi-sentuh, jadi event-nya
 * dikirim langsung lewat CDP. Ini gestur utama di HP, jadi tidak boleh
 * hanya mengandalkan roda tetikus yang cuma dipakai saat menguji di laptop.
 */
const cdp = await context.newCDPSession(page);
const pinch = async (centerX, centerY, fromGap, toGap, steps = 6) => {
  const points = (gap) => [
    { x: centerX - gap / 2, y: centerY, id: 1 },
    { x: centerX + gap / 2, y: centerY, id: 2 },
  ];

  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: points(fromGap),
  });
  for (let i = 1; i <= steps; i++) {
    const gap = fromGap + ((toGap - fromGap) * i) / steps;
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: points(gap),
    });
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
};

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

  /**
   * Menunggu layar dengan judul tertentu terlihat DAN transisi fade-nya
   * selesai. Tanpa menunggu opacity, Playwright menganggapnya sudah terlihat
   * saat masih setengah transparan — klik bisa meleset dan tangkapan layar
   * jadi pucat.
   */
  const waitScreen = async (heading) => {
    const panel = page.locator(`#screens .screen-panel:visible h1:text-is("${heading}")`);
    await panel.waitFor({ timeout: 10_000 });
    await page.waitForFunction(
      (text) => {
        const found = [...document.querySelectorAll('#screens .screen-panel h1')].find(
          (h) => h.textContent === text,
        );
        const screen = found?.closest('.screen');
        return screen !== null && screen !== undefined && getComputedStyle(screen).opacity === '1';
      },
      heading,
      { timeout: 10_000 },
    );
  };

  // 1. Router menampilkan menu lebih dulu.
  await waitScreen('Matematika AR');
  check(true, 'menu tampil saat aplikasi dibuka');

  if (process.env.SMOKE_SHOT) {
    await page.screenshot({ path: process.env.SMOKE_SHOT.replace(/\.png$/, '-menu.png') });
  }

  // 1b. Navigasi antar-layar dan dialog Materi.
  await page.click('.menu-button:text-is("Panduan")');
  await waitScreen('Panduan');
  await page.click('#screens .screen-panel:visible .menu-button:text-is("Kembali")');
  await waitScreen('Matematika AR');
  check(true, 'Panduan dibuka lalu kembali ke menu');

  await page.click('.menu-button:text-is("Tentang")');
  await waitScreen('Tentang');
  await page.click('#screens .screen-panel:visible .menu-button:text-is("Kembali")');
  await waitScreen('Matematika AR');
  check(true, 'Tentang dibuka lalu kembali ke menu');

  // Tombol suara: hanya kondisi togelnya yang bisa dicek dari luar.
  await page.click('.menu-sound');
  const muted = await page.getAttribute('.menu-sound', 'aria-pressed');
  await page.click('.menu-sound');
  const unmuted = await page.getAttribute('.menu-sound', 'aria-pressed');
  check(muted === 'true' && unmuted === 'false', 'tombol suara bisa ditogel');

  await page.click('.menu-button:text-is("Materi")');
  await page.locator('dialog.dialog[open]').waitFor({ timeout: 5_000 });
  await page.click('.dialog-close');
  check(
    (await page.locator('dialog.dialog[open]').count()) === 0,
    'dialog Materi terbuka lalu tertutup',
  );

  // 2. Kamera + Controller + targets.mind. Kalau registry.bind terlupa,
  //    ARSession.start() melempar dan langkah ini gagal.
  await page.click('.menu-button:text-is("Mulai AR")');
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

  // 4b. Overlay AR: tombolnya benar-benar ditekan, akibatnya diperiksa.
  if (detected && EXPECT_TOTAL > 0) {
    const labels = () => page.locator('.measurement-label:visible').count();
    const press = async (title) => {
      await page.click(`.overlay-button[title="${title}"]`);
      await page.waitForTimeout(150);
    };

    await press('Sembunyikan');
    check((await labels()) === 0, 'tombol Sembunyikan mengosongkan label', `${await labels()}`);

    await press('Tampilkan');
    check(
      (await labels()) === EXPECT_TOTAL,
      `tombol Tampilkan memunculkan semua (harap ${EXPECT_TOTAL})`,
      `${await labels()}`,
    );

    await press('Reset');
    check(
      (await labels()) === EXPECT_LABELS,
      `tombol Reset kembali ke kondisi awal (harap ${EXPECT_LABELS})`,
      `${await labels()}`,
    );

    // Diukur sebelum ditekan, supaya perubahannya benar-benar terlihat.
    const beforeFade = await screenBrightness(page);
    await press('Transparan');
    const pressed = await page.getAttribute(
      '.overlay-button[title="Transparan"]',
      'aria-pressed',
    );
    check(pressed === 'true', 'tombol Transparan menyala');

    // Fade dijalankan di dalam render loop. Kalau controller lupa didaftarkan
    // sebagai Updatable, tombolnya tetap menyala tapi tampilan tidak berubah
    // sama sekali — dan itu hanya ketahuan dari piksel.
    await page.waitForTimeout(500);
    const afterFade = await screenBrightness(page);
    check(
      Math.abs(afterFade - beforeFade) > 1,
      'transparansi mengubah tampilan lewat render loop',
      `kecerahan ${beforeFade.toFixed(1)} -> ${afterFade.toFixed(1)}`,
    );

    // 4d. Gestur putar dan perbesar. Diukur dari piksel karena inilah
    //     satu-satunya bukti transformasinya benar-benar sampai ke layar.
    await press('Reset');
    await page.waitForTimeout(350);
    const atRest = await labelPositions(page);

    await page.mouse.move(240, 400);
    await page.mouse.down();
    for (let x = 240; x <= 400; x += 16) {
      await page.mouse.move(x, 400);
    }
    await page.mouse.up();
    await page.waitForTimeout(200);
    const rotated = await labelPositions(page);
    check(
      maxShift(atRest, rotated) > 10,
      'geser satu jari memutar objek',
      `label bergeser ${maxShift(atRest, rotated)} px`,
    );

    if (process.env.SMOKE_SHOT) {
      await page.screenshot({
        path: process.env.SMOKE_SHOT.replace(/\.png$/, '-diputar.png'),
      });
    }

    await page.mouse.move(240, 400);
    for (let i = 0; i < 8; i++) await page.mouse.wheel(0, -120);
    await page.waitForTimeout(200);
    const zoomed = await labelPositions(page);
    check(
      maxShift(rotated, zoomed) > 10,
      'roda tetikus memperbesar objek',
      `label bergeser ${maxShift(rotated, zoomed)} px`,
    );

    await press('Reset');
    await page.waitForTimeout(350);
    const beforePinch = await labelPositions(page);
    await pinch(240, 420, 80, 320);
    await page.waitForTimeout(200);
    const pinched = await labelPositions(page);
    check(
      maxShift(beforePinch, pinched) > 10,
      'cubit dua jari memperbesar objek',
      `label bergeser ${maxShift(beforePinch, pinched)} px`,
    );

    await press('Reset');
    await page.waitForTimeout(350);
    const reset = await labelPositions(page);
    check(
      maxShift(atRest, reset) <= 1,
      'Reset mengembalikan putaran dan ukuran',
      `sisa selisih ${maxShift(atRest, reset)} px`,
    );

    const chips = await page.locator('.overlay-chip').count();
    if (chips > 1) {
      const first = page.locator('.overlay-chip').first();
      const name = await first.textContent();
      await first.click();
      await page.waitForTimeout(150);
      check(
        (await labels()) === EXPECT_BY_CATEGORY[name],
        `saring kategori "${name}" (harap ${EXPECT_BY_CATEGORY[name]})`,
        `${await labels()}`,
      );
      await press('Reset');
    }
  }

  // Tangkapan layar: satu-satunya cara melihat hasil render tanpa HP.
  if (process.env.SMOKE_SHOT) {
    await page.screenshot({ path: process.env.SMOKE_SHOT });
    console.log(`  (tangkapan layar -> ${process.env.SMOKE_SHOT})`);
  }

  // 4c. Keluar dari layar AR harus mematikan kamera, bukan sekadar menutupi.
  await page.click('#ar-back');
  await waitScreen('Matematika AR');
  const cameraLive = await page.evaluate(() => {
    const video = document.querySelector('#app video');
    if (!video) return false;
    const stream = video.srcObject;
    return stream instanceof MediaStream && stream.getTracks().some((t) => t.readyState === 'live');
  });
  check(!cameraLive, 'kembali ke menu mematikan kamera');

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
