import * as THREE from 'three';
import { Controller } from 'mind-ar/src/image-target/controller.js';

/** Dipanggil tiap update tracking. `matrix === null` berarti target hilang. */
export type TargetMatrixHandler = (targetIndex: number, matrix: THREE.Matrix4 | null) => void;

export interface ARSessionOptions {
  container: HTMLElement;
  /** Kamera milik App — proyeksinya disetel ulang agar cocok dengan feed kamera. */
  camera: THREE.PerspectiveCamera;
  /** URL .mind hasil `npm run compile:targets`. */
  targetsUrl: string;
  /** Jumlah target yang dilacak bersamaan. Naikkan di Fase 7. */
  maxTrack?: number;
}

/**
 * Siklus hidup MindAR: menyalakan kamera, menjalankan `Controller`, dan
 * menyelaraskan proyeksi kamera Three.js dengan feed video.
 *
 * Sengaja dibangun di atas `Controller` (bukan `MindARThree`) supaya render
 * loop tetap tunggal di `App` — lihat `docs/08-conventions.md`.
 */
export class ARSession {
  private readonly container: HTMLElement;
  private readonly camera: THREE.PerspectiveCamera;
  private readonly targetsUrl: string;
  private readonly maxTrack: number;

  private readonly scratch = new THREE.Matrix4();
  private postMatrices: THREE.Matrix4[] = [];

  private controller: Controller | null = null;
  private video: HTMLVideoElement | null = null;
  private handler: TargetMatrixHandler | null = null;
  private running = false;

  constructor({ container, camera, targetsUrl, maxTrack = 1 }: ARSessionOptions) {
    this.container = container;
    this.camera = camera;
    this.targetsUrl = targetsUrl;
    this.maxTrack = maxTrack;
  }

  get isRunning(): boolean {
    return this.running;
  }

  onTargetMatrix(handler: TargetMatrixHandler): void {
    this.handler = handler;
  }

  async start(): Promise<void> {
    if (this.running) return;

    const video = await this.startVideo();
    this.video = video;

    const controller = new Controller({
      inputWidth: video.videoWidth,
      inputHeight: video.videoHeight,
      maxTrack: this.maxTrack,
      onUpdate: (data) => {
        if (data.type !== 'updateMatrix' || !this.handler) return;

        const { targetIndex, worldMatrix } = data;
        if (worldMatrix === null) {
          this.handler(targetIndex, null);
          return;
        }

        // postMatrix menskalakan unit marker -> meter dan memusatkan origin.
        this.scratch.fromArray(worldMatrix).multiply(this.postMatrices[targetIndex]);
        this.handler(targetIndex, this.scratch);
      },
    });
    this.controller = controller;

    const { dimensions } = await controller.addImageTargets(this.targetsUrl);
    this.postMatrices = dimensions.map(([markerWidth, markerHeight]) =>
      new THREE.Matrix4().compose(
        new THREE.Vector3(
          markerWidth / 2,
          markerWidth / 2 + (markerHeight - markerWidth) / 2,
          0,
        ),
        new THREE.Quaternion(),
        new THREE.Vector3(markerWidth, markerWidth, markerWidth),
      ),
    );

    this.syncCamera();
    controller.dummyRun(video);
    controller.processVideo(video);
    this.running = true;
  }

  stop(): void {
    if (!this.running) return;
    this.running = false;

    this.controller?.stopProcessVideo();

    const stream = this.video?.srcObject;
    if (stream instanceof MediaStream) {
      stream.getTracks().forEach((track) => track.stop());
    }
    this.video?.remove();
    this.video = null;
  }

  dispose(): void {
    this.stop();
    this.controller?.dispose();
    this.controller = null;
    this.handler = null;
    this.postMatrices = [];
  }

  /**
   * Samakan fov/near/far kamera dengan proyeksi MindAR, lalu skalakan video
   * agar menutupi container (cover, bukan stretch). Panggil tiap resize.
   */
  syncCamera(): void {
    const { controller, video, container, camera } = this;
    if (!controller || !video) return;

    video.setAttribute('width', String(video.videoWidth));
    video.setAttribute('height', String(video.videoHeight));

    const containerWidth = container.clientWidth;
    const containerHeight = container.clientHeight;
    const containerRatio = containerWidth / containerHeight;
    const inputRatio = controller.inputWidth / controller.inputHeight;
    const proj = controller.getProjectionMatrix();

    // Saat HP diputar, lebar/tinggi video tertukar — koreksi fov-nya.
    let videoDisplayHeight: number;
    if (inputRatio > containerRatio) {
      videoDisplayHeight = containerHeight * (video.width / controller.inputWidth);
    } else {
      videoDisplayHeight =
        ((containerWidth / controller.inputWidth) * controller.inputHeight) *
        (video.height / controller.inputHeight);
    }
    const fovAdjust = containerHeight / videoDisplayHeight;

    camera.fov = ((2 * Math.atan((1 / proj[5]) * fovAdjust)) * 180) / Math.PI;
    camera.near = proj[14] / (proj[10] - 1.0);
    camera.far = proj[14] / (proj[10] + 1.0);
    camera.aspect = containerRatio;
    camera.updateProjectionMatrix();

    // Video di-"cover": sisi yang berlebih digeser keluar layar.
    const videoRatio = video.videoWidth / video.videoHeight;
    let displayWidth: number;
    let displayHeight: number;
    if (videoRatio > containerRatio) {
      displayHeight = containerHeight;
      displayWidth = displayHeight * videoRatio;
    } else {
      displayWidth = containerWidth;
      displayHeight = displayWidth / videoRatio;
    }

    video.style.width = `${displayWidth}px`;
    video.style.height = `${displayHeight}px`;
    video.style.left = `${-(displayWidth - containerWidth) / 2}px`;
    video.style.top = `${-(displayHeight - containerHeight) / 2}px`;
  }

  private startVideo(): Promise<HTMLVideoElement> {
    return new Promise((resolve, reject) => {
      if (!navigator.mediaDevices?.getUserMedia) {
        reject(
          new Error(
            'Browser tidak mendukung kamera. Pastikan halaman dibuka lewat HTTPS.',
          ),
        );
        return;
      }

      const video = document.createElement('video');
      video.setAttribute('autoplay', '');
      video.setAttribute('muted', '');
      video.setAttribute('playsinline', '');
      video.muted = true;
      video.playsInline = true;
      video.style.position = 'absolute';
      video.style.top = '0';
      video.style.left = '0';
      video.style.zIndex = '0';
      this.container.appendChild(video);

      navigator.mediaDevices
        .getUserMedia({ audio: false, video: { facingMode: 'environment' } })
        .then((stream) => {
          video.addEventListener(
            'loadedmetadata',
            () => {
              video.setAttribute('width', String(video.videoWidth));
              video.setAttribute('height', String(video.videoHeight));
              resolve(video);
            },
            { once: true },
          );
          video.srcObject = stream;
        })
        .catch((error: unknown) => {
          video.remove();
          reject(
            new Error(
              `Tidak bisa mengakses kamera: ${
                error instanceof Error ? error.message : String(error)
              }`,
            ),
          );
        });
    });
  }
}
