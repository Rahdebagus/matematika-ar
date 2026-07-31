import * as THREE from 'three';
import type { FitMode } from '../data/types';

export interface MarkerFit {
  /** Ditempel ke anchor marker. Membawa rotasi + skala. */
  holder: THREE.Group;
  /**
   * Ruang model: Y ke atas, satuan meter, sama persis dengan koordinat
   * `points` di app-data.json. Garis ukur ditambahkan ke sini agar ikut
   * berpindah dan berskala bersama model.
   */
  content: THREE.Group;
}

export interface FitOptions {
  /** Lebar kartu penanda tercetak, dalam meter. */
  markerWidthMeters: number;
  mode?: FitMode;
  /** Pengali tambahan setelah skala dasar dihitung. */
  scale?: number;
}

/**
 * Menyesuaikan objek ke ruang anchor marker.
 *
 * Dua sistem koordinat berbeda:
 * - Model  : Y ke atas, satuan meter (konvensi glTF dan docs/02-data-model.md).
 * - Anchor : kartu di bidang XY, **Z keluar** dari kartu, 1 unit = lebar kartu.
 *
 * `holder` memutar +90 derajat pada X (Y model -> Z anchor) lalu menskalakan.
 * `content` menggeser di ruang model — pergeseran ini terjadi SEBELUM rotasi
 * dan skala, jadi koordinat titik dari JSON dipakai apa adanya.
 *
 * Mode `real` (default) memakai skala fisik sebenarnya, sehingga benda 15 cm
 * benar-benar tampil satu setengah kali benda 10 cm. Mode `marker-width`
 * memaksa tapak objek selebar kartu, dipakai kalau ukuran asli model tidak
 * diketahui.
 */
export function fitToMarker(model: THREE.Object3D, options: FitOptions): MarkerFit {
  const holder = new THREE.Group();
  const content = new THREE.Group();

  holder.add(content);
  content.add(model);

  // Diukur di ruang model, sebelum rotasi/skala apa pun.
  const box = new THREE.Box3().setFromObject(model);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());

  // Tapak = bidang XZ pada model Y-up.
  const footprint = Math.max(size.x, size.z);
  const mode = options.mode ?? 'real';

  let base: number;
  if (mode === 'marker-width') {
    base = footprint > 0 ? 1 / footprint : 1;
  } else {
    // 1 unit anchor = lebar kartu, jadi meter -> unit = 1 / lebarKartu.
    base = 1 / options.markerWidthMeters;
  }

  holder.rotation.x = Math.PI / 2;
  holder.scale.setScalar(base * (options.scale ?? 1));

  // Pusatkan XZ, dudukkan alas di Y = 0.
  content.position.set(-center.x, -box.min.y, -center.z);

  return { holder, content };
}
