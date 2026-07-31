import type { MeasurementController } from '../measurement/MeasurementController';

/** Ikon garis, meniru pack UI versi Unity (docs Bedug_AR_Unity_UI_Components). */
const ICONS = {
  show:
    '<path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z"/><circle cx="12" cy="12" r="3"/>',
  hide:
    '<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/>',
  transparent:
    '<circle cx="12" cy="12" r="10"/><path d="M12 2a10 10 0 0 1 0 20z" fill="currentColor" stroke="none"/>',
  reset: '<polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/>',
};

type IconName = keyof typeof ICONS;

/**
 * Kontrol AR: tampilkan / sembunyikan / transparan / reset, plus penyaring
 * kategori (kontrak docs/03-modules.md).
 *
 * Semua tombol menempel ke satu `MeasurementController` yang sedang aktif.
 * Saat tidak ada marker terlihat, `bind(null)` mematikan seluruh tombol
 * supaya tidak ada aksi yang menggantung tanpa objek.
 */
export class AROverlay {
  private readonly root: HTMLDivElement;
  private readonly statusEl: HTMLElement;
  private readonly actions: HTMLDivElement;
  private readonly categoryBar: HTMLDivElement;
  private readonly buttons: HTMLButtonElement[] = [];

  private controller: MeasurementController | null = null;
  private transparent = false;

  constructor(host: HTMLElement, statusEl: HTMLElement) {
    this.statusEl = statusEl;

    this.root = document.createElement('div');
    this.root.className = 'overlay';
    this.root.hidden = true;

    this.categoryBar = document.createElement('div');
    this.categoryBar.className = 'overlay-categories';

    this.actions = document.createElement('div');
    this.actions.className = 'overlay-actions';

    this.addAction('show', 'Tampilkan', () => this.controller?.showAll());
    this.addAction('hide', 'Sembunyikan', () => this.controller?.hideAll());
    this.addAction('transparent', 'Transparan', () => this.toggleTransparent());
    this.addAction('reset', 'Reset', () => this.reset());

    this.root.append(this.categoryBar, this.actions);
    host.prepend(this.root);
  }

  setStatus(text: string): void {
    this.statusEl.textContent = text;
  }

  /** `null` saat tidak ada marker yang terlihat. */
  bind(controller: MeasurementController | null): void {
    this.controller = controller;
    this.root.hidden = controller === null;

    for (const button of this.buttons) {
      button.disabled = controller === null;
    }

    // Transparansi milik objek sebelumnya tidak boleh terbawa.
    this.transparent = false;
    this.syncTransparentState();
    this.buildCategories(controller);
  }

  dispose(): void {
    this.root.remove();
  }

  private addAction(icon: IconName, label: string, onClick: () => void): void {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'overlay-button';
    button.disabled = true;
    button.title = label;
    button.innerHTML = `${svg(icon)}<span>${label}</span>`;
    button.addEventListener('click', onClick);

    this.buttons.push(button);
    this.actions.append(button);
  }

  private toggleTransparent(): void {
    if (!this.controller) return;
    this.transparent = !this.transparent;
    this.controller.setTransparent(this.transparent);
    this.syncTransparentState();
  }

  private reset(): void {
    if (!this.controller) return;
    this.controller.reset();
    this.transparent = false;
    this.controller.setTransparent(false);
    this.syncTransparentState();
    this.markActiveCategory(null);
  }

  private syncTransparentState(): void {
    const button = this.buttons[2];
    button?.classList.toggle('is-active', this.transparent);
    button?.setAttribute('aria-pressed', String(this.transparent));
  }

  /**
   * Kategori dibaca dari objek yang sedang aktif, bukan didaftar manual,
   * supaya tombolnya otomatis mengikuti isi app-data.json.
   */
  private buildCategories(controller: MeasurementController | null): void {
    this.categoryBar.replaceChildren();
    if (!controller) return;

    const categories = controller.categories;
    if (categories.length < 2) return; // satu kategori tidak perlu disaring

    for (const category of categories) {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'overlay-chip';
      chip.textContent = category;
      chip.addEventListener('click', () => {
        controller.showCategory(category);
        this.markActiveCategory(chip);
      });
      this.categoryBar.append(chip);
    }
  }

  private markActiveCategory(active: HTMLElement | null): void {
    for (const chip of this.categoryBar.children) {
      chip.classList.toggle('is-active', chip === active);
    }
  }
}

function svg(name: IconName): string {
  return (
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
    `stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name]}</svg>`
  );
}
