export type ScreenId = 'menu' | 'ar' | 'materi' | 'panduan' | 'tentang';

/** Harus sama dengan durasi transisi .screen di main.css. */
const FADE_MS = 220;

/**
 * Navigasi antar-layar dengan transisi fade (kontrak docs/03-modules.md).
 *
 * Tidak ada framework UI: tiap layar hanya satu elemen yang didaftarkan,
 * dan Router mengatur mana yang terlihat. Callback `onEnter`/`onExit` dipakai
 * untuk hal yang mahal — misalnya menyalakan dan mematikan kamera AR.
 *
 * `materi` sengaja tidak didaftarkan sebagai layar: docs menetapkannya
 * sebagai dialog, jadi tombolnya memanggil Dialog langsung.
 */
export class Router {
  private readonly screens = new Map<ScreenId, HTMLElement>();
  private readonly enterHandlers = new Map<ScreenId, (() => void)[]>();
  private readonly exitHandlers = new Map<ScreenId, (() => void)[]>();
  private readonly timers = new Map<ScreenId, number>();

  private current: ScreenId | null = null;

  register(id: ScreenId, element: HTMLElement): void {
    element.classList.add('screen');
    element.hidden = true;
    this.screens.set(id, element);
  }

  get currentId(): ScreenId | null {
    return this.current;
  }

  show(id: ScreenId): void {
    if (this.current === id) return;

    const next = this.screens.get(id);
    if (!next) throw new Error(`Layar "${id}" belum didaftarkan ke Router`);

    const previous = this.current;
    if (previous) {
      for (const handler of this.exitHandlers.get(previous) ?? []) handler();
      this.fadeOut(previous);
    }

    this.current = id;

    // Batalkan penyembunyian yang tertunda kalau layar ini dibuka lagi
    // sebelum fade sebelumnya selesai.
    const pending = this.timers.get(id);
    if (pending !== undefined) {
      clearTimeout(pending);
      this.timers.delete(id);
    }

    next.hidden = false;
    // Paksa reflow supaya transisi opacity benar-benar berjalan.
    void next.offsetWidth;
    next.classList.add('is-visible');

    for (const handler of this.enterHandlers.get(id) ?? []) handler();
  }

  onEnter(id: ScreenId, callback: () => void): void {
    this.push(this.enterHandlers, id, callback);
  }

  onExit(id: ScreenId, callback: () => void): void {
    this.push(this.exitHandlers, id, callback);
  }

  private fadeOut(id: ScreenId): void {
    const element = this.screens.get(id);
    if (!element) return;

    element.classList.remove('is-visible');
    const timer = window.setTimeout(() => {
      this.timers.delete(id);
      // Bisa saja sudah dibuka lagi selama fade berlangsung.
      if (this.current !== id) element.hidden = true;
    }, FADE_MS);
    this.timers.set(id, timer);
  }

  private push(
    map: Map<ScreenId, (() => void)[]>,
    id: ScreenId,
    callback: () => void,
  ): void {
    const list = map.get(id);
    if (list) list.push(callback);
    else map.set(id, [callback]);
  }
}
