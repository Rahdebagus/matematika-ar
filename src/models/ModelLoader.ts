import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';

/**
 * Memuat model .glb dengan cache per URL (kontrak docs/03-modules.md).
 *
 * Model dikompresi Draco oleh `npm run optimize:model`. Decoder-nya tidak
 * perlu di-host manual: sejak three r16x, DRACOLoader merujuk decoder lewat
 * `new URL(..., import.meta.url)`, jadi Vite ikut membundel dan mem-hash-nya.
 * Memanggil `setDecoderPath()` justru menambah path absolut yang rapuh.
 */
export class ModelLoader {
  private readonly gltfLoader = new GLTFLoader();
  private readonly dracoLoader = new DRACOLoader();
  private readonly cache = new Map<string, Promise<THREE.Group>>();

  constructor() {
    this.gltfLoader.setDRACOLoader(this.dracoLoader);
  }

  /**
   * Satu URL hanya diunduh sekali. Tiap pemanggilan mengembalikan clone,
   * supaya model yang sama bisa dipakai di beberapa anchor — geometry dan
   * material tetap dibagi, jadi tidak menambah memori GPU.
   */
  async load(url: string): Promise<THREE.Group> {
    let entry = this.cache.get(url);

    if (!entry) {
      entry = this.gltfLoader.loadAsync(url).then((gltf) => gltf.scene);
      // Kegagalan jangan ikut tersimpan di cache — biar bisa dicoba lagi.
      entry.catch(() => this.cache.delete(url));
      this.cache.set(url, entry);
    }

    const scene = await entry;
    return scene.clone(true);
  }

  dispose(): void {
    this.dracoLoader.dispose();
    this.cache.clear();
  }
}
