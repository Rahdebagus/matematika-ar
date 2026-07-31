/**
 * Popup sederhana untuk fitur yang belum jadi (kontrak docs/03-modules.md).
 *
 * Memakai elemen <dialog> bawaan browser: fokus terkunci di dalamnya dan
 * tombol Esc bekerja tanpa kode tambahan.
 */
export class Dialog {
  private readonly element: HTMLDialogElement;
  private readonly titleEl: HTMLHeadingElement;
  private readonly messageEl: HTMLParagraphElement;

  constructor(host: HTMLElement = document.body) {
    this.element = document.createElement('dialog');
    this.element.className = 'dialog';

    this.titleEl = document.createElement('h2');
    this.messageEl = document.createElement('p');

    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'dialog-close';
    close.textContent = 'Mengerti';
    close.addEventListener('click', () => this.hide());

    this.element.append(this.titleEl, this.messageEl, close);
    // Klik di luar kotak dialog ikut menutup.
    this.element.addEventListener('click', (event) => {
      if (event.target === this.element) this.hide();
    });

    host.append(this.element);
  }

  showComingSoon(featureName: string): void {
    this.titleEl.textContent = featureName;
    this.messageEl.textContent = `${featureName} masih dikembangkan dan akan hadir di pembaruan berikutnya.`;
    this.element.showModal();
  }

  hide(): void {
    if (this.element.open) this.element.close();
  }

  dispose(): void {
    this.element.remove();
  }
}
