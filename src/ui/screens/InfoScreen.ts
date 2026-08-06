import { icon, type IconName } from '../icons';

export type InfoBlock =
  | { type: 'paragraph'; text: string }
  | { type: 'divider' }
  | { type: 'features'; items: { icon: IconName; title: string; text: string }[] }
  | { type: 'steps'; items: { title: string; text: string }[] }
  | { type: 'links'; title: string; items: { label: string; href: string }[] }
  | { type: 'qr'; caption: string }
  | { type: 'note'; text: string };

export interface InfoScreenOptions {
  title: string;
  /** Warna aksen layar: menentukan cahaya latar, bingkai kartu, dan lencana. */
  accent: string;
  icon: IconName;
  blocks: InfoBlock[];
  onBack: () => void;
}

/**
 * Layar isi teks: lencana ikon, judul besar, lalu satu kartu berisi blok-blok.
 *
 * Panduan dan Tentang memakai class yang sama dan hanya berbeda warna aksen,
 * ikon, serta isinya — strukturnya identik, jadi menduplikasi kodenya tidak
 * ada gunanya.
 */
export class InfoScreen {
  readonly element: HTMLElement;

  constructor({ title, accent, icon: iconName, blocks, onBack }: InfoScreenOptions) {
    this.element = document.createElement('section');
    this.element.className = 'screen-panel page';
    this.element.style.setProperty('--accent-screen', accent);

    const badge = document.createElement('div');
    badge.className = 'page-badge';
    badge.innerHTML = icon(iconName);

    const heading = document.createElement('h1');
    heading.textContent = title.toUpperCase();

    const rule = document.createElement('span');
    rule.className = 'page-rule';

    const card = document.createElement('div');
    card.className = 'page-card';
    for (const block of blocks) card.append(render(block));

    const back = document.createElement('button');
    back.type = 'button';
    back.className = 'menu-button';
    back.textContent = 'Kembali';
    back.addEventListener('click', onBack);

    this.element.append(badge, heading, rule, card, back);
  }
}

function render(block: InfoBlock): HTMLElement {
  switch (block.type) {
    case 'paragraph': {
      const node = document.createElement('p');
      node.className = 'page-text';
      node.textContent = block.text;
      return node;
    }

    case 'divider': {
      return document.createElement('hr');
    }

    case 'features': {
      const list = document.createElement('ul');
      list.className = 'feature-list';
      for (const item of block.items) {
        const row = document.createElement('li');
        const tile = document.createElement('span');
        tile.className = 'feature-icon';
        tile.innerHTML = icon(item.icon);

        const body = document.createElement('div');
        const title = document.createElement('h2');
        title.textContent = item.title.toUpperCase();
        const text = document.createElement('p');
        text.textContent = item.text;
        body.append(title, text);

        row.append(tile, body);
        list.append(row);
      }
      return list;
    }

    case 'steps': {
      const list = document.createElement('ol');
      list.className = 'step-list';
      block.items.forEach((item, index) => {
        const row = document.createElement('li');
        const badge = document.createElement('span');
        badge.className = 'step-number';
        badge.textContent = String(index + 1);

        const body = document.createElement('div');
        const title = document.createElement('h2');
        title.textContent = item.title;
        const text = document.createElement('p');
        text.textContent = item.text;
        body.append(title, text);

        row.append(badge, body);
        list.append(row);
      });
      return list;
    }

    case 'links': {
      const wrapper = document.createElement('div');
      wrapper.className = 'link-block';

      const title = document.createElement('h2');
      title.textContent = block.title.toUpperCase();
      wrapper.append(title);

      const list = document.createElement('ul');
      for (const item of block.items) {
        const row = document.createElement('li');
        const anchor = document.createElement('a');
        anchor.href = item.href;
        anchor.textContent = item.label;
        // Kartu penanda dibuka di tab lain supaya sesi AR tidak tertutup.
        anchor.target = '_blank';
        anchor.rel = 'noopener';
        row.append(anchor);
        list.append(row);
      }
      wrapper.append(list);
      return wrapper;
    }

    case 'qr': {
      const figure = document.createElement('figure');
      figure.className = 'info-qr';

      const caption = document.createElement('figcaption');
      caption.textContent = block.caption;

      const image = document.createElement('img');
      image.src = '/qr.svg';
      image.alt = 'QR code aplikasi Matematika AR';

      // Alamatnya ikut ditulis supaya tetap berguna kalau QR gagal dipindai.
      const link = document.createElement('a');
      link.href = window.location.origin;
      link.textContent = window.location.host;

      figure.append(caption, image, link);
      return figure;
    }

    case 'note': {
      const node = document.createElement('p');
      node.className = 'page-note';
      node.textContent = block.text;
      return node;
    }
  }
}
