import type { AppData, MeasurementStyle, ObjectData } from './types';

/** Dipakai kalau `defaultStyle` di JSON tidak lengkap. */
const FALLBACK_STYLE: MeasurementStyle = {
  lineColor: '#14E6FF',
  lineWidth: 4,
  labelColor: '#FFFFFF',
  labelFontSize: 22,
  showArrows: true,
  arrowLength: 0.04,
  arrowHalfWidth: 0.018,
  worldUnits: false,
};

/**
 * Memuat dan memvalidasi app-data.json.
 *
 * Validasi sengaja galak: satu id titik yang salah ketik lebih baik ketahuan
 * saat memuat data daripada jadi garis yang diam-diam hilang di HP.
 */
export async function loadAppData(url: string): Promise<AppData> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Gagal memuat ${url}: HTTP ${response.status}`);
  }

  const raw = (await response.json()) as Partial<AppData>;

  if (!Array.isArray(raw.objects)) {
    throw new Error(`${url}: field "objects" wajib berupa array`);
  }

  const defaultStyle: MeasurementStyle = { ...FALLBACK_STYLE, ...raw.defaultStyle };

  raw.objects.forEach(validateObject);

  const markerWidthMeters = raw.markerWidthMeters ?? 0.1;
  if (!(markerWidthMeters > 0)) {
    throw new Error(`${url}: "markerWidthMeters" harus lebih besar dari 0`);
  }

  return {
    targetsUrl: raw.targetsUrl ?? '/targets/targets.mind',
    markerWidthMeters,
    defaultStyle,
    objects: raw.objects,
  };
}

function validateObject(object: ObjectData): void {
  const where = `objek "${object.id}"`;

  if (!object.modelUrl && !object.primitive) {
    throw new Error(`${where}: butuh "modelUrl" atau "primitive"`);
  }

  const pointIds = new Set(object.points.map((point) => point.id));
  if (pointIds.size !== object.points.length) {
    throw new Error(`${where}: ada id titik yang dobel`);
  }

  for (const measurement of object.measurements) {
    for (const end of [measurement.from, measurement.to]) {
      if (!pointIds.has(end)) {
        throw new Error(
          `${where}: measurement "${measurement.id}" merujuk titik "${end}" yang tidak ada`,
        );
      }
    }
  }
}
