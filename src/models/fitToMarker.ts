import * as THREE from 'three';

/**
 * Menyesuaikan model .glb ke ruang anchor marker.
 *
 * Dua sistem koordinat berbeda:
 * - glTF  : Y ke atas, satuan meter dunia nyata.
 * - Anchor: kartu terletak di bidang XY, **Z keluar** dari kartu,
 *           dan 1 unit = lebar kartu.
 *
 * Maka model diputar +90 derajat pada sumbu X (Y -> Z), diskalakan agar
 * tapaknya sebesar `widthFraction` kali lebar kartu, lalu digeser supaya
 * alasnya duduk tepat di permukaan kartu dan terpusat.
 *
 * @param widthFraction 1 = selebar kartu penanda.
 */
export function fitToMarker(model: THREE.Object3D, widthFraction = 1): THREE.Group {
  const holder = new THREE.Group();

  model.rotation.x = Math.PI / 2;
  holder.add(model);

  // Ukur setelah rotasi — tapak model kini ada di bidang XY, tinggi di Z.
  const box = new THREE.Box3().setFromObject(model);
  const size = box.getSize(new THREE.Vector3());
  const footprint = Math.max(size.x, size.y);

  if (footprint > 0) {
    model.scale.multiplyScalar(widthFraction / footprint);
  }

  // Ukur ulang setelah skala, lalu pusatkan XY dan duduk kan di Z = 0.
  const scaled = new THREE.Box3().setFromObject(model);
  const center = scaled.getCenter(new THREE.Vector3());
  model.position.x -= center.x;
  model.position.y -= center.y;
  model.position.z -= scaled.min.z;

  return holder;
}
