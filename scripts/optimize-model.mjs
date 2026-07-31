/**
 * Optimasi .glb untuk WebAR di HP.
 *
 *   node scripts/optimize-model.mjs "<masukan.glb>" public/models/<keluaran>.glb
 *
 * Model ekspor Blender biasanya ratusan MB-an tekstur PNG mentah. Di HP itu
 * lambat diunduh dan boros memori GPU. Pipeline ini:
 *   dedup + prune  - buang data & node duplikat/tak terpakai
 *   weld           - gabung vertex kembar (wajib sebelum Draco)
 *   textureCompress- tekstur -> WebP, maksimum 1024px
 *   draco          - kompresi geometri
 *
 * Nama node SENGAJA dipertahankan (tidak ada join/flatten) karena Fase 3
 * kemungkinan merujuk bagian model untuk titik ukur.
 *
 * Sisi runtime tidak perlu setup tambahan: DRACOLoader di three merujuk
 * decoder lewat `new URL(..., import.meta.url)`, jadi Vite ikut membundelnya.
 */
import { readFileSync, statSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, draco, prune, textureCompress, weld } from '@gltf-transform/functions';
import draco3d from 'draco3dgltf';
import sharp from 'sharp';

const [input, output] = process.argv.slice(2);
if (!input || !output) {
  console.error('Pakai: node scripts/optimize-model.mjs <masukan.glb> <keluaran.glb>');
  process.exit(1);
}

const mb = (n) => `${(n / 1024 / 1024).toFixed(2)} MB`;
const sizeBefore = statSync(input).size;

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
  'draco3d.decoder': await draco3d.createDecoderModule(),
  'draco3d.encoder': await draco3d.createEncoderModule(),
});

console.log(`Membaca ${path.basename(input)} (${mb(sizeBefore)})...`);
const document = await io.readBinary(readFileSync(input));

const countTriangles = () =>
  document
    .getRoot()
    .listMeshes()
    .flatMap((mesh) => mesh.listPrimitives())
    .reduce((sum, prim) => {
      const indices = prim.getIndices();
      const position = prim.getAttribute('POSITION');
      const count = indices ? indices.getCount() : (position?.getCount() ?? 0);
      return sum + count / 3;
    }, 0);

const trisBefore = countTriangles();
const texBefore = document.getRoot().listTextures().length;

console.log('  dedup + prune...');
await document.transform(dedup(), prune());

console.log('  weld...');
await document.transform(weld());

console.log('  tekstur -> WebP maks 1024px...');
await document.transform(
  textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [1024, 1024] }),
);

console.log('  kompresi Draco...');
await document.transform(draco());

const bytes = await io.writeBinary(document);
await mkdir(path.dirname(output), { recursive: true });
await writeFile(output, bytes);

const sizeAfter = bytes.byteLength;
const saved = ((1 - sizeAfter / sizeBefore) * 100).toFixed(1);

console.log('');
console.log(`Selesai -> ${output}`);
console.log(`  ukuran   : ${mb(sizeBefore)}  ->  ${mb(sizeAfter)}   (turun ${saved}%)`);
console.log(`  segitiga : ${Math.round(trisBefore).toLocaleString()}  ->  ${Math.round(countTriangles()).toLocaleString()}`);
console.log(`  tekstur  : ${texBefore}  ->  ${document.getRoot().listTextures().length}`);
