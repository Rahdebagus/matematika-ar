export type Vec3 = [number, number, number];

export interface PointData {
  id: string; // "A", "B", ... "P"
  position: Vec3; // lokal terhadap model, satuan meter
}

export interface MeasurementDef {
  id: string; // unik, mis. "AB"
  from: string; // point id
  to: string; // point id; from === to => titik tunggal (label saja)
  category?: string;
  symbol?: string;
  displayName?: string;
  value?: string; // diisi manual, bukan dihitung
  unit?: string;
  showPointPair?: boolean;
  visibleOnStart?: boolean;
}

export interface MeasurementStyle {
  lineColor: string;
  lineWidth: number;
  labelColor: string;
  labelFontSize: number; // px (CSS2D)
  showArrows: boolean;
  arrowLength: number;
  arrowHalfWidth: number;
  /**
   * Tambahan di luar docs/02-data-model.md.
   * false (default) = `lineWidth` dalam piksel layar — tebalnya tetap
   * terbaca berapa pun jarak kamera dan berapa pun skala model.
   * true = `lineWidth` dalam satuan dunia, sesuai teks docs.
   */
  worldUnits?: boolean;
}

/**
 * Bentuk primitif bawaan, dipakai saat `modelUrl` kosong.
 * Tambahan di luar docs: berguna untuk contoh/pengujian tanpa aset .glb.
 */
export interface PrimitiveData {
  type: 'box';
  size: Vec3; // meter
  /** < 1 membuat bentuknya tembus pandang agar garis ukur di dalamnya terlihat. */
  opacity?: number;
}

/**
 * Cara memetakan ukuran model ke ruang anchor.
 * - `real`: skala fisik sebenarnya, memakai `markerWidthMeters` sebagai acuan.
 *   Kubus 15 cm otomatis tampil 1,5x kubus 10 cm — penting untuk pelajaran ukur.
 * - `marker-width`: tapak model dipaskan ke lebar kartu. Untuk model yang
 *   ukuran aslinya tidak diketahui atau terlalu besar.
 */
export type FitMode = 'real' | 'marker-width';

export interface ObjectData {
  id: string;
  displayName: string;
  /** Kosong => pakai `primitive`. */
  modelUrl?: string | null;
  primitive?: PrimitiveData;
  targetIndex: number;
  fit?: FitMode; // default "real"
  scale?: number; // pengali tambahan
  points: PointData[];
  measurements: MeasurementDef[];
  style?: Partial<MeasurementStyle>;
}

export interface AppData {
  targetsUrl: string;
  /**
   * Lebar kartu penanda tercetak, dalam meter. Ini yang mengubah satuan
   * anchor MindAR (1 unit = lebar kartu) menjadi ukuran dunia nyata.
   * Kalau kartu dicetak dengan ukuran lain, ubah angka ini — bukan koordinat
   * titiknya.
   */
  markerWidthMeters: number;
  defaultStyle: MeasurementStyle;
  objects: ObjectData[];
}
