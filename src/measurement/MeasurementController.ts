import * as THREE from 'three';
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';
import { LineVisual } from './LineVisual';
import type { MeasurementStyle, ObjectData } from '../data/types';

/**
 * Membangun dan mengendalikan semua garis ukur satu objek
 * (kontrak docs/03-modules.md).
 *
 * Satu `LineMaterial` dipakai bersama semua garis milik objek ini, supaya
 * pembaruan resolusi saat layar berubah cukup sekali.
 */
export class MeasurementController {
  readonly root = new THREE.Group();

  private readonly object: ObjectData;
  private readonly style: MeasurementStyle;
  private readonly model: THREE.Object3D | null;
  private readonly material: LineMaterial;
  private readonly visuals: LineVisual[] = [];
  /**
   * Material model yang sudah di-clone (agar transparansi tidak menular),
   * beserta kondisi awalnya. Nilai awal harus disimpan: bentuk contoh sudah
   * setengah tembus pandang dari JSON, jadi mematikan mode transparan tidak
   * boleh memaksa opacity kembali ke 1.
   */
  private readonly modelMaterials: {
    material: THREE.Material;
    opacity: number;
    transparent: boolean;
    depthWrite: boolean;
  }[] = [];
  private built = false;

  constructor(
    parent: THREE.Object3D,
    object: ObjectData,
    style: MeasurementStyle,
    model: THREE.Object3D | null = null,
  ) {
    this.object = object;
    this.style = style;
    this.model = model;

    this.material = new LineMaterial({
      color: new THREE.Color(style.lineColor).getHex(),
      linewidth: style.lineWidth,
      worldUnits: style.worldUnits ?? false,
      dashed: false,
    });
    this.material.resolution.set(window.innerWidth, window.innerHeight);

    parent.add(this.root);
  }

  /** Idempoten — aman dipanggil ulang saat marker terlihat lagi. */
  build(): void {
    if (this.built) return;
    this.built = true;

    const positions = new Map(
      this.object.points.map((point) => [point.id, new THREE.Vector3(...point.position)]),
    );

    for (const def of this.object.measurements) {
      const from = positions.get(def.from);
      const to = positions.get(def.to);
      // loadAppData sudah memvalidasi, ini cuma jaring pengaman tipe.
      if (!from || !to) continue;

      const visual = new LineVisual(def, from, to, this.style, this.material);
      visual.setVisible(def.visibleOnStart ?? true);
      this.visuals.push(visual);
      this.root.add(visual.root);
    }

    this.isolateModelMaterials();
  }

  showAll(): void {
    for (const visual of this.visuals) visual.setVisible(true);
  }

  hideAll(): void {
    for (const visual of this.visuals) visual.setVisible(false);
  }

  showCategory(category: string): void {
    for (const visual of this.visuals) visual.setVisible(visual.category === category);
  }

  showOnly(id: string): void {
    for (const visual of this.visuals) visual.setVisible(visual.id === id);
  }

  /** Kembali ke kondisi `visibleOnStart` di JSON. */
  reset(): void {
    const initial = new Map(
      this.object.measurements.map((def) => [def.id, def.visibleOnStart ?? true]),
    );
    for (const visual of this.visuals) {
      visual.setVisible(initial.get(visual.id) ?? true);
    }
  }

  /** Fade model agar garis di dalamnya terlihat. Garis tidak ikut memudar. */
  setTransparent(on: boolean): void {
    for (const entry of this.modelMaterials) {
      const { material } = entry;

      if (on) {
        material.transparent = true;
        // Relatif terhadap kondisi awal, supaya benda yang memang sudah
        // setengah tembus pandang tetap terlihat lebih pudar saat ditekan.
        material.opacity = Math.max(0.12, entry.opacity * 0.45);
        material.depthWrite = false;
      } else {
        material.transparent = entry.transparent;
        material.opacity = entry.opacity;
        material.depthWrite = entry.depthWrite;
      }
      material.needsUpdate = true;
    }
  }

  get categories(): string[] {
    return [...new Set(this.visuals.map((visual) => visual.category))];
  }

  /** LineMaterial butuh ukuran viewport untuk menghitung tebal garis. */
  setResolution(width: number, height: number): void {
    this.material.resolution.set(width, height);
  }

  dispose(): void {
    for (const visual of this.visuals) visual.dispose();
    this.visuals.length = 0;
    for (const entry of this.modelMaterials) entry.material.dispose();
    this.modelMaterials.length = 0;
    this.material.dispose();
    this.root.removeFromParent();
  }

  /**
   * ModelLoader mengembalikan clone yang berbagi material dengan instance
   * lain. Tanpa ini, menyalakan transparansi di satu objek ikut memudarkan
   * objek lain yang memakai model sama.
   */
  private isolateModelMaterials(): void {
    const isolate = (material: THREE.Material): THREE.Material => {
      const clone = material.clone();
      this.modelMaterials.push({
        material: clone,
        opacity: clone.opacity,
        transparent: clone.transparent,
        depthWrite: clone.depthWrite,
      });
      return clone;
    };

    this.model?.traverse((child) => {
      if (!(child instanceof THREE.Mesh)) return;

      child.material = Array.isArray(child.material)
        ? child.material.map(isolate)
        : isolate(child.material as THREE.Material);
    });
  }
}
