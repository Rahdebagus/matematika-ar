import * as THREE from 'three';
import type { MeasurementStyle } from '../data/types';

/**
 * Warna garis ukur, dinaikkan kecerahannya sesuai `style.glow`.
 *
 * Hasilnya bisa melebihi 1 per kanal. Itu disengaja: buffer composer
 * menyimpan angka pecahan, jadi kelebihannya bertahan sampai UnrealBloomPass
 * membandingkannya dengan ambang. OutputPass di ujung yang memampatkannya
 * kembali ke rentang layar.
 */
export function glowColor(style: MeasurementStyle): THREE.Color {
  const color = new THREE.Color(style.lineColor);
  const amount = style.glow ?? 0.5;
  return amount > 0.5 ? color.multiplyScalar(amount) : color;
}
