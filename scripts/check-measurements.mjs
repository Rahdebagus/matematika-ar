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

const TOLERANCE_M = 0.0005;
const file = process.argv[2] ?? 'public/data/app-data.json';
const data = JSON.parse(readFileSync(file, 'utf8'));

const distance = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

/** "14,1" (koma desimal Indonesia) -> 14.1 */
const parseValue = (value) => Number(String(value).replace(',', '.'));

const toMeters = (value, unit) => {
  switch (unit) {
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

    if (Math.abs(actual - expected) > TOLERANCE_M) {
      const shown = (actual * (m.unit === 'cm' ? 100 : 1)).toFixed(2);
      console.error(
        `  GAGAL ${object.id}/${m.id} (${m.displayName}): ` +
          `label "${m.value} ${m.unit}" tapi jarak sebenarnya ${shown} ${m.unit}`,
      );
      failed++;
    }
  }
}

if (failed > 0) {
  console.error(`\n${failed} measurement tidak cocok dari ${checked + failed} yang dicek.`);
  process.exit(1);
}

console.log(`OK — ${checked} measurement cocok dengan koordinat titiknya.`);
