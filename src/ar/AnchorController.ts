import * as THREE from 'three';
import { MeasurementController } from '../measurement/MeasurementController';
import { fitToMarker } from '../models/fitToMarker';
import type { ModelLoader } from '../models/ModelLoader';
import type { MeasurementStyle, ObjectData } from '../data/types';

/**
 * Mengisi satu anchor marker: model (atau bentuk primitif) + garis ukurnya
 * (kontrak docs/03-modules.md).
 *
 * `load()` hanya bekerja sekali; pemanggilan berikutnya mengembalikan hasil
 * yang sama, jadi aman dipanggil tiap kali marker terlihat.
 */
export class AnchorController {
  readonly object: ObjectData;

  private readonly group: THREE.Group;
  private readonly style: MeasurementStyle;
  private readonly models: ModelLoader;

  private loading: Promise<void> | null = null;
  private controller: MeasurementController | null = null;
  private placeholderGeometry: THREE.BufferGeometry | null = null;
  private placeholderMaterial: THREE.Material | null = null;

  constructor(
    group: THREE.Group,
    object: ObjectData,
    style: MeasurementStyle,
    models: ModelLoader,
  ) {
    this.group = group;
    this.object = object;
    this.style = style;
    this.models = models;
  }

  get measurements(): MeasurementController | null {
    return this.controller;
  }

  load(): Promise<void> {
    this.loading ??= this.doLoad().catch((error: unknown) => {
      // Boleh dicoba lagi saat marker terlihat berikutnya.
      this.loading = null;
      throw error;
    });
    return this.loading;
  }

  dispose(): void {
    this.controller?.dispose();
    this.controller = null;
    this.placeholderGeometry?.dispose();
    this.placeholderMaterial?.dispose();
    this.group.clear();
  }

  private async doLoad(): Promise<void> {
    const model = await this.buildModel();
    const { holder, content } = fitToMarker(model, 1);
    this.group.add(holder);

    const style: MeasurementStyle = { ...this.style, ...this.object.style };
    this.controller = new MeasurementController(content, this.object, style, model);
    this.controller.build();
  }

  private async buildModel(): Promise<THREE.Object3D> {
    if (this.object.modelUrl) {
      return this.models.load(this.object.modelUrl);
    }

    const primitive = this.object.primitive;
    if (!primitive) {
      throw new Error(`objek "${this.object.id}": tidak ada modelUrl maupun primitive`);
    }

    const [width, height, depth] = primitive.size;
    this.placeholderGeometry = new THREE.BoxGeometry(width, height, depth);
    this.placeholderMaterial = new THREE.MeshStandardMaterial({
      color: 0xdfe6ff,
      roughness: 0.55,
      metalness: 0.05,
    });

    const mesh = new THREE.Mesh(this.placeholderGeometry, this.placeholderMaterial);
    // BoxGeometry terpusat di origin; naikkan agar alasnya di Y = 0,
    // sama seperti koordinat titik di app-data.json.
    mesh.position.y = height / 2;
    return mesh;
  }
}
