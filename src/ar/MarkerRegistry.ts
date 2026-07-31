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

  constructor(scene: THREE.Scene, events: MarkerEvents = {}) {
    this.scene = scene;
    this.events = events;
  }

  /** Buat anchor untuk satu target. Anchor tersembunyi sampai marker terlihat. */
  register(targetIndex: number, content: THREE.Object3D): THREE.Group {
    const group = new THREE.Group();
    // Matriks datang dari tracking, bukan dari position/rotation lokal.
    group.matrixAutoUpdate = false;
    group.visible = false;
    group.add(content);

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
