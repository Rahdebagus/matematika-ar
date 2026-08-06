import * as THREE from 'three';
import type { ARSession } from '../core/ARSession';

export interface MarkerEvents {
  onFound?: (targetIndex: number) => void;
  onLost?: (targetIndex: number) => void;
}

/**
 * Memetakan `targetIndex` -> anchor `Group` di scene, dan menerjemahkan
 * matriks dari `ARSession` menjadi event found/lost.
 *
 * Isi tiap anchor ditentukan pemanggil (Fase 1: kubus; Fase 2: model .glb),
 * sehingga registry ini tidak perlu tahu soal loader.
 */
export class MarkerRegistry {
  private readonly scene: THREE.Scene;
  private readonly events: MarkerEvents;
  private readonly groups = new Map<number, THREE.Group>();
  private readonly visible = new Set<number>();
  private locked = false;

  constructor(scene: THREE.Scene, events: MarkerEvents = {}) {
    this.scene = scene;
    this.events = events;
  }

  /**
   * Buat anchor untuk satu target. Anchor tersembunyi sampai marker terlihat.
   * Isinya boleh ditambahkan belakangan (mis. setelah model selesai diunduh).
   */
  register(targetIndex: number, content?: THREE.Object3D): THREE.Group {
    const group = new THREE.Group();
    // Matriks datang dari tracking, bukan dari position/rotation lokal.
    group.matrixAutoUpdate = false;
    group.visible = false;
    if (content) group.add(content);

    this.scene.add(group);
    this.groups.set(targetIndex, group);
    return group;
  }

  /** Sambungkan ke sesi AR agar anchor ikut bergerak mengikuti marker. */
  bind(session: ARSession): void {
    session.onTargetMatrix((targetIndex, matrix) => this.apply(targetIndex, matrix));
  }

  get anyVisible(): boolean {
    return this.visible.size > 0;
  }

  /**
   * Membekukan objek di posisi terakhirnya.
   *
   * Saat terkunci, pembaruan tracking diabaikan seluruhnya: objek tetap
   * tampil walau kartu penanda sudah lepas dari pandangan. Karena matriks
   * anchor dinyatakan relatif terhadap kamera, objek yang dibekukan ikut
   * bergerak bersama HP — jadi bisa diamati sambil berjalan tanpa harus
   * terus mengarahkan kamera ke kartu.
   */
  setLocked(locked: boolean): void {
    this.locked = locked;
  }

  get isLocked(): boolean {
    return this.locked;
  }

  /**
   * Sembunyikan semua anchor. Dipakai saat keluar dari layar AR: tanpa ini
   * objek yang terakhir terlihat masih tergambar saat kamera sudah mati.
   */
  hideAll(): void {
    // Kunci ikut dilepas: keluar dari layar AR selalu mengembalikan keadaan
    // bersih, bukan meninggalkan objek beku yang muncul lagi nanti.
    this.locked = false;

    for (const [targetIndex, group] of this.groups) {
      group.visible = false;
      if (this.visible.delete(targetIndex)) {
        this.events.onLost?.(targetIndex);
      }
    }
  }

  dispose(): void {
    for (const group of this.groups.values()) {
      group.traverse((object) => {
        if (!(object instanceof THREE.Mesh)) return;
        object.geometry.dispose();
        const material: THREE.Material | THREE.Material[] = object.material;
        if (Array.isArray(material)) {
          material.forEach((m) => m.dispose());
        } else {
          material.dispose();
        }
      });
      this.scene.remove(group);
    }
    this.groups.clear();
    this.visible.clear();
  }

  private apply(targetIndex: number, matrix: THREE.Matrix4 | null): void {
    // Terkunci: posisi terakhir dipertahankan, termasuk saat marker hilang.
    if (this.locked) return;

    const group = this.groups.get(targetIndex);
    if (!group) return;

    if (matrix === null) {
      group.visible = false;
      if (this.visible.delete(targetIndex)) {
        this.events.onLost?.(targetIndex);
      }
      return;
    }

    // matrix milik ARSession dipakai ulang tiap frame — harus disalin.
    group.matrix.copy(matrix);
    group.matrixWorldNeedsUpdate = true;
    group.visible = true;

    if (!this.visible.has(targetIndex)) {
      this.visible.add(targetIndex);
      this.events.onFound?.(targetIndex);
    }
  }
}
