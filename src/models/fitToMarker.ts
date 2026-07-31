import * as THREE from 'three';

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

/**
 * Menyesuaikan objek ke ruang anchor marker.
 *
 * Dua sistem koordinat berbeda:
 * - Model  : Y ke atas, satuan meter (konvensi glTF dan docs/02-data-model.md).
 * - Anchor : kartu di bidang XY, **Z keluar** dari kartu, 1 unit = lebar kartu.
 *
 * `holder` memutar +90 derajat pada X (Y model -> Z anchor) lalu menskalakan.
 * `content` menggeser di ruang model — pergeseran ini terjadi SEBELUM rotasi
 * dan skala, jadi koordinat titik dari JSON tetap apa adanya.
 *
 * @param widthFraction 1 = tapak objek selebar kartu penanda.
 */
export function fitToMarker(model: THREE.Object3D, widthFraction = 1): MarkerFit {
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

  holder.rotation.x = Math.PI / 2;
  holder.scale.setScalar(footprint > 0 ? widthFraction / footprint : 1);

  // Pusatkan XZ, dudukkan alas di Y = 0.
  content.position.set(-center.x, -box.min.y, -center.z);

  return { holder, content };
}
