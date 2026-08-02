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
  private pivotNode: THREE.Object3D | null = null;
  private placeholderGeometry: THREE.BufferGeometry | null = null;
  private placeholderMaterial: THREE.Material | null = null;

  private readonly markerWidthMeters: number;

  constructor(
    group: THREE.Group,
    object: ObjectData,
    style: MeasurementStyle,
    models: ModelLoader,
    markerWidthMeters: number,
  ) {
    this.group = group;
    this.object = object;
    this.style = style;
    this.models = models;
    this.markerWidthMeters = markerWidthMeters;
  }

  get measurements(): MeasurementController | null {
    return this.controller;
  }

  /** Simpul tempat gestur putar/perbesar bekerja. */
  get pivot(): THREE.Object3D | null {
    return this.pivotNode;
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

    // Dijalankan sebelum fitToMarker mengukur, supaya kotak batas yang dipakai
    // sudah sepadan dengan koordinat titik ukurnya.
    const { modelScale } = this.object;
    if (modelScale !== undefined) {
      const [x, y, z] = typeof modelScale === 'number'
        ? [modelScale, modelScale, modelScale]
        : modelScale;
      model.scale.multiply(new THREE.Vector3(x, y, z));
    } else if (this.object.alignModelToPoints) {
      this.alignToPoints(model);
    }

    const { holder, pivot, content } = fitToMarker(model, {
      markerWidthMeters: this.markerWidthMeters,
      mode: this.object.fit,
      scale: this.object.scale,
    });
    this.group.add(holder);
    this.pivotNode = pivot;

    const style: MeasurementStyle = { ...this.style, ...this.object.style };
    this.controller = new MeasurementController(content, this.object, style, model);
    this.controller.build();
  }

  /**
   * Menyamakan kotak batas model dengan kotak batas titik ukur.
   *
   * Skalanya seragam dan diambil dari sumbu yang rentangnya paling besar —
   * sumbu itu paling kecil galat relatifnya. Memakai skala per sumbu akan
   * memelarkan model kalau titiknya tidak persis menyentuh tiap sisi.
   */
  private alignToPoints(model: THREE.Object3D): void {
    const points = this.object.points;
    if (points.length < 2) return;

    const target = new THREE.Box3();
    for (const point of points) {
      target.expandByPoint(new THREE.Vector3(...point.position));
    }

    const source = new THREE.Box3().setFromObject(model);
    const targetSize = target.getSize(new THREE.Vector3());
    const sourceSize = source.getSize(new THREE.Vector3());

    const axis = targetSize.x >= targetSize.z ? 'x' : 'z';
    if (sourceSize[axis] <= 0) return;
    model.scale.multiplyScalar(targetSize[axis] / sourceSize[axis]);

    // Diukur ulang setelah skala berubah, lalu digeser agar pusatnya berimpit.
    const scaled = new THREE.Box3().setFromObject(model);
    model.position.add(
      target.getCenter(new THREE.Vector3()).sub(scaled.getCenter(new THREE.Vector3())),
    );
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
    const opacity = primitive.opacity ?? 1;

    this.placeholderGeometry = new THREE.BoxGeometry(width, height, depth);
    this.placeholderMaterial = new THREE.MeshStandardMaterial({
      color: new THREE.Color(primitive.color ?? '#2a3550'),
      roughness: 0.55,
      metalness: 0.05,
      transparent: opacity < 1,
      opacity,
      // Tanpa ini sisi depan menutupi garis ukur di rusuk belakang, padahal
      // justru garis itulah inti pelajarannya.
      depthWrite: opacity >= 1,
      side: opacity < 1 ? THREE.DoubleSide : THREE.FrontSide,
    });

    const mesh = new THREE.Mesh(this.placeholderGeometry, this.placeholderMaterial);
    // BoxGeometry terpusat di origin; naikkan agar alasnya di Y = 0,
    // sama seperti koordinat titik di app-data.json.
    mesh.position.y = height / 2;
    return mesh;
  }
}
