export interface MenuActions {
  onMulaiAR: () => void;
  onMateri: () => void;
  onPanduan: () => void;
  onTentang: () => void;
  /** @returns kondisi bisu setelah ditogel. */
  onToggleSuara: () => boolean;
}

/**
 * Layar utama. Tanpa framework UI — modul ini yang mengelola elemennya
 * sendiri (docs/08-conventions.md).
 */
export class MenuScreen {
  readonly element: HTMLElement;

  constructor(actions: MenuActions) {
    this.element = document.createElement('section');
    this.element.className = 'screen-panel menu';

    const title = document.createElement('h1');
    title.textContent = 'Matematika AR';

    const subtitle = document.createElement('p');
    subtitle.className = 'menu-subtitle';
    subtitle.textContent =
      'Arahkan kamera ke kartu penanda, lalu pelajari pengukuran dan bangun ruang lewat objek 3D.';

    const nav = document.createElement('nav');
    nav.className = 'menu-nav';
    nav.append(
      button('Mulai AR', 'is-primary', actions.onMulaiAR),
      button('Materi', '', actions.onMateri),
      button('Panduan', '', actions.onPanduan),
      button('Tentang', '', actions.onTentang),
    );

    const sound = document.createElement('button');
    sound.type = 'button';
    sound.className = 'menu-sound';
    sound.title = 'Suara';
    sound.textContent = '🔊';
    sound.setAttribute('aria-pressed', 'false');
    sound.addEventListener('click', () => {
      const muted = actions.onToggleSuara();
      sound.textContent = muted ? '🔇' : '🔊';
      sound.setAttribute('aria-pressed', String(muted));
    });

    this.element.append(sound, title, subtitle, nav);
  }
}

function button(label: string, extraClass: string, onClick: () => void): HTMLButtonElement {
  const element = document.createElement('button');
  element.type = 'button';
  element.className = `menu-button ${extraClass}`.trim();
  element.textContent = label;
  element.addEventListener('click', onClick);
  return element;
}
