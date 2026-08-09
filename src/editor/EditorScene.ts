import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { TransformControls } from 'three/examples/jsm/controls/TransformControls.js';
import { CSS2DObject, CSS2DRenderer } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import { ModelLoader } from '../models/ModelLoader';
import type { MeasurementDef, ObjectData, Vec3 } from '../data/types';

const POINT_COLOR = 0x14e6ff;
const POINT_SELECTED = 0xffc24b;
const LINE_COLOR = 0xff3000;

export type EditorMode = 'pilih' | 'tambah';

/**
 * Sudut pandang tetap. Sumbu model dipandang dari enam arah baku supaya
 * susunan titik bisa diperiksa satu bidang pada satu waktu — dari sudut
 * bebas, titik yang meleset ke dalam atau ke luar model sulit dibedakan
 * dari titik yang tepat.
 */
export type EditorView = 'perspektif' | 'atas' | 'depan' | 'belakang' | 'kiri' | 'kanan';

export interface EditorEvents {
  /** Titik ditambah, dihapus, atau diganti namanya — daftar perlu disusun ulang. */
  onPointsChanged: () => void;
  /**
   * Titik hanya berpindah. Sengaja dipisah dari `onPointsChanged`: menyeret
   * gizmo memicu ini puluhan kali per detik, dan menyusun ulang seluruh
   * daftar akan merebut fokus dari kotak isian yang sedang diketik.
   */
  onPointMoved: () => void;
  onSelectionChanged: (pointIds: string[]) => void;
}

interface EditorPoint {
  id: string;
  mesh: THREE.Mesh;
  label: CSS2DObject;
}

/**
 * Scene editor: model 3D, titik ukur yang bisa digeser, dan garis antar titik.
 *
 * Titik ditempatkan langsung di atas model, jadi koordinatnya selalu berada di
 * ruang model itu sendiri. Inilah inti gunanya editor ini — perbedaan ruang
 * antara model dan titik ukur, yang selama ini harus ditebak dan dikoreksi,
 * jadi mustahil terjadi.
 */
export class EditorScene {
  mode: EditorMode = 'pilih';

  private readonly container: HTMLElement;
  private readonly events: EditorEvents;
  private readonly scene = new THREE.Scene();
  private readonly camera: THREE.PerspectiveCamera;
  private readonly renderer: THREE.WebGLRenderer;
  private readonly labelRenderer = new CSS2DRenderer();
  private readonly orbit: OrbitControls;
  private readonly gizmo: TransformControls;
  private readonly models = new ModelLoader();

  private readonly pointRoot = new THREE.Group();
  private readonly lineRoot = new THREE.Group();
  private readonly pointGeometry: THREE.SphereGeometry;
  private readonly pointMaterial: THREE.MeshBasicMaterial;
  private readonly selectedMaterial: THREE.MeshBasicMaterial;
  private readonly lineMaterial = new THREE.LineBasicMaterial({ color: LINE_COLOR });

  private readonly raycaster = new THREE.Raycaster();
  private readonly pointer = new THREE.Vector2();

  private model: THREE.Object3D | null = null;
  private points: EditorPoint[] = [];
  private measurements: MeasurementDef[] = [];
  private selection: string[] = [];
  private pointerDownAt = { x: 0, y: 0 };

  /**
   * Gizmo dipasang ke benda bantu ini, bukan langsung ke salah satu titik.
   *
   * Dengan begitu satu dan banyak titik ditangani dengan jalur yang sama:
   * tiap titik menyimpan jaraknya sendiri terhadap benda bantu, lalu ikut
   * ke mana pun benda bantu digeser. Kalau gizmo dipasang ke satu titik,
   * titik-titik lain tidak punya apa pun untuk diikuti.
   */
  private readonly dragProxy = new THREE.Object3D();
  private readonly dragOffsets = new Map<string, THREE.Vector3>();

  constructor(container: HTMLElement, events: EditorEvents) {
    this.container = container;
    this.events = events;

    this.camera = new THREE.PerspectiveCamera(50, 1, 0.01, 1000);
    this.camera.position.set(4, 3, 6);

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setClearColor(0x0b1020);
    container.appendChild(this.renderer.domElement);

    this.labelRenderer.domElement.className = 'editor-labels';
    container.appendChild(this.labelRenderer.domElement);

    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x334466, 2));
    const sun = new THREE.DirectionalLight(0xffffff, 1.4);
    sun.position.set(3, 5, 2);
    this.scene.add(sun);
    this.scene.add(new THREE.GridHelper(20, 20, 0x334466, 0x1a2340));
    this.scene.add(this.pointRoot, this.lineRoot, this.dragProxy);

    // Ukuran titik dibuat kecil dan tetap; skala model bisa sangat berbeda
    // antar objek, jadi ukurannya disesuaikan saat model dimuat.
    this.pointGeometry = new THREE.SphereGeometry(1, 16, 12);
    this.pointMaterial = new THREE.MeshBasicMaterial({ color: POINT_COLOR });
    this.selectedMaterial = new THREE.MeshBasicMaterial({ color: POINT_SELECTED });

    this.orbit = new OrbitControls(this.camera, this.renderer.domElement);
    this.orbit.enableDamping = true;

    this.gizmo = new TransformControls(this.camera, this.renderer.domElement);
    this.gizmo.addEventListener('dragging-changed', (event) => {
      // Orbit dimatikan selama menyeret, kalau tidak kamera ikut berputar.
      this.orbit.enabled = !event.value;
    });
    this.gizmo.addEventListener('objectChange', () => {
      for (const [id, offset] of this.dragOffsets) {
        const point = this.points.find((p) => p.id === id);
        point?.mesh.position.copy(this.dragProxy.position).add(offset);
      }
      this.refreshLines();
      this.events.onPointMoved();
    });
    this.scene.add(this.gizmo.getHelper());

    this.renderer.domElement.addEventListener('pointerdown', (event) => {
      this.pointerDownAt = { x: event.clientX, y: event.clientY };
    });
    this.renderer.domElement.addEventListener('pointerup', (event) => this.handleClick(event));

    window.addEventListener('resize', () => this.resize());
    this.resize();
    this.renderer.setAnimationLoop(() => this.tick());
  }

  async load(object: ObjectData): Promise<void> {
    this.clear();

    if (object.modelUrl) {
      this.model = await this.models.load(object.modelUrl);
      this.scene.add(this.model);
    }

    // Kamera dan ukuran titik mengikuti besar model, supaya objek sebesar
    // apa pun langsung terlihat utuh tanpa perlu diatur manual.
    const box = new THREE.Box3().setFromObject(this.model ?? this.scene);
    const size = box.getSize(new THREE.Vector3()).length() || 5;
    const center = box.getCenter(new THREE.Vector3());

    this.orbit.target.copy(center);
    this.camera.position.copy(center).add(new THREE.Vector3(size * 0.6, size * 0.4, size * 0.8));
    this.camera.near = size / 1000;
    this.camera.far = size * 20;
    this.camera.updateProjectionMatrix();
    this.gizmo.setSize(0.8);

    const radius = size * 0.012;
    for (const point of object.points) {
      this.spawnPoint(point.id, new THREE.Vector3(...point.position), radius);
    }
    this.measurements = object.measurements.map((m) => ({ ...m }));
    this.refreshLines();
    this.events.onPointsChanged();
  }

  /**
   * Memindahkan kamera ke salah satu sudut pandang baku.
   *
   * Jaraknya dihitung dari bidang yang benar-benar terlihat pada arah itu,
   * bukan dari satu angka pukul rata: dipandang dari depan yang menentukan
   * adalah lebar dan tinggi, dari atas lebar dan kedalaman. Memakai ukuran
   * yang sama untuk semua arah membuat objek pipih tampak jauh sekali dari
   * satu sisi dan terpotong dari sisi lain.
   */
  setView(view: EditorView): void {
    const box = new THREE.Box3().setFromObject(this.model ?? this.pointRoot);
    if (box.isEmpty()) return;

    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());

    // Arah pandang, dan dua sisi kotak yang melintang terhadap arah itu.
    const setups: Record<EditorView, { dir: THREE.Vector3; span: [number, number] }> = {
      // Tegak lurus dari atas, seperti kamera HP yang diarahkan ke kartu.
      // Geseran kecil pada z menghindari arah pandang yang sejajar sumbu
      // atas kamera — pada titik itu arah "atas" layar tidak tertentu.
      atas: { dir: new THREE.Vector3(0, 1, 0.0001), span: [size.x, size.z] },
      depan: { dir: new THREE.Vector3(0, 0, 1), span: [size.x, size.y] },
      belakang: { dir: new THREE.Vector3(0, 0, -1), span: [size.x, size.y] },
      kanan: { dir: new THREE.Vector3(1, 0, 0), span: [size.z, size.y] },
      kiri: { dir: new THREE.Vector3(-1, 0, 0), span: [size.z, size.y] },
      perspektif: {
        dir: new THREE.Vector3(0.6, 0.45, 0.8),
        span: [Math.max(size.x, size.z), Math.max(size.y, size.z)],
      },
    };

    const { dir, span } = setups[view];
    this.orbit.target.copy(center);
    this.camera.position.copy(center).addScaledVector(dir.normalize(), this.fitDistance(...span));
    this.orbit.update();
  }

  /** Jarak kamera terkecil yang masih memuat sebuah bidang selebar w dan setinggi h. */
  private fitDistance(width: number, height: number): number {
    const vertical = THREE.MathUtils.degToRad(this.camera.fov);
    const horizontal = 2 * Math.atan(Math.tan(vertical / 2) * this.camera.aspect);
    const byHeight = height / 2 / Math.tan(vertical / 2);
    const byWidth = width / 2 / Math.tan(horizontal / 2);
    // Sisa 20% supaya titik di tepi tidak menempel di pinggir layar.
    return Math.max(byHeight, byWidth, 0.001) * 1.2;
  }

  /**
   * Menskalakan dan memusatkan seluruh titik sekaligus agar sebesar mungkin
   * di dalam model, tanpa mengubah susunannya.
   *
   * Untuk titik warisan Unity yang skalanya jauh berbeda, menyeret satu per
   * satu melelahkan dan tidak akurat. Ini memberi titik awal yang wajar;
   * penyesuaian halus tetap dilakukan tangan sesudahnya.
   *
   * Skalanya diambil dari sumbu yang paling membatasi, supaya titik tidak
   * pernah keluar dari model.
   */
  fitPointsToModel(): boolean {
    if (!this.model || this.points.length < 2) return false;

    const target = new THREE.Box3().setFromObject(this.model);
    const current = new THREE.Box3();
    for (const point of this.points) current.expandByPoint(point.mesh.position);

    const targetSize = target.getSize(new THREE.Vector3());
    const currentSize = current.getSize(new THREE.Vector3());

    let scale = Infinity;
    for (const axis of ['x', 'y', 'z'] as const) {
      if (currentSize[axis] > 1e-6) {
        scale = Math.min(scale, targetSize[axis] / currentSize[axis]);
      }
    }
    if (!Number.isFinite(scale) || scale <= 0) return false;

    const from = current.getCenter(new THREE.Vector3());
    const to = target.getCenter(new THREE.Vector3());
    for (const point of this.points) {
      point.mesh.position.sub(from).multiplyScalar(scale).add(to);
    }

    this.syncGizmo();
    this.refreshLines();
    this.events.onPointMoved();
    return true;
  }

  get pointIds(): string[] {
    return this.points.map((p) => p.id);
  }

  /** Titik-titik yang sedang dipilih; semuanya ikut bergerak bersama gizmo. */
  get selectedIds(): readonly string[] {
    return this.selection;
  }

  getPoints(): { id: string; position: Vec3 }[] {
    return this.points.map((p) => ({
      id: p.id,
      position: [
        round(p.mesh.position.x),
        round(p.mesh.position.y),
        round(p.mesh.position.z),
      ],
    }));
  }

  getMeasurements(): MeasurementDef[] {
    return this.measurements.map((m) => ({ ...m }));
  }

  setMeasurements(list: MeasurementDef[]): void {
    this.measurements = list.map((m) => ({ ...m }));
    this.refreshLines();
  }

  /** Memindahkan titik ke koordinat yang diketik. */
  setPosition(id: string, position: Vec3): void {
    const point = this.points.find((p) => p.id === id);
    if (!point) return;

    point.mesh.position.set(...position);
    this.syncGizmo();
    this.refreshLines();
    this.events.onPointMoved();
  }

  /** Jarak antar dua titik dalam satuan model. */
  distance(fromId: string, toId: string): number {
    const from = this.points.find((p) => p.id === fromId);
    const to = this.points.find((p) => p.id === toId);
    if (!from || !to) return 0;
    return from.mesh.position.distanceTo(to.mesh.position);
  }

  /**
   * `additive` (Shift) menambah atau membuang satu titik dari pilihan yang
   * sudah ada, bukan menggantinya. Menyeret delapan sudut sekaligus jauh
   * lebih cepat daripada delapan kali pilih-seret, dan yang lebih penting:
   * jarak antar titiknya dijamin tidak berubah.
   */
  select(id: string | null, additive = false): void {
    if (id === null) this.selection = [];
    else if (!additive) this.selection = [id];
    else if (this.selection.includes(id)) this.selection = this.selection.filter((x) => x !== id);
    else this.selection = [...this.selection, id];

    this.applySelection();
  }

  selectMany(ids: string[]): void {
    const known = new Set(this.pointIds);
    this.selection = ids.filter((id) => known.has(id));
    this.applySelection();
  }

  private applySelection(): void {
    const chosen = this.points.filter((p) => this.selection.includes(p.id));
    for (const point of this.points) {
      point.mesh.material = this.selection.includes(point.id)
        ? this.selectedMaterial
        : this.pointMaterial;
    }

    this.syncGizmo(chosen);
    this.events.onSelectionChanged([...this.selection]);
  }

  /**
   * Menaruh benda bantu di titik tengah pilihan dan mencatat jarak tiap
   * titik terhadapnya. Harus diulang setiap kali titik berpindah karena
   * sebab lain — koordinat yang diketik, atau sebaran ulang — kalau tidak,
   * seretan berikutnya akan melompat balik ke susunan yang lama.
   */
  private syncGizmo(chosen = this.points.filter((p) => this.selection.includes(p.id))): void {
    this.dragOffsets.clear();
    if (chosen.length === 0) {
      this.gizmo.detach();
      return;
    }

    const center = new THREE.Vector3();
    for (const point of chosen) center.add(point.mesh.position);
    center.divideScalar(chosen.length);

    this.dragProxy.position.copy(center);
    for (const point of chosen) {
      this.dragOffsets.set(point.id, point.mesh.position.clone().sub(center));
    }
    this.gizmo.attach(this.dragProxy);
  }

  rename(oldId: string, newId: string): boolean {
    if (!newId || this.points.some((p) => p.id === newId)) return false;

    const point = this.points.find((p) => p.id === oldId);
    if (!point) return false;

    point.id = newId;
    point.label.element.textContent = newId;
    for (const m of this.measurements) {
      if (m.from === oldId) m.from = newId;
      if (m.to === oldId) m.to = newId;
    }
    this.selection = this.selection.map((x) => (x === oldId ? newId : x));
    const moved = this.dragOffsets.get(oldId);
    if (moved) {
      this.dragOffsets.delete(oldId);
      this.dragOffsets.set(newId, moved);
    }

    this.refreshLines();
    this.events.onPointsChanged();
    return true;
  }

  remove(id: string): void {
    const index = this.points.findIndex((p) => p.id === id);
    if (index < 0) return;

    const [point] = this.points.splice(index, 1);
    point.label.element.remove();
    point.mesh.removeFromParent();
    point.label.removeFromParent();

    // Garis yang menggantung tanpa titik akan menolak dimuat aplikasi,
    // jadi ikut dibuang.
    this.measurements = this.measurements.filter((m) => m.from !== id && m.to !== id);

    if (this.selection.includes(id)) {
      this.selection = this.selection.filter((x) => x !== id);
      this.applySelection();
    }
    this.refreshLines();
    this.events.onPointsChanged();
  }

  dispose(): void {
    this.clear();
    this.gizmo.dispose();
    this.orbit.dispose();
    this.models.dispose();
    this.pointGeometry.dispose();
    this.pointMaterial.dispose();
    this.selectedMaterial.dispose();
    this.lineMaterial.dispose();
    this.renderer.dispose();
  }

  private clear(): void {
    this.select(null);
    for (const point of this.points) {
      point.label.element.remove();
      point.mesh.removeFromParent();
      point.label.removeFromParent();
    }
    this.points = [];
    this.measurements = [];
    this.lineRoot.clear();
    this.model?.removeFromParent();
    this.model = null;
  }

  private spawnPoint(id: string, position: THREE.Vector3, radius: number): void {
    const mesh = new THREE.Mesh(this.pointGeometry, this.pointMaterial);
    mesh.position.copy(position);
    mesh.scale.setScalar(radius);

    const element = document.createElement('div');
    element.className = 'editor-point-label';
    element.textContent = id;
    const label = new CSS2DObject(element);
    label.position.set(0, 1.6, 0);

    mesh.add(label);
    this.pointRoot.add(mesh);
    this.points.push({ id, mesh, label });
  }

  /** Id berikutnya: A, B, ... Z, lalu A1, B1, ... */
  private nextId(): string {
    const used = new Set(this.pointIds);
    for (let round = 0; round < 100; round++) {
      for (let i = 0; i < 26; i++) {
        const id = String.fromCharCode(65 + i) + (round === 0 ? '' : String(round));
        if (!used.has(id)) return id;
      }
    }
    return `P${used.size}`;
  }

  private handleClick(event: PointerEvent): void {
    // Membedakan klik dari memutar kamera: geseran kecil dianggap klik.
    const moved =
      Math.abs(event.clientX - this.pointerDownAt.x) +
      Math.abs(event.clientY - this.pointerDownAt.y);
    if (moved > 5 || this.gizmo.dragging) return;

    const rect = this.renderer.domElement.getBoundingClientRect();
    this.pointer.set(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1,
    );
    this.raycaster.setFromCamera(this.pointer, this.camera);

    // Titik diperiksa lebih dulu supaya bisa dipilih walau menempel di model.
    const onPoint = this.raycaster.intersectObjects(this.pointRoot.children, false);
    if (onPoint.length > 0) {
      const hit = this.points.find((p) => p.mesh === onPoint[0].object);
      if (hit) this.select(hit.id, event.shiftKey);
      return;
    }

    // Shift di ruang kosong tidak mengosongkan pilihan: menahan Shift sambil
    // memilih beberapa titik gampang meleset, dan kehilangan seluruh pilihan
    // karena satu klik luput itu menjengkelkan.
    if (this.mode !== 'tambah' || !this.model) {
      if (!event.shiftKey) this.select(null);
      return;
    }

    const onModel = this.raycaster.intersectObject(this.model, true);
    if (onModel.length === 0) return;

    const radius = this.points[0]?.mesh.scale.x ?? 0.05;
    const id = this.nextId();
    this.spawnPoint(id, onModel[0].point, radius);
    this.select(id);
    this.events.onPointsChanged();
  }

  private refreshLines(): void {
    this.lineRoot.clear();

    for (const measurement of this.measurements) {
      if (measurement.from === measurement.to) continue;
      const from = this.points.find((p) => p.id === measurement.from);
      const to = this.points.find((p) => p.id === measurement.to);
      if (!from || !to) continue;

      const geometry = new THREE.BufferGeometry().setFromPoints([
        from.mesh.position,
        to.mesh.position,
      ]);
      this.lineRoot.add(new THREE.Line(geometry, this.lineMaterial));
    }
  }

  private resize(): void {
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;
    if (width === 0 || height === 0) return;

    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
    this.labelRenderer.setSize(width, height);
  }

  private tick(): void {
    this.orbit.update();
    this.renderer.render(this.scene, this.camera);
    this.labelRenderer.render(this.scene, this.camera);
  }
}

/** Lima desimal sudah jauh lebih halus daripada ketelitian penempatan tangan. */
const round = (value: number): number => Number(value.toFixed(5));
