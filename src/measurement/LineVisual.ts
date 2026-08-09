import * as THREE from 'three';
import { Line2 } from 'three/examples/jsm/lines/Line2.js';
import { LineGeometry } from 'three/examples/jsm/lines/LineGeometry.js';
import type { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';
import { Label } from './Label';
import { glowColor } from './glow';
import type { MeasurementDef, MeasurementStyle } from '../data/types';

/**
 * Satu garis ukur: batang garis + panah di kedua ujung + label di tengah.
 *
 * Memakai Line2 dan bukan LineBasicMaterial karena banyak GPU HP mengabaikan
 * `linewidth` pada garis biasa (docs/04-tech-notes.md).
 *
 * Kalau `from === to`, ini titik tunggal: tidak ada garis maupun panah,
 * hanya label di posisi titik itu.
 */
export class LineVisual {
  readonly root = new THREE.Group();
  readonly id: string;
  readonly category: string;

  private readonly label: Label;
  private readonly geometry: LineGeometry | null = null;
  private readonly arrowGeometry: THREE.ConeGeometry | null = null;
  private readonly arrowMaterial: THREE.MeshBasicMaterial | null = null;

  constructor(
    def: MeasurementDef,
    from: THREE.Vector3,
    to: THREE.Vector3,
    style: MeasurementStyle,
    lineMaterial: LineMaterial,
  ) {
    this.id = def.id;
    this.category = def.category ?? 'default';

    const isSinglePoint = def.from === def.to;

    if (!isSinglePoint) {
      this.geometry = new LineGeometry();
      this.geometry.setPositions([from.x, from.y, from.z, to.x, to.y, to.z]);

      const line = new Line2(this.geometry, lineMaterial);
      // Line2 memakai bounding sphere sendiri untuk frustum culling.
      line.computeLineDistances();
      this.root.add(line);

      if (style.showArrows) {
        this.arrowGeometry = new THREE.ConeGeometry(
          style.arrowHalfWidth,
          style.arrowLength,
          12,
        );
        // Panah ikut menyala bersama garisnya, kalau tidak ujung garis
        // justru terlihat padam di tengah batang yang berpendar.
        this.arrowMaterial = new THREE.MeshBasicMaterial({ color: glowColor(style) });

        this.root.add(this.buildArrow(to, from));
        this.root.add(this.buildArrow(from, to));
      }
    }

    this.label = new Label(formatLabel(def), style);
    this.label.object.position.copy(
      isSinglePoint ? from : from.clone().add(to).multiplyScalar(0.5),
    );
    this.root.add(this.label.object);
  }

  setVisible(visible: boolean): void {
    this.root.visible = visible;
    // Elemen DOM label perlu disembunyikan terpisah dari graf scene.
    this.label.setVisible(visible);
  }

  get visible(): boolean {
    return this.root.visible;
  }

  dispose(): void {
    this.label.dispose();
    this.geometry?.dispose();
    this.arrowGeometry?.dispose();
    this.arrowMaterial?.dispose();
    this.root.removeFromParent();
  }

  /** Kerucut di `tip`, mengarah menjauh dari `tail`. */
  private buildArrow(tip: THREE.Vector3, tail: THREE.Vector3): THREE.Mesh {
    const arrow = new THREE.Mesh(this.arrowGeometry!, this.arrowMaterial!);
    arrow.position.copy(tip);

    // ConeGeometry mengarah ke +Y; putar agar mengikuti arah garis.
    const direction = tip.clone().sub(tail).normalize();
    arrow.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction);
    return arrow;
  }
}

function formatLabel(def: MeasurementDef): string {
  const name = def.displayName ?? def.id;
  if (def.value === undefined) return name;

  const unit = def.unit ? ` ${def.unit}` : '';
  return `${name} = ${def.value}${unit}`;
}
