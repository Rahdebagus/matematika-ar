export type InfoBlock =
  | { type: 'paragraph'; text: string }
  | { type: 'steps'; items: string[] }
  | { type: 'links'; items: { label: string; href: string }[] }
  | { type: 'qr'; caption: string };

/**
 * Layar isi teks dengan tombol kembali.
 *
 * Panduan dan Tentang punya struktur yang sama persis — judul, beberapa blok
 * teks, satu tombol kembali — jadi keduanya memakai class ini alih-alih dua
 * file yang isinya hampir kembar.
 */
export class InfoScreen {
  readonly element: HTMLElement;

  constructor(title: string, blocks: InfoBlock[], onBack: () => void) {
    this.element = document.createElement('section');
    this.element.className = 'screen-panel info';

    const heading = document.createElement('h1');
    heading.textContent = title;

    const body = document.createElement('div');
    body.className = 'info-body';
    for (const block of blocks) {
      body.append(render(block));
    }

    const back = document.createElement('button');
    back.type = 'button';
    back.className = 'menu-button';
    back.textContent = 'Kembali';
    back.addEventListener('click', onBack);

    this.element.append(heading, body, back);
  }
}

function render(block: InfoBlock): HTMLElement {
  switch (block.type) {
    case 'paragraph': {
      const paragraph = document.createElement('p');
      paragraph.textContent = block.text;
      return paragraph;
    }
    case 'steps': {
      const list = document.createElement('ol');
      for (const item of block.items) {
        const li = document.createElement('li');
        li.textContent = item;
        list.append(li);
      }
      return list;
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
    case 'links': {
      const list = document.createElement('ul');
      list.className = 'info-links';
      for (const item of block.items) {
        const li = document.createElement('li');
        const anchor = document.createElement('a');
        anchor.href = item.href;
        anchor.textContent = item.label;
        // Kartu penanda dibuka di tab lain supaya sesi AR tidak tertutup.
        anchor.target = '_blank';
        anchor.rel = 'noopener';
        li.append(anchor);
        list.append(li);
      }
      return list;
    }
  }
}
