import * as THREE from 'three';
import { CSS2DRenderer } from 'three/examples/jsm/renderers/CSS2DRenderer.js';

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
  /** Lapisan DOM untuk label ukur (docs/04-tech-notes.md). */
  readonly labelRenderer: CSS2DRenderer;

  private readonly container: HTMLElement;
  private readonly clock = new THREE.Clock();
  private readonly updatables = new Set<Updatable>();
  private readonly resizeHandlers = new Set<() => void>();
  private readonly handleResize = () => this.resize();
  private running = false;

  constructor(container: HTMLElement) {
    this.container = container;

    this.scene = new THREE.Scene();

    // Kamera tetap di origin: pose ditentukan matriks anchor dari ARSession,
    // dan fov/near/far di-override agar cocok dengan feed kamera.
    this.camera = new THREE.PerspectiveCamera(60, 1, 0.01, 100);

    // alpha: true — feed kamera terlihat di belakang canvas.
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    // Batasi pixel ratio demi performa HP (docs/04-tech-notes.md).
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setClearColor(0x000000, 0);
    this.container.appendChild(this.renderer.domElement);

    // Label ditumpuk persis di atas canvas 3D. pointer-events dimatikan
    // lewat CSS agar tombol AR di bawahnya tetap bisa ditekan.
    this.labelRenderer = new CSS2DRenderer();
    this.labelRenderer.domElement.className = 'label-layer';
    this.container.appendChild(this.labelRenderer.domElement);

    this.addLights();
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

  /** Dipanggil setelah renderer/kamera disesuaikan — dipakai ARSession. */
  addResizeHandler(handler: () => void): void {
    this.resizeHandlers.add(handler);
  }

  removeResizeHandler(handler: () => void): void {
    this.resizeHandlers.delete(handler);
  }

  /** Lepas semua resource Three.js dan listener (docs/08-conventions.md). */
  dispose(): void {
    this.stop();
    window.removeEventListener('resize', this.handleResize);
    this.updatables.clear();
    this.resizeHandlers.clear();

    this.renderer.dispose();
    this.renderer.domElement.remove();
    this.labelRenderer.domElement.remove();
  }

  private tick(): void {
    const delta = this.clock.getDelta();

    for (const target of this.updatables) {
      target.update(delta);
    }

    this.renderer.render(this.scene, this.camera);
    this.labelRenderer.render(this.scene, this.camera);
  }

  private resize(): void {
    const width = this.container.clientWidth || window.innerWidth;
    const height = this.container.clientHeight || window.innerHeight;

    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
    this.labelRenderer.setSize(width, height);

    // ARSession menimpa fov/near/far di sini agar cocok dengan feed kamera.
    for (const handler of this.resizeHandlers) {
      handler();
    }
  }

  private addLights(): void {
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x334466, 2.0));

    const sun = new THREE.DirectionalLight(0xffffff, 1.5);
    sun.position.set(1, 2, 1);
    this.scene.add(sun);
  }
}
