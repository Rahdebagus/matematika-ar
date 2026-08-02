/**
 * Memeriksa apakah model .glb dan titik ukurnya berasal dari ruang yang sama.
 *
 *   npm run check:fit
 *
 * Cara kerjanya: bandingkan kotak batas model dengan kotak batas titik ukur,
 * sumbu per sumbu. Kalau keduanya diekspor dari kondisi Unity yang sama,
 * ketiga rasionya harus seragam — cuma berbeda satu angka skala.
 *
 * Rasio yang berbeda-beda berarti model dan titik berasal dari dua ekspor
 * yang tidak sinkron. Itu tidak bisa diperbaiki dari sisi web: skala seragam
 * hanya punya satu angka, sedangkan menskalakan tiap sumbu sendiri-sendiri
 * akan memelarkan bentuk modelnya.
 */
import { readFileSync, existsSync } from 'node:fs';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import draco3d from 'draco3dgltf';

/** Selisih rasio antar-sumbu yang masih dianggap wajar. */
const MAX_SPREAD = 0.02;

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
  'draco3d.decoder': await draco3d.createDecoderModule(),
});

const multiply = (a, b) => {
  const out = new Array(16).fill(0);
  for (let c = 0; c < 4; c++)
    for (let r = 0; r < 4; r++)
      for (let k = 0; k < 4; k++) out[c * 4 + r] += a[k * 4 + r] * b[c * 4 + k];
  return out;
};

const apply = (m, [x, y, z]) => [
  m[0] * x + m[4] * y + m[8] * z + m[12],
  m[1] * x + m[5] * y + m[9] * z + m[13],
  m[2] * x + m[6] * y + m[10] * z + m[14],
];

/** Kotak batas dunia, memperhitungkan transform seluruh rantai simpul. */
async function modelBounds(path) {
  const doc = await io.read(path);
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];

  const visit = (node, parentMatrix) => {
    const world = multiply(parentMatrix, node.getMatrix());
    const mesh = node.getMesh();

    if (mesh) {
      for (const prim of mesh.listPrimitives()) {
        const pos = prim.getAttribute('POSITION');
        if (!pos) continue;
        const lo = pos.getMin([]);
        const hi = pos.getMax([]);
        // Kedelapan sudut, karena rotasi bisa menukar sumbu.
        for (let i = 0; i < 8; i++) {
          const corner = apply(world, [
            i & 1 ? hi[0] : lo[0],
            i & 2 ? hi[1] : lo[1],
            i & 4 ? hi[2] : lo[2],
          ]);
          for (let a = 0; a < 3; a++) {
            min[a] = Math.min(min[a], corner[a]);
            max[a] = Math.max(max[a], corner[a]);
          }
        }
      }
    }
    for (const child of node.listChildren()) visit(child, world);
  };

  const identity = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
  for (const scene of doc.getRoot().listScenes())
    for (const node of scene.listChildren()) visit(node, identity);

  return max.map((v, i) => v - min[i]);
}

const data = JSON.parse(readFileSync(process.argv[2] ?? 'public/data/app-data.json', 'utf8'));
const axes = ['X', 'Y', 'Z'];
let problems = 0;

for (const object of data.objects) {
  if (!object.modelUrl) continue;

  const path = `public${object.modelUrl}`;
  if (!existsSync(path)) {
    console.error(`${object.id}: model tidak ada -> ${path}`);
    problems++;
    continue;
  }

  const pmin = [Infinity, Infinity, Infinity];
  const pmax = [-Infinity, -Infinity, -Infinity];
  for (const point of object.points)
    for (let a = 0; a < 3; a++) {
      pmin[a] = Math.min(pmin[a], point.position[a]);
      pmax[a] = Math.max(pmax[a], point.position[a]);
    }
  const psize = pmax.map((v, i) => v - pmin[i]);
  if (!psize.every(Number.isFinite)) {
    console.log(`${object.id}: belum ada titik ukur, dilewati`);
    continue;
  }

  const msize = await modelBounds(path);
  const ratios = psize.map((v, i) => v / msize[i]);
  const usable = ratios.filter((r) => Number.isFinite(r) && r > 0);
  const spread = (Math.max(...usable) - Math.min(...usable)) / Math.min(...usable);

  console.log(`\n${object.id} (${object.modelUrl})`);
  for (let a = 0; a < 3; a++)
    console.log(
      `  ${axes[a]}: model ${msize[a].toFixed(4).padStart(9)}  titik ${psize[a]
        .toFixed(4)
        .padStart(9)}  rasio ${ratios[a].toFixed(4)}`,
    );

  if (spread <= MAX_SPREAD) {
    console.log(`  OK — rasio seragam (selisih ${(spread * 100).toFixed(1)}%), satu ruang.`);
  } else {
    console.error(
      `  MASALAH — rasio tidak seragam (selisih ${(spread * 100).toFixed(1)}%). ` +
        `Model dan titik berasal dari ekspor yang tidak sinkron.`,
    );
    problems++;
  }
}

console.log('');
if (problems > 0) {
  console.error(`${problems} objek bermasalah.`);
  process.exit(1);
}
console.log('Semua model sepakat ruang dengan titik ukurnya.');
