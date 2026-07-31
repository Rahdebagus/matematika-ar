# 03 — Antarmuka Modul (kontrak untuk Copilot)

Implementasikan tiap class sesuai kontrak berikut. Satu class per file.

```ts
// core/Router.ts
export type ScreenId = "menu" | "ar" | "materi" | "panduan" | "tentang";
export class Router {
  show(id: ScreenId): void;          // fade transition antar-layar
  onEnter(id: ScreenId, cb: () => void): void;
  onExit(id: ScreenId, cb: () => void): void;
}

// core/ARSession.ts
export class ARSession {
  constructor(container: HTMLElement, targetsUrl: string, maxTrack: number);
  start(): Promise<void>;            // minta kamera, mulai tracking
  stop(): void;
  get renderer(): THREE.WebGLRenderer;
  get scene(): THREE.Scene;
  get camera(): THREE.Camera;
  anchor(index: number): {
    group: THREE.Group;
    onFound: (cb: () => void) => void;
    onLost: (cb: () => void) => void;
  };
}

// ar/AnchorController.ts
export class AnchorController {
  constructor(group: THREE.Group, obj: ObjectData, style: MeasurementStyle,
              deps: { models: ModelLoader; camera: THREE.Camera;
                      labelRenderer: CSS2DRenderer });
  load(): Promise<void>;             // muat model + build measurement (sekali)
  onShown(): void;
  onHidden(): void;
  readonly measurements: MeasurementController;
}

// measurement/MeasurementController.ts
export class MeasurementController {
  constructor(parent: THREE.Object3D, obj: ObjectData,
              style: MeasurementStyle, camera: THREE.Camera,
              labelRenderer: CSS2DRenderer);
  build(): void;
  showAll(): void;
  hideAll(): void;
  showCategory(category: string): void;
  showOnly(id: string): void;
  setTransparent(on: boolean): void; // fade material model
  update(): void;                    // per-frame (billboard label, posisi garis)
  dispose(): void;
}

// measurement/LineVisual.ts
export class LineVisual {
  constructor(def: MeasurementDef, from: THREE.Object3D, to: THREE.Object3D,
              style: MeasurementStyle, labelRenderer: CSS2DRenderer);
  setVisible(v: boolean): void;
  update(camera: THREE.Camera): void;
  dispose(): void;
  readonly root: THREE.Group;
  readonly category: string;
  readonly id: string;
}

// models/ModelLoader.ts
export class ModelLoader {
  load(url: string): Promise<THREE.Group>;   // cache per url
}

// ui/AROverlay.ts
export class AROverlay {
  bind(controller: MeasurementController | null): void; // objek aktif
  setStatus(text: string): void;
  // tombol memanggil: showAll/hideAll/toggleTransparent/reset/back
}

// ui/Dialog.ts
export class Dialog {
  showComingSoon(featureName: string): void;  // "Materi masih dikembangkan"
  hide(): void;
}

// audio/AudioManager.ts
export class AudioManager {
  playMusic(url: string): void;
  playClick(): void;
  setMusicVolume(v: number): void;
  toggleMute(): void;
}
```
