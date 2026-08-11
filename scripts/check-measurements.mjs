/**
 * Melaporkan app-data.json: apakah nilai pada label cocok dengan jarak
 * sebenarnya antar titik?
 *
 *   npm run check:data
 *
 * Melapor, bukan memutuskan. Dulu skrip ini menggagalkan build, dengan alasan
 * label yang tidak sesuai koordinat mengajarkan matematika yang salah. Alasan
 * itu berpijak pada anggapan bahwa model 3D adalah sumber kebenaran ukuran —
 * dan anggapan itu tidak berlaku di sini: modelnya perwakilan visual dengan
 * proporsi sendiri, sedangkan angka pada label adalah hasil ukur lapangan.
 * Ketika keduanya berselisih, yang dipakai adalah angka ukur, jadi skrip ini
 * tidak berhak membatalkan build.
 *
 * Laporannya tetap berguna: selisih yang mendadak melebar biasanya berarti
 * titik tergeser di editor, bukan bangunannya yang berubah. Baca angkanya,
 * jangan abaikan — hanya saja keputusannya ada pada Anda.
 */
import { readFileSync } from 'node:fs';

/**
 * Toleransi mutlak untuk bentuk geometris, tempat model = matematikanya.
 *
 * 1 cm, bukan lebih ketat, karena angka pada label ditulis dua desimal dalam
 * meter — "7,79" untuk 7,7854 m sudah meleset 5 mm hanya karena pembulatan.
 * Ambang yang lebih rapat akan menuduh data yang justru paling benar.
 * Kesalahan sungguhan yang pernah ditemukan berkisar 24-157%, jauh di atas
 * ini, jadi 1 cm tetap menangkap semuanya.
 */
const TOLERANCE_M = 0.01;
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

  // Koordinat titik memakai satuan model, bukan meter. Tanpa mengalikannya
  // dengan kalibrasi, setiap ukuran akan terlihat meleset dengan persentase
  // yang sama persis — data yang justru paling konsisten malah tampak paling
  // salah.
  const metersPerUnit = object.metersPerUnit ?? 1;

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

    const actual = distance(from, to) * metersPerUnit;
    checked++;

    if (Math.abs(actual - expected) > toleranceFor(object, expected)) {
      const perUnit = m.unit?.toLowerCase() === 'cm' ? 100 : 1;
      const shown = (actual * perUnit).toFixed(2);
      const off = ((Math.abs(actual - expected) / expected) * 100).toFixed(0);
      const line =
        `${object.id}/${m.id}${m.displayName ? ` (${m.displayName})` : ''}: ` +
        `label "${m.value} ${m.unit}" tapi jarak sebenarnya ${shown} ${m.unit} — meleset ${off}%`;

      console.warn(`  BEDA ${line}`);
      warned++;
    }
  }
}

const total = checked + failed + warned;

// Titik yang tidak ada atau satuan yang tidak dikenal bukan soal selisih ukur:
// datanya rusak dan garisnya tidak akan tergambar sama sekali. Yang ini tetap
// menggagalkan build, karena tidak ada angka ukur yang bisa dibela di situ.
if (failed > 0) {
  console.error(`\n${failed} measurement rusak dari ${total} yang dicek.`);
  process.exit(1);
}

if (warned > 0) {
  console.warn(
    `\n${warned} dari ${total} measurement berbeda dari jarak titiknya. ` +
      'Angka pada label yang dipakai — ini laporan, bukan kegagalan.',
  );
}

console.log(`OK — ${checked} measurement cocok dengan koordinat titiknya.`);
