import { CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import type { MeasurementStyle } from '../data/types';

/**
 * Label teks di atas canvas 3D memakai CSS2D (docs/04-tech-notes.md).
 *
 * Dibanding teks yang di-render ke tekstur, cara ini selalu tajam di layar
 * HP resolusi tinggi dan gampang di-style lewat CSS.
 */
export class Label {
  readonly object: CSS2DObject;
  private readonly element: HTMLDivElement;

  constructor(text: string, style: MeasurementStyle) {
    this.element = document.createElement('div');
    this.element.className = 'measurement-label';
    this.element.textContent = text;
    this.element.style.color = style.labelColor;
    this.element.style.fontSize = `${style.labelFontSize}px`;

    this.object = new CSS2DObject(this.element);
    // Supaya label tidak menghalangi sentuhan ke tombol AR di bawahnya.
    this.element.style.pointerEvents = 'none';
  }

  setText(text: string): void {
    this.element.textContent = text;
  }

  setVisible(visible: boolean): void {
    this.object.visible = visible;
    // CSS2DRenderer tetap memindahkan elemen walau object.visible = false,
    // jadi sembunyikan lewat CSS juga.
    this.element.style.display = visible ? '' : 'none';
  }

  dispose(): void {
    this.object.removeFromParent();
    this.element.remove();
  }
}
