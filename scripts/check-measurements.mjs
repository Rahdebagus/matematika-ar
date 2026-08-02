/**
 * Memeriksa app-data.json: apakah nilai pada label cocok dengan jarak
 * sebenarnya antar titik?
 *
 *   npm run check:data
 *
 * Ini aplikasi edukasi — label "14,1 cm" yang ternyata tidak sesuai koordinat
 * mengajarkan matematika yang salah. Lebih baik gagal di sini daripada di HP
 * anak. Toleransi 0,5 mm mengakomodasi pembulatan satu desimal.
 */
import { readFileSync } from 'node:fs';

/** Toleransi mutlak untuk bentuk geometris, tempat model = matematikanya. */
const TOLERANCE_M = 0.0005;
const file = process.argv[2] ?? 'public/data/app-data.json';
const data = JSON.parse(readFileSync(file, 'utf8'));

/**
 * Objek boleh menyetel `measurementTolerance` sebagai pecahan, mis. 0.15.
 *
 * Alasannya: pada model bangunan yang dibuat tangan, angka pada label adalah
 * hasil ukur di dunia nyata, sedangkan modelnya hanya pendekatan visual.
 * Menuntut kecocokan sampai setengah milimeter di situ tidak masuk akal.
 * Untuk kubus dan balok, model memang harus persis — biarkan tanpa toleransi.
 */
const toleranceFor = (object, expected) =>
  object.measurementTolerance ? expected * object.measurementTolerance : TOLERANCE_M;

const distance = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

/** "14,1" (koma desimal Indonesia) -> 14.1 */
const parseValue = (value) => Number(String(value).replace(',', '.'));

const toMeters = (value, unit) => {
  // Unity mengekspor satuan dengan huruf besar ("CM", "M"), jadi jangan
  // membedakan besar-kecil huruf.
  switch (unit?.toLowerCase()) {
    case 'cm':
      return value / 100;
    case 'mm':
      return value / 1000;
    case 'm':
    case undefined:
      return value;
    default:
      return null;
  }
};

let checked = 0;
let failed = 0;
let warned = 0;

for (const object of data.objects) {
  const points = new Map(object.points.map((p) => [p.id, p.position]));

  for (const m of object.measurements) {
    if (m.value === undefined || m.from === m.to) continue;

    const from = points.get(m.from);
    const to = points.get(m.to);
    if (!from || !to) {
      console.error(`  GAGAL ${object.id}/${m.id}: titik tidak ditemukan`);
      failed++;
      continue;
    }

    const expected = toMeters(parseValue(m.value), m.unit);
    if (expected === null) {
      console.error(`  GAGAL ${object.id}/${m.id}: satuan "${m.unit}" tidak dikenal`);
      failed++;
      continue;
    }

    const actual = distance(from, to);
    checked++;

    if (Math.abs(actual - expected) > toleranceFor(object, expected)) {
      const perUnit = m.unit?.toLowerCase() === 'cm' ? 100 : 1;
      const shown = (actual * perUnit).toFixed(2);
      const off = ((Math.abs(actual - expected) / expected) * 100).toFixed(0);
      const line =
        `${object.id}/${m.id}${m.displayName ? ` (${m.displayName})` : ''}: ` +
        `label "${m.value} ${m.unit}" tapi jarak sebenarnya ${shown} ${m.unit} — meleset ${off}%`;

      if (object.draft) {
        console.warn(`  PERINGATAN ${line}`);
        warned++;
      } else {
        console.error(`  GAGAL ${line}`);
        failed++;
      }
    }
  }
}

const total = checked + failed + warned;

if (failed > 0) {
  console.error(`\n${failed} measurement tidak cocok dari ${total} yang dicek.`);
  process.exit(1);
}

if (warned > 0) {
  console.warn(
    `\n${warned} measurement tidak cocok, tapi objeknya bertanda "draft" jadi build diteruskan.`,
  );
  console.warn('Hapus tanda "draft" setelah angkanya dibetulkan di Unity.');
}

console.log(`OK — ${checked} measurement cocok dengan koordinat titiknya.`);
