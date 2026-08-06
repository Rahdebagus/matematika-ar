import { App } from '../core/App';
import { ARSession } from '../core/ARSession';
import { MarkerRegistry } from './MarkerRegistry';
import { AnchorController } from './AnchorController';
import { ObjectTransform } from './ObjectTransform';
import { ModelLoader } from '../models/ModelLoader';
import { loadAppData } from '../data/loadAppData';
import type { AROverlay } from '../ui/AROverlay';

export interface ArSceneOptions {
  container: HTMLDivElement;
  overlay: AROverlay;
  dataUrl?: string;
}

/**
 * Seluruh tumpukan AR dalam satu modul: Three.js, MindAR, model, dan
 * measurement.
 *
 * Dipisah dari `main.ts` supaya bisa di-import secara dinamis. Menu, Panduan,
 * dan Tentang tidak memerlukan satu byte pun dari Three.js atau TensorFlow,
 * jadi tidak masuk akal memaksa anak mengunduh ~1,7 MB hanya untuk melihat
 * layar menu. Modul ini baru diambil saat pengguna benar-benar membuka AR.
 */
export class ArScene {
  private readonly app: App;
  private readonly session: ARSession;
  private readonly registry: MarkerRegistry;
  private readonly transform: ObjectTransform;
  private readonly models: ModelLoader;
  private readonly anchors: Map<number, AnchorController>;
  private readonly overlay: AROverlay;
  private readonly container: HTMLDivElement;

  static async create(options: ArSceneOptions): Promise<ArScene> {
    const data = await loadAppData(options.dataUrl ?? '/data/app-data.json');
    return new ArScene(options, data);
  }

  private constructor(
    { container, overlay }: ArSceneOptions,
    data: Awaited<ReturnType<typeof loadAppData>>,
  ) {
    this.container = container;
    this.overlay = overlay;

    this.app = new App(container);
    this.app.setBloom(data.bloom.enabled ? data.bloom : null);
    this.app.start();

    this.session = new ARSession({
      container,
      camera: this.app.camera,
      targetsUrl: data.targetsUrl,
      // Multi-marker dilewati atas permintaan; naikkan angka ini bila perlu.
      maxTrack: 1,
    });

    this.models = new ModelLoader();
    this.anchors = new Map();

    // Dipasang di canvas, bukan container: sentuhan pada tombol overlay
    // tidak boleh ikut memutar objek.
    this.transform = new ObjectTransform(this.app.renderer.domElement, this.app.camera);
    overlay.setResetHook(() => this.transform.reset());
    overlay.setLockHook((locked) => this.registry.setLocked(locked));

    this.registry = new MarkerRegistry(this.app.scene, {
      onFound: (targetIndex) => {
        const anchor = this.anchors.get(targetIndex);
        if (!anchor) return;

        overlay.setStatus(`${anchor.object.displayName} terdeteksi`);
        void this.showAnchor(anchor);
      },
      onLost: () => {
        // Tombol dimatikan supaya tidak ada aksi tanpa objek aktif.
        overlay.bind(null);
        this.transform.bind(null);
        overlay.setStatus('Arahkan kamera ke kartu penanda');
      },
    });

    for (const object of data.objects) {
      this.anchors.set(
        object.targetIndex,
        new AnchorController(
          this.registry.register(object.targetIndex),
          object,
          data.defaultStyle,
          this.models,
          data.markerWidthMeters,
        ),
      );
    }

    // Tanpa ini anchor tidak pernah menerima matriks tracking: objek tetap
    // tersembunyi dan onFound tidak pernah jalan.
    this.registry.bind(this.session);

    this.app.addResizeHandler(() => {
      this.session.syncCamera();
      this.syncResolution();
    });
  }

  async start(): Promise<void> {
    await this.session.start();
  }

  stop(): void {
    this.session.stop();
    this.registry.hideAll();
    this.overlay.bind(null);
    this.transform.bind(null);
  }

  dispose(): void {
    this.session.dispose();
    for (const anchor of this.anchors.values()) anchor.dispose();
    this.registry.dispose();
    this.transform.dispose();
    this.models.dispose();
    this.app.dispose();
  }

  private syncResolution(): void {
    for (const anchor of this.anchors.values()) {
      anchor.measurements?.setResolution(
        this.container.clientWidth,
        this.container.clientHeight,
      );
    }
  }

  /** Isi anchor dimuat saat markernya pertama terlihat, bukan di awal. */
  private async showAnchor(anchor: AnchorController): Promise<void> {
    try {
      await anchor.load();
      this.syncResolution();

      // Transparansi dianimasikan, jadi controller ikut render loop.
      const measurements = anchor.measurements;
      if (measurements) this.app.addUpdatable(measurements);

      this.overlay.bind(measurements);
      this.transform.bind(anchor.pivot);
    } catch (error) {
      this.overlay.setStatus(`Gagal memuat ${anchor.object.displayName}`);
      console.error(error);
    }
  }
}
