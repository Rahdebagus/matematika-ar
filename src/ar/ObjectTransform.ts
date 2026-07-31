import * as THREE from 'three';

const MIN_SCALE = 0.35;
const MAX_SCALE = 3;
/** Radian per piksel geseran mendatar. */
const ROTATE_SENSITIVITY = 0.008;

/**
 * Gestur untuk memutar dan memperbesar objek di atas marker.
 *
 * - satu jari digeser mendatar : putar pada sumbu tegak objek
 * - dua jari dicubit           : perbesar / perkecil
 * - roda tetikus               : perbesar / perkecil (untuk uji di laptop)
 *
 * Listener dipasang di canvas 3D, bukan di container, supaya sentuhan pada
 * tombol overlay tidak ikut memutar objek.
 *
 * Kondisi transform disimpan di objek pivot itu sendiri, bukan di class ini.
 * Dengan begitu putaran pengguna tidak hilang saat marker sempat lepas dari
 * pandangan lalu terlihat lagi.
 */
export class ObjectTransform {
  private readonly surface: HTMLElement;
  private readonly pointers = new Map<number, { x: number; y: number }>();

  private pivot: THREE.Object3D | null = null;
  private pinchDistance = 0;

  private readonly onPointerDown = (event: PointerEvent) => {
    this.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (this.pointers.size === 2) this.pinchDistance = this.distance();
    this.surface.setPointerCapture(event.pointerId);
  };

  private readonly onPointerMove = (event: PointerEvent) => {
    const previous = this.pointers.get(event.pointerId);
    if (!previous || !this.pivot) return;

    const current = { x: event.clientX, y: event.clientY };
    this.pointers.set(event.pointerId, current);

    if (this.pointers.size === 1) {
      this.pivot.rotation.y += (current.x - previous.x) * ROTATE_SENSITIVITY;
      return;
    }

    if (this.pointers.size === 2 && this.pinchDistance > 0) {
      const distance = this.distance();
      this.applyScale(this.pivot.scale.x * (distance / this.pinchDistance));
      this.pinchDistance = distance;
    }
  };

  private readonly onPointerUp = (event: PointerEvent) => {
    this.pointers.delete(event.pointerId);
    // Cubitan yang berubah jadi satu jari harus mulai ulang jaraknya,
    // kalau tidak objek akan meloncat ukurannya.
    this.pinchDistance = this.pointers.size === 2 ? this.distance() : 0;
  };

  private readonly onWheel = (event: WheelEvent) => {
    if (!this.pivot) return;
    event.preventDefault();
    this.applyScale(this.pivot.scale.x * (event.deltaY < 0 ? 1.08 : 1 / 1.08));
  };

  constructor(surface: HTMLElement) {
    this.surface = surface;
    surface.addEventListener('pointerdown', this.onPointerDown);
    surface.addEventListener('pointermove', this.onPointerMove);
    surface.addEventListener('pointerup', this.onPointerUp);
    surface.addEventListener('pointercancel', this.onPointerUp);
    surface.addEventListener('wheel', this.onWheel, { passive: false });
  }

  /** `null` saat tidak ada objek aktif. */
  bind(pivot: THREE.Object3D | null): void {
    this.pivot = pivot;
    this.pointers.clear();
    this.pinchDistance = 0;
  }

  reset(): void {
    if (!this.pivot) return;
    this.pivot.rotation.y = 0;
    this.pivot.scale.setScalar(1);
  }

  dispose(): void {
    this.surface.removeEventListener('pointerdown', this.onPointerDown);
    this.surface.removeEventListener('pointermove', this.onPointerMove);
    this.surface.removeEventListener('pointerup', this.onPointerUp);
    this.surface.removeEventListener('pointercancel', this.onPointerUp);
    this.surface.removeEventListener('wheel', this.onWheel);
    this.pointers.clear();
    this.pivot = null;
  }

  private applyScale(value: number): void {
    this.pivot?.scale.setScalar(Math.min(MAX_SCALE, Math.max(MIN_SCALE, value)));
  }

  private distance(): number {
    const [a, b] = [...this.pointers.values()];
    return Math.hypot(a.x - b.x, a.y - b.y);
  }
}
