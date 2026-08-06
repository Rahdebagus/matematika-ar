/**
 * Ikon garis sebagai SVG inline.
 *
 * Bukan berkas gambar: tajam di semua kerapatan layar, warnanya mengikuti
 * `currentColor`, dan tidak menambah satu pun permintaan jaringan pada
 * bundel awal yang sengaja dijaga tetap kecil.
 */
const PATHS = {
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5"/><path d="M12 7.6v.1"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9.2 9.3a2.9 2.9 0 1 1 3.8 2.8c-.7.3-1 .9-1 1.6v.4"/><path d="M12 17.2v.1"/>',
  cube:
    '<path d="M12 2.6 20.5 7v10L12 21.4 3.5 17V7z"/><path d="M3.5 7 12 11.5 20.5 7"/><path d="M12 11.5v9.9"/>',
  ruler:
    '<rect x="1.8" y="8.4" width="20.4" height="7.2" rx="1.4" transform="rotate(-45 12 12)"/><path d="M9.1 6.6 10.6 8.1"/><path d="M11.9 9.4l1.5 1.5"/><path d="M14.7 12.2l1.5 1.5"/>',
  rotate: '<polyline points="21 5 21 11 15 11"/><path d="M20.5 15a9 9 0 1 1-2.1-9.4L21 8"/>',
} as const;

export type IconName = keyof typeof PATHS;

export function icon(name: IconName): string {
  return (
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" ' +
    `stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${PATHS[name]}</svg>`
  );
}

/**
 * Logo aplikasi: empat operasi hitung mengelilingi satu palang.
 * Dipakai di menu utama dan sebagai favicon.
 */
export const LOGO_SVG = `
<svg viewBox="0 0 64 64" fill="currentColor" aria-hidden="true">
  <rect x="29" y="8" width="6" height="48" rx="3"/>
  <rect x="8" y="29" width="48" height="6" rx="3"/>
  <rect x="14" y="17.5" width="11" height="3.6" rx="1.8"/>
  <rect x="17.6" y="13.9" width="3.6" height="11" rx="1.8"/>
  <rect
    x="39.5" y="15.1" width="11" height="3.6" rx="1.8"
    transform="rotate(45 45 16.9)"
  />
  <rect
    x="39.5" y="15.1" width="11" height="3.6" rx="1.8"
    transform="rotate(-45 45 16.9)"
  />
  <rect x="14" y="43.2" width="11" height="3.6" rx="1.8"/>
  <circle cx="45" cy="39.6" r="2.4"/>
  <rect x="39.5" y="43.2" width="11" height="3.6" rx="1.8"/>
  <circle cx="45" cy="50.4" r="2.4"/>
</svg>`;
