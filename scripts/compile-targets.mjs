/**
 * Kompilasi gambar penanda -> public/targets/targets.mind
 *
 * Urutan MARKERS menentukan `targetIndex` yang dipakai di app-data.json
 * (lihat docs/05-asset-pipeline.md): object-1 -> 0, object-2 -> 1, dst.
 *
 * Catatan: mind-ar punya `OfflineCompiler`, tapi modul itu meng-import paket
 * native `canvas` yang tidak punya prebuilt untuk Node 22 di Windows. Karena
 * satu-satunya yang dipakai hanyalah `createCanvas`, kita turunkan langsung
 * dari `CompilerBase` dan pasang @napi-rs/canvas (prebuilt, tanpa node-gyp).
 *
 * Jalankan: npm run compile:targets
 */
import { writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { createCanvas, loadImage } from '@napi-rs/canvas';
import { CompilerBase } from 'mind-ar/src/image-target/compiler-base.js';
import { buildTrackingImageList } from 'mind-ar/src/image-target/image-list.js';
import { extractTrackingFeatures } from 'mind-ar/src/image-target/tracker/extract-utils.js';
import 'mind-ar/src/image-target/detector/kernels/cpu/index.js';

/** Urutan ini = targetIndex. Jangan diacak tanpa memperbarui app-data.json. */
const MARKERS = ['object-1.png', 'object-2.png', 'object-3.png', 'object-4.png'];

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const markerDir = path.join(root, 'public', 'markers');
const outFile = path.join(root, 'public', 'targets', 'targets.mind');

class NodeCompiler extends CompilerBase {
  createProcessCanvas(img) {
    return createCanvas(img.width, img.height);
  }

  /** Sama dengan OfflineCompiler.compileTrack, tanpa import `canvas`. */
  async compileTrack({ progressCallback, targetImages, basePercent }) {
    const percentPerImage = (100 - basePercent) / targetImages.length;
    let percent = 0;
    const list = [];

    for (const targetImage of targetImages) {
      const imageList = buildTrackingImageList(targetImage);
      const percentPerAction = percentPerImage / imageList.length;

      list.push(
        extractTrackingFeatures(imageList, () => {
          percent += percentPerAction;
          progressCallback(basePercent + percent);
        }),
      );
    }
    return list;
  }
}

const images = [];
for (const name of MARKERS) {
  const image = await loadImage(path.join(markerDir, name));
  console.log(`  ${name} — ${image.width}x${image.height}`);
  images.push(image);
}

console.log(`\nMengompilasi ${images.length} target...`);
const started = Date.now();

const compiler = new NodeCompiler();
let lastShown = -1;
await compiler.compileImageTargets(images, (percent) => {
  const step = Math.floor(percent / 10) * 10;
  if (step > lastShown) {
    lastShown = step;
    console.log(`  ${step}%`);
  }
});

const buffer = compiler.exportData();
await mkdir(path.dirname(outFile), { recursive: true });
await writeFile(outFile, Buffer.from(buffer));

const seconds = ((Date.now() - started) / 1000).toFixed(1);
console.log(
  `\nSelesai dalam ${seconds}s -> public/targets/targets.mind ` +
    `(${(buffer.byteLength / 1024).toFixed(0)} kB)`,
);
MARKERS.forEach((name, i) => console.log(`  targetIndex ${i} = ${name}`));
