import type { EditorScene } from './EditorScene';
import type { AppData, MeasurementDef, ObjectData } from '../data/types';

const el = <K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string,
): HTMLElementTagNameMap[K] => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
};

/**
 * Panel kendali editor: pilih objek, kelola titik dan ukuran, lalu unduh
 * app-data.json.
 *
 * Angka pada tiap ukuran dihitung dari jarak sebenarnya antar titik dikali
 * kalibrasi, bukan diketik satu per satu. Itu yang menutup peluang salah
 * ketik seperti "115 m" untuk jarak yang sebenarnya 1,15 m.
 */
export class EditorUI {
  private readonly host: HTMLElement;
  private readonly scene: EditorScene;
  private data: AppData;
  private active: ObjectData;

  private readonly pointList = el('div', 'list');
  private readonly measurementList = el('div', 'list');
  private readonly status = el('p', 'status');
  private readonly calibrationInput = el('input', 'field');
  private readonly unitSelect = el('select', 'field');

  constructor(host: HTMLElement, scene: EditorScene, data: AppData) {
    this.host = host;
    this.scene = scene;
    this.data = data;
    this.active = data.objects[0];

    this.build();
    void this.loadObject(this.active);
  }

  refresh(): void {
    this.renderPoints();
    this.renderMeasurements();
  }

  private get metersPerUnit(): number {
    const value = Number(this.calibrationInput.value.replace(',', '.'));
    return Number.isFinite(value) && value > 0 ? value : 1;
  }

  private build(): void {
    const header = el('header');
    header.append(el('h1', undefined, 'Editor Titik Ukur'));

    // --- pilih objek ---
    const objectSelect = el('select', 'field');
    for (const object of this.data.objects) {
      const option = el('option', undefined, `${object.displayName} (kartu ${object.targetIndex + 1})`);
      option.value = object.id;
      objectSelect.append(option);
    }
    objectSelect.addEventListener('change', () => {
      const found = this.data.objects.find((o) => o.id === objectSelect.value);
      if (found) void this.loadObject(found);
    });
    header.append(field('Objek', objectSelect));

    // --- mode ---
    const modeRow = el('div', 'row');
    const pilih = el('button', 'toggle is-active', 'Pilih / geser');
    const tambah = el('button', 'toggle', 'Tambah titik');
    const setMode = (mode: 'pilih' | 'tambah') => {
      this.scene.mode = mode;
      pilih.classList.toggle('is-active', mode === 'pilih');
      tambah.classList.toggle('is-active', mode === 'tambah');
      this.status.textContent =
        mode === 'tambah'
          ? 'Klik permukaan model untuk menaruh titik baru.'
          : 'Klik titik untuk memilih, lalu seret panahnya untuk menggeser.';
    };
    pilih.addEventListener('click', () => setMode('pilih'));
    tambah.addEventListener('click', () => setMode('tambah'));
    modeRow.append(pilih, tambah);
    header.append(modeRow, this.status);
    setMode('pilih');

    // --- kalibrasi ---
    const calibration = el('section');
    calibration.append(el('h2', undefined, 'Kalibrasi'));

    this.calibrationInput.type = 'text';
    this.calibrationInput.placeholder = '1';
    this.calibrationInput.addEventListener('change', () => this.renderMeasurements());

    for (const unit of ['m', 'cm']) {
      const option = el('option', undefined, unit);
      option.value = unit;
      this.unitSelect.append(option);
    }
    this.unitSelect.addEventListener('change', () => this.renderMeasurements());

    calibration.append(
      field('1 satuan model = ... meter', this.calibrationInput),
      field('Satuan yang ditampilkan', this.unitSelect),
    );

    const fillAll = el('button', 'primary', 'Isi semua angka dari kalibrasi');
    fillAll.addEventListener('click', () => this.fillAllValues());
    calibration.append(fillAll);
    calibration.append(
      el(
        'p',
        'hint',
        'Ukur satu jarak yang Anda tahu pasti, lalu isi kalibrasinya. Angka ukuran lain ikut terhitung sendiri.',
      ),
    );

    // --- titik ---
    const points = el('section');
    points.append(el('h2', undefined, 'Titik'), this.pointList);

    // --- ukuran ---
    const measurements = el('section');
    measurements.append(el('h2', undefined, 'Ukuran'), this.measurementList);

    const addRow = el('div', 'row');
    const fromSelect = el('select', 'field');
    const toSelect = el('select', 'field');
    const addButton = el('button', undefined, 'Tambah ukuran');
    addButton.addEventListener('click', () => {
      this.addMeasurement(fromSelect.value, toSelect.value);
      this.renderMeasurements();
    });
    addRow.append(fromSelect, toSelect, addButton);
    measurements.append(addRow);
    this.pairSelects = [fromSelect, toSelect];

    // --- ekspor ---
    const exportButton = el('button', 'primary', 'Unduh app-data.json');
    exportButton.addEventListener('click', () => this.download());

    this.host.append(header, calibration, points, measurements, exportButton);
  }

  private pairSelects: HTMLSelectElement[] = [];

  private async loadObject(object: ObjectData): Promise<void> {
    this.active = object;
    this.status.textContent = `Memuat ${object.displayName}...`;

    try {
      await this.scene.load(object);
      this.calibrationInput.value = String(object.metersPerUnit ?? 1);
      this.unitSelect.value = object.measurements[0]?.unit?.toLowerCase() === 'cm' ? 'cm' : 'm';
      this.status.textContent = `${object.displayName} siap.`;
      this.refresh();
    } catch (error) {
      this.status.textContent =
        error instanceof Error ? error.message : 'Gagal memuat objek';
      console.error(error);
    }
  }

  private renderPoints(): void {
    this.pointList.replaceChildren();
    const points = this.scene.getPoints();

    for (const point of points) {
      const row = el('div', 'item');
      if (point.id === this.scene.selected) row.classList.add('is-active');

      const name = el('input', 'field id');
      name.value = point.id;
      name.addEventListener('change', () => {
        if (!this.scene.rename(point.id, name.value.trim())) {
          name.value = point.id;
          this.status.textContent = 'Id itu sudah dipakai titik lain.';
        }
      });

      const pick = el('button', undefined, 'Pilih');
      pick.addEventListener('click', () => {
        this.scene.select(point.id);
        this.renderPoints();
      });

      const remove = el('button', 'danger', 'Hapus');
      remove.addEventListener('click', () => this.scene.remove(point.id));

      const coords = el(
        'span',
        'coords',
        point.position.map((v) => v.toFixed(2)).join(', '),
      );

      row.append(name, coords, pick, remove);
      this.pointList.append(row);
    }

    for (const select of this.pairSelects) {
      const previous = select.value;
      select.replaceChildren();
      for (const point of points) {
        const option = el('option', undefined, point.id);
        option.value = point.id;
        select.append(option);
      }
      if (points.some((p) => p.id === previous)) select.value = previous;
    }
  }

  private renderMeasurements(): void {
    this.measurementList.replaceChildren();
    const unit = this.unitSelect.value;
    const factor = unit === 'cm' ? this.metersPerUnit * 100 : this.metersPerUnit;

    for (const measurement of this.scene.getMeasurements()) {
      const row = el('div', 'item');
      const computed = this.scene.distance(measurement.from, measurement.to) * factor;

      const label = el('input', 'field');
      label.value = measurement.displayName ?? '';
      label.placeholder = 'nama';
      label.addEventListener('change', () =>
        this.updateMeasurement(measurement.id, { displayName: label.value || undefined }),
      );

      const category = el('input', 'field');
      category.value = measurement.category ?? '';
      category.placeholder = 'kategori';
      category.addEventListener('change', () =>
        this.updateMeasurement(measurement.id, { category: category.value || undefined }),
      );

      const value = el('input', 'field');
      value.value = measurement.value ?? '';
      value.placeholder = computed.toFixed(2);
      value.addEventListener('change', () =>
        this.updateMeasurement(measurement.id, {
          value: value.value || undefined,
          unit: value.value ? unit : undefined,
        }),
      );

      // Selisih antara angka yang tertulis dan jarak sebenarnya ditandai,
      // supaya salah ketik langsung terlihat tanpa perlu dihitung manual.
      const typed = Number((measurement.value ?? '').replace(',', '.'));
      const off = Number.isFinite(typed) && typed > 0
        ? Math.abs(computed - typed) / typed
        : 0;

      const info = el('span', 'coords', `${measurement.from}-${measurement.to}  ${computed.toFixed(2)} ${unit}`);
      if (off > 0.05) info.classList.add('warn');

      const remove = el('button', 'danger', 'Hapus');
      remove.addEventListener('click', () => {
        this.scene.setMeasurements(
          this.scene.getMeasurements().filter((m) => m.id !== measurement.id),
        );
        this.renderMeasurements();
      });

      row.append(info, label, category, value, remove);
      this.measurementList.append(row);
    }
  }

  private updateMeasurement(id: string, patch: Partial<MeasurementDef>): void {
    this.scene.setMeasurements(
      this.scene.getMeasurements().map((m) => (m.id === id ? { ...m, ...patch } : m)),
    );
    this.renderMeasurements();
  }

  private addMeasurement(from: string, to: string): void {
    if (!from || !to || from === to) {
      this.status.textContent = 'Pilih dua titik yang berbeda.';
      return;
    }

    const list = this.scene.getMeasurements();
    let id = `${from}${to}`;
    let suffix = 2;
    while (list.some((m) => m.id === id)) id = `${from}${to}_${suffix++}`;

    list.push({ id, from, to, visibleOnStart: true });
    this.scene.setMeasurements(list);
  }

  private fillAllValues(): void {
    const unit = this.unitSelect.value;
    const factor = unit === 'cm' ? this.metersPerUnit * 100 : this.metersPerUnit;

    this.scene.setMeasurements(
      this.scene.getMeasurements().map((m) => {
        if (m.from === m.to) return m;
        const length = this.scene.distance(m.from, m.to) * factor;
        // Koma sebagai pemisah desimal, mengikuti penulisan Indonesia.
        return { ...m, value: length.toFixed(2).replace('.', ','), unit };
      }),
    );
    this.renderMeasurements();
    this.status.textContent = 'Semua angka diisi ulang dari kalibrasi.';
  }

  private download(): void {
    const updated: ObjectData = {
      ...this.active,
      metersPerUnit: this.metersPerUnit,
      points: this.scene.getPoints(),
      measurements: this.scene.getMeasurements(),
    };

    const output: AppData = {
      ...this.data,
      objects: this.data.objects.map((o) => (o.id === updated.id ? updated : o)),
    };
    this.data = output;

    const blob = new Blob([JSON.stringify(output, null, 2)], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'app-data.json';
    link.click();
    URL.revokeObjectURL(link.href);

    this.status.textContent = 'app-data.json diunduh. Taruh di public/data/.';
  }
}

function field(labelText: string, control: HTMLElement): HTMLElement {
  const wrapper = el('label', 'field-row');
  wrapper.append(el('span', undefined, labelText), control);
  return wrapper;
}
