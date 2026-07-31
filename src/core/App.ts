import * as THREE from 'three';

/** Modul yang perlu dipanggil tiap frame oleh render loop App. */
export interface Updatable {
  update(delta: number): void;
}

/**
 * Bootstrap aplikasi: scene, kamera, renderer, dan **render loop tunggal**.
 *
 * Modul lain (AR, measurement, UI) menempel ke `scene` dan mendaftarkan diri
 * lewat `addUpdatable()` bila butuh dipanggil tiap frame — lihat
 * `docs/01-architecture.md` dan `docs/08-conventions.md`.
 */
export class App {
  readonly scene: THREE.Scene;
  readonly camera: THREE.PerspectiveCamera;
  readonly renderer: THREE.WebGLRenderer;

  private readonly container: HTMLElement;
  private readonly clock = new THREE.Clock();
  private readonly updatables = new Set<Updatable>();
  private readonly handleResize = () => this.resize();
  private running = false;

  /** Objek uji Fase 0. Diganti model di atas marker pada Fase 1–2. */
  private cube: THREE.Mesh<THREE.BoxGeometry, THREE.MeshStandardMaterial> | null = null;

  constructor(container: HTMLElement) {
    this.container = container;

    this.scene = new THREE.Scene();

    // Semua posisi dalam meter, jadi near/far dibuat kecil.
    this.camera = new THREE.PerspectiveCamera(60, 1, 0.01, 100);
    this.camera.position.set(0, 0.25, 0.7);
    this.camera.lookAt(0, 0, 0);

    // alpha: true — nanti feed kamera terlihat di belakang canvas (Fase 1).
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    // Batasi pixel ratio demi performa HP (docs/04-tech-notes.md).
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.container.appendChild(this.renderer.domElement);

    this.addLights();
    this.addTestCube();
    this.resize();

    window.addEventListener('resize', this.handleResize);
  }

  /** Mulai render loop. */
  start(): void {
    if (this.running) return;
    this.running = true;
    this.clock.start();
    this.renderer.setAnimationLoop(() => this.tick());
  }

  /** Hentikan render loop tanpa melepas resource. */
  stop(): void {
    if (!this.running) return;
    this.running = false;
    this.renderer.setAnimationLoop(null);
    this.clock.stop();
  }

  addUpdatable(target: Updatable): void {
    this.updatables.add(target);
  }

  removeUpdatable(target: Updatable): void {
    this.updatables.delete(target);
  }

  /** Lepas semua resource Three.js dan listener (docs/08-conventions.md). */
  dispose(): void {
    this.stop();
    window.removeEventListener('resize', this.handleResize);
    this.updatables.clear();

    if (this.cube) {
      this.cube.geometry.dispose();
      this.cube.material.dispose();
      this.scene.remove(this.cube);
      this.cube = null;
    }

    this.renderer.dispose();
    this.renderer.domElement.remove();
  }

  private tick(): void {
    const delta = this.clock.getDelta();

    if (this.cube) {
      this.cube.rotation.x += delta * 0.6;
      this.cube.rotation.y += delta * 0.9;
    }

    for (const target of this.updatables) {
      target.update(delta);
    }

    this.renderer.render(this.scene, this.camera);
  }

  private resize(): void {
    const width = this.container.clientWidth || window.innerWidth;
    const height = this.container.clientHeight || window.innerHeight;

    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
  }

  private addLights(): void {
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x334466, 2.0));

    const sun = new THREE.DirectionalLight(0xffffff, 1.5);
    sun.position.set(1, 2, 1);
    this.scene.add(sun);
  }

  private addTestCube(): void {
    // 10 cm — seukuran objek yang nanti berdiri di atas kartu penanda.
    const geometry = new THREE.BoxGeometry(0.1, 0.1, 0.1);
    const material = new THREE.MeshStandardMaterial({
      color: 0x4f8cff,
      roughness: 0.35,
      metalness: 0.1,
    });

    this.cube = new THREE.Mesh(geometry, material);
    this.scene.add(this.cube);
  }
}
