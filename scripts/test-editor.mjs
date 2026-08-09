/**
 * Uji asap editor titik ukur.
 *
 *   npm run build && npm run test:editor
 *
 * Editor tidak memakai kamera, jadi tidak perlu kamera palsu. Yang diperiksa
 * adalah hal-hal yang membuat editor ini ada gunanya: model termuat, titik
 * bisa ditambahkan dengan mengklik permukaan model, dan JSON yang diunduh
 * berisi titik itu.
 */
import { existsSync } from 'node:fs';
import { chromium } from 'playwright-core';
import { preview } from 'vite';

if (!existsSync('dist/editor.html')) {
  console.error('dist/ belum ada. Jalankan `npm run build` dulu.');
  process.exit(1);
}

const server = await preview({
  preview: { port: 4174, host: '127.0.0.1', open: false },
  logLevel: 'silent',
});

const browser = await chromium.launch({
  channel: 'chrome',
  args: ['--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const page = await context.newPage();

const errors = [];
page.on('console', (msg) => {
  if (msg.type() === 'error') errors.push(msg.text());
});
page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));

const failures = [];
const check = (ok, label, detail = '') => {
  console.log(`  ${ok ? 'OK  ' : 'GAGAL'} ${label}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failures.push(label);
};

const pointCount = () => page.locator('.list .item .id').count();

try {
  await page.goto('http://127.0.0.1:4174/editor.html', { waitUntil: 'load', timeout: 30_000 });

  await page.waitForFunction(
    () => /siap\.$/.test(document.querySelector('.status')?.textContent ?? ''),
    { timeout: 60_000 },
  );
  check(true, 'model objek pertama termuat');

  const before = await pointCount();
  check(before > 0, 'titik yang sudah ada ikut tampil', `${before} titik`);

  // Menambah titik: masuk mode tambah, lalu klik tengah model.
  await page.click('.toggle:text-is("Tambah titik")');
  const viewport = await page.locator('#viewport').boundingBox();
  await page.mouse.click(
    viewport.x + viewport.width / 2,
    viewport.y + viewport.height / 2,
  );
  await page.waitForTimeout(300);

  const after = await pointCount();
  check(after === before + 1, 'klik permukaan model menambah titik', `${before} -> ${after}`);

  // Titik baru harus punya koordinat, bukan 0,0,0 — bukti raycast mengenai model.
  const coords = await page.locator('.list .item .coords').last().textContent();
  check(
    coords !== null && coords.trim() !== '0.00, 0.00, 0.00',
    'titik baru menempel di permukaan model',
    coords?.trim() ?? '',
  );

  // Koordinat yang diketik harus benar-benar memindahkan titiknya, bukan
  // sekadar mengubah angka di layar. Jarak pada daftar ukuran ikut berubah
  // hanya kalau titiknya betul-betul bergeser di scene.
  const firstAxis = page.locator('.item.point .field.axis').first();
  const distanceBefore = await page.locator('.list .item .coords').first().textContent();
  await firstAxis.fill('7.5');
  await firstAxis.press('Enter');
  await page.waitForTimeout(300);
  const distanceAfter = await page.locator('.list .item .coords').first().textContent();
  check(
    distanceBefore !== distanceAfter,
    'mengetik koordinat memindahkan titik di scene',
    `${distanceBefore?.trim()} -> ${distanceAfter?.trim()}`,
  );

  // "Sebar titik ke model" harus benar-benar memindahkan titik sekaligus,
  // bukan sekadar mengubah pesan status.
  const beforeSpread = await page.locator('.item.point .field.axis').first().inputValue();
  await page.click('button:text-is("Sebar titik ke model")');
  await page.waitForTimeout(300);
  const afterSpread = await page.locator('.item.point .field.axis').first().inputValue();
  check(
    beforeSpread !== afterSpread,
    'tombol sebar titik memindahkan seluruh titik',
    `${beforeSpread} -> ${afterSpread}`,
  );

  // --- sudut pandang ---
  // Tombolnya harus benar-benar memindahkan kamera, bukan sekadar ada.
  const viewportBox = await page.locator('#viewport').boundingBox();
  const shot = () => page.screenshot({ clip: viewportBox });

  const bebas = await shot();
  await page.click('.grid button:text-is("Atas")');
  await page.waitForTimeout(400);
  const atas = await shot();
  check(!bebas.equals(atas), 'tombol Atas memindahkan kamera');

  await page.click('.grid button:text-is("Depan")');
  await page.waitForTimeout(400);
  const depan = await shot();
  check(!atas.equals(depan), 'tombol Depan memberi sudut pandang lain');

  // --- memilih beberapa titik sekaligus ---
  const axisValue = async (row, axis = 0) =>
    Number(await page.locator('.item.point').nth(row).locator('.field.axis').nth(axis).inputValue());

  const pickButton = (row) => page.locator('.item.point').nth(row).locator('button:text-matches("Pilih|Terpilih")');

  await pickButton(0).click();
  await pickButton(1).click({ modifiers: ['Shift'] });
  const active = await page.locator('.item.point.is-active').count();
  check(active === 2, 'Shift+klik memilih dua titik sekaligus', `${active} titik aktif`);

  // Titik yang dipilih harus bergerak bersama dengan jarak antar titik tetap.
  // Itu inti gunanya: menyeret satu per satu selalu menggeser susunannya.
  const labelCenter = async (id) =>
    page.evaluate((wanted) => {
      const node = [...document.querySelectorAll('.editor-point-label')].find(
        (e) => e.textContent === wanted,
      );
      if (!node) return null;
      const box = node.getBoundingClientRect();
      return { x: box.left + box.width / 2, y: box.top + box.height / 2 };
    }, id);

  const idOf = async (row) =>
    page.locator('.item.point').nth(row).locator('.field.id').inputValue();
  const [firstId, secondId] = [await idOf(0), await idOf(1)];

  // Pegangan gizmo ada tepat di titik tengah pilihan, sedangkan label
  // digantung sedikit di atas titiknya — dan jarak "sedikit" itu bergantung
  // pada besar model. Daripada menebaknya, beberapa jarak dicoba sampai
  // titiknya benar-benar bergerak.
  let shifts = [0, 0];
  for (const drop of [12, 8, 16, 4, 20, 0]) {
    // Seretan yang meleset ikut memutar kamera, jadi sudut pandangnya
    // dikembalikan dulu sebelum posisi label dibaca ulang.
    await page.click('.grid button:text-is("Depan")');
    await page.waitForTimeout(350);

    const [pa, pb] = [await labelCenter(firstId), await labelCenter(secondId)];
    if (!pa || !pb) break;

    const from = { x: (pa.x + pb.x) / 2, y: (pa.y + pb.y) / 2 + drop };
    const before = [await axisValue(0), await axisValue(1)];

    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await page.mouse.move(from.x + 90, from.y, { steps: 12 });
    await page.mouse.up();
    await page.waitForTimeout(300);

    const after = [await axisValue(0), await axisValue(1)];
    shifts = [after[0] - before[0], after[1] - before[1]];
    if (Math.abs(shifts[0]) > 0.01) break;
  }

  check(
    Math.abs(shifts[0]) > 0.01,
    'menyeret gizmo memindahkan titik terpilih',
    `geser ${shifts[0].toFixed(3)}`,
  );
  check(
    Math.abs(shifts[0]) > 0.01 && Math.abs(shifts[0] - shifts[1]) < 0.01,
    'kedua titik bergeser sama jauh — susunannya tidak berubah',
    `${shifts[0].toFixed(3)} vs ${shifts[1].toFixed(3)}`,
  );

  await page.click('button:text-is("Kosongkan")');
  check(
    (await page.locator('.item.point.is-active').count()) === 0,
    'tombol Kosongkan melepas semua pilihan',
  );
  await page.click('button:text-is("Pilih semua")');
  const all = await page.locator('.item.point.is-active').count();
  check(all === (await pointCount()), 'tombol Pilih semua memilih seluruh titik', `${all} titik`);
  await page.click('button:text-is("Kosongkan")');

  // --- kalibrasi ---
  // Angka kalibrasi tidak bisa ditebak dari melihat model. Diturunkan dari
  // satu ukuran yang panjang aslinya diketahui, hasilnya harus tepat.
  await page.selectOption('#panel section select.field >> nth=0', { index: 0 });
  const anchorPair = await page.locator('#panel section select.field').first().inputValue();

  await page.fill('input[placeholder="mis. 3,95"]', '10');
  await page.click('button:text-is("Hitung kalibrasi")');
  await page.waitForTimeout(200);
  const derived = Number(await page.locator('#panel .field-row input.field').first().inputValue());

  // Kalau kalibrasinya benar, ukuran acuan itu sendiri kini harus terbaca
  // tepat 10 — angka yang barusan dimasukkan. Ini memeriksa hitungannya,
  // bukan sekadar bahwa sebuah angka keluar.
  const anchorNow = (await page.locator('.list .item .coords').first().textContent()) ?? '';
  const shown = Number(anchorNow.match(/([\d.]+)\s*\w+$/)?.[1] ?? NaN);
  check(
    Math.abs(shown - 10) < 0.02,
    'kalibrasi terhitung tepat dari ukuran acuan',
    `${anchorPair} diisi 10 -> terbaca ${shown} (${derived} m/satuan)`,
  );

  // Kalibrasi ngawur harus ditolak, bukan diam-diam menulis angka raksasa.
  await page.fill('#panel .field-row input.field >> nth=0', '10000');
  await page.click('button:text-is("Isi semua angka dari kalibrasi")');
  await page.waitForTimeout(200);
  const refused = (await page.locator('.status').textContent()) ?? '';
  check(
    /Dibatalkan/.test(refused),
    'kalibrasi ngawur ditolak sebelum menulis angka',
    refused.slice(0, 60),
  );

  // Dan kalibrasi yang wajar tetap boleh jalan.
  await page.fill('#panel .field-row input.field >> nth=0', String(derived));
  await page.click('button:text-is("Isi semua angka dari kalibrasi")');
  await page.waitForTimeout(200);
  const accepted = (await page.locator('.status').textContent()) ?? '';
  check(!/Dibatalkan/.test(accepted), 'kalibrasi wajar tetap diterima', accepted.slice(0, 60));

  // Berpindah objek tidak boleh membuang suntingan objek sebelumnya.
  // Sebelum diperbaiki, suntingan hilang diam-diam dan baru ketahuan setelah
  // berkasnya diunduh — kerja yang sudah dilakukan lenyap tanpa peringatan.
  const objectSelect = page.locator('header select').first();
  const options = await objectSelect.locator('option').count();
  if (options > 1) {
    const firstValue = await objectSelect.inputValue();
    const otherValue = await objectSelect.locator('option').nth(1).getAttribute('value');

    await objectSelect.selectOption(otherValue);
    await page.waitForFunction(
      () => /siap\.$/.test(document.querySelector('.status')?.textContent ?? ''),
      { timeout: 60_000 },
    );
    await objectSelect.selectOption(firstValue);
    await page.waitForFunction(
      () => /siap\.$/.test(document.querySelector('.status')?.textContent ?? ''),
      { timeout: 60_000 },
    );

    const kept = await pointCount();
    check(
      kept === after,
      'suntingan tetap ada setelah berpindah objek dan kembali',
      `${after} -> ${kept} titik`,
    );
  }

  // Unduhan JSON harus berisi titik yang barusan ditambahkan.
  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 15_000 }),
    page.click('button:text-is("Unduh app-data.json")'),
  ]);
  const stream = await download.createReadStream();
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  const exported = JSON.parse(Buffer.concat(chunks).toString('utf8'));
  const first = exported.objects[0];
  check(
    first.points.length === after,
    'JSON hasil unduhan berisi titik yang sama',
    `${first.points.length} titik`,
  );
  check(
    typeof first.metersPerUnit === 'number',
    'kalibrasi ikut tersimpan di JSON',
    `metersPerUnit = ${first.metersPerUnit}`,
  );

  const real = errors.filter((e) => !/favicon|Failed to load resource|SwiftShader/i.test(e));
  check(real.length === 0, 'tidak ada error console', real.slice(0, 2).join(' | '));

  if (process.env.EDITOR_SHOT) {
    await page.screenshot({ path: process.env.EDITOR_SHOT });
    console.log(`  (tangkapan layar -> ${process.env.EDITOR_SHOT})`);
  }
} finally {
  await browser.close();
  await server.close();
}

console.log('');
if (failures.length > 0) {
  console.error(`UJI EDITOR GAGAL: ${failures.join(', ')}`);
  process.exit(1);
}
console.log('UJI EDITOR LULUS');
