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
  /**
   * Sengaja gelap secara bawaan. Bentuk yang terang ikut melewati ambang
   * bloom dan mencuci seluruh layar — padahal yang seharusnya menyala hanya
   * garis ukurnya.
   */
  color?: string;
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
  /**
   * Angka ukurnya masih diverifikasi.
   *
   * `npm run check:data` tetap melaporkan ketidakcocokan, tapi tidak
   * menggagalkan build. Dipakai selama objek masih diuji coba, supaya bisa
   * dibandingkan langsung dengan tampilan Unity di HP. Hapus setelah
   * angkanya benar — jangan dibiarkan menetap.
   */
  draft?: boolean;
  fit?: FitMode; // default "real"
  scale?: number; // pengali tambahan
  /**
   * Skalakan dan geser model agar kotak batasnya berimpit dengan kotak batas
   * titik ukur.
   *
   * Dipakai saat ekspor .glb tidak sepakat ruang dengan koordinat titik dari
   * Unity. Contoh nyata pada Atap Masjid: vertex-nya ternormalisasi ±1 dengan
   * scale simpul 1,983 (tapak 3,97) plus offset Y bawaan, sedangkan titiknya
   * memakai satuan Unity dengan tapak 15,46. Tanpa penyelarasan, garis ukur
   * melayang jauh dari atapnya.
   *
   * Titik adalah acuan pengukuran, jadi model yang menyesuaikan. Faktornya
   * diturunkan dari data, bukan angka yang ditebak dan ditulis manual.
   *
   * Idealnya tidak perlu: benahi saja skala model saat ekspor dari Unity.
   */
  alignModelToPoints?: boolean;
  points: PointData[];
  measurements: MeasurementDef[];
  style?: Partial<MeasurementStyle>;
}

/**
 * Efek glow neon pada garis ukur. Bisa dimatikan lewat data karena bloom
 * menambah satu render pass penuh tiap frame — terasa di HP kelas bawah,
 * apalagi pada model yang berat.
 */
export interface BloomData {
  enabled: boolean;
  strength: number;
  radius: number;
  threshold: number;
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
  bloom: BloomData;
  defaultStyle: MeasurementStyle;
  objects: ObjectData[];
}
