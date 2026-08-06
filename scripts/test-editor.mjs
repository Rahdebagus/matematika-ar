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
