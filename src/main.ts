import { Router } from './core/Router';
import { AROverlay } from './ui/AROverlay';
import { Dialog } from './ui/Dialog';
import { MenuScreen } from './ui/screens/MenuScreen';
import { InfoScreen } from './ui/screens/InfoScreen';
import { AudioManager } from './audio/AudioManager';
import type { ArScene } from './ar/ArScene';

const container = document.querySelector<HTMLDivElement>('#app');
const arScreen = document.querySelector<HTMLDivElement>('#ar-screen');
const backButton = document.querySelector<HTMLButtonElement>('#ar-back');
const uiEl = document.querySelector<HTMLDivElement>('#ui');
const statusEl = document.querySelector<HTMLParagraphElement>('#status');
const screensEl = document.querySelector<HTMLDivElement>('#screens');

if (!container || !arScreen || !backButton || !uiEl || !statusEl || !screensEl) {
  throw new Error('Kerangka DOM di index.html tidak lengkap');
}

const overlay = new AROverlay(uiEl, statusEl);
const dialog = new Dialog();
const router = new Router();
const audio = new AudioManager();

// Satu listener untuk semua tombol — lebih ringkas daripada memasang
// pemanggilan playClick() di tiap handler dan gampang terlupa.
document.addEventListener('click', (event) => {
  if ((event.target as HTMLElement | null)?.closest('button')) audio.playClick();
});

const menu = new MenuScreen({
  onMulaiAR: () => router.show('ar'),
  // docs menetapkan Materi sebagai dialog, bukan layar tersendiri.
  onMateri: () => dialog.showComingSoon('Materi'),
  onPanduan: () => router.show('panduan'),
  onTentang: () => router.show('tentang'),
  onToggleSuara: () => audio.toggleMute(),
});

const panduan = new InfoScreen(
  'Panduan',
  [
    { type: 'paragraph', text: 'Siapkan kartu penanda sebelum memulai AR.' },
    {
      type: 'steps',
      items: [
        'Cetak salah satu kartu penanda di bawah, atau tampilkan di layar lain.',
        'Buka menu utama lalu tekan "Mulai AR" dan izinkan akses kamera.',
        'Arahkan kamera ke kartu sampai objek 3D muncul.',
        'Geser satu jari untuk memutar objek bebas ke segala arah: mendatar untuk memutar, tegak untuk memiringkan. Cubit dua jari untuk memperbesar atau memperkecil.',
        'Pakai tombol di bawah layar untuk menampilkan, menyembunyikan, atau membuat objek transparan.',
        'Tekan nama kategori untuk memilih ukuran yang ditampilkan.',
        'Tombol Reset mengembalikan putaran, ukuran, dan tampilan garis ke kondisi awal.',
      ],
    },
    {
      type: 'paragraph',
      text: 'Jika objek tidak muncul, dekatkan kamera atau cetak kartu lebih besar. Kartu yang terlalu kecil di layar bisa salah dikenali.',
    },
    {
      type: 'links',
      items: [
        { label: 'Kartu penanda 1 — Kubus 10 cm', href: '/markers/object-1.png' },
        { label: 'Kartu penanda 2 — Balok 12x8x6 cm', href: '/markers/object-2.png' },
        { label: 'Kartu penanda 3 — Kubus 15 cm', href: '/markers/object-3.png' },
        { label: 'Kartu penanda 4 — Objek 4', href: '/markers/object-4.png' },
      ],
    },
  ],
  () => router.show('menu'),
);

const tentang = new InfoScreen(
  'Tentang',
  [
    {
      type: 'paragraph',
      text: 'Matematika AR adalah aplikasi edukasi berbasis WebAR untuk belajar pengukuran, bangun ruang, dan geometri.',
    },
    {
      type: 'paragraph',
      text: 'Objek 3D muncul di atas kartu penanda lengkap dengan titik, garis ukur, dan label. Aplikasi berjalan langsung di browser HP tanpa perlu memasang APK.',
    },
    { type: 'qr', caption: 'Pindai untuk membuka aplikasi ini di HP lain:' },
    {
      type: 'paragraph',
      text: 'Dibuat dengan TypeScript, Three.js, dan MindAR. Versi web ini menggantikan versi Unity dengan logika yang sama.',
    },
  ],
  () => router.show('menu'),
);

screensEl.append(menu.element, panduan.element, tentang.element);

router.register('ar', arScreen);
router.register('menu', menu.element);
router.register('panduan', panduan.element);
router.register('tentang', tentang.element);

backButton.addEventListener('click', () => router.show('menu'));

/**
 * Tumpukan AR (Three.js + MindAR + TensorFlow) diambil hanya saat pengguna
 * benar-benar membuka layar AR. Menu dan halaman teks tidak memerlukannya.
 */
let scenePromise: Promise<ArScene> | null = null;

router.onEnter('ar', () => {
  overlay.setStatus('Menyiapkan AR...');

  scenePromise ??= import('./ar/ArScene').then((module) =>
    module.ArScene.create({ container, overlay }),
  );

  void scenePromise
    .then(async (scene) => {
      // Pengguna bisa saja kembali ke menu sebelum modulnya selesai diunduh.
      if (router.currentId !== 'ar') return;
      overlay.setStatus('Menyalakan kamera...');
      await scene.start();
      if (router.currentId !== 'ar') scene.stop();
      else overlay.setStatus('Arahkan kamera ke kartu penanda');
    })
    .catch((error: unknown) => {
      // Gagal memuat tidak boleh dikenang selamanya — biarkan dicoba lagi.
      scenePromise = null;
      overlay.setStatus(error instanceof Error ? error.message : 'Gagal memulai AR');
      console.error(error);
    });
});

router.onExit('ar', () => {
  void scenePromise?.then((scene) => scene.stop());
});

router.show('menu');

// Hot reload Vite: lepas resource lama agar tidak menumpuk context WebGL.
if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    void scenePromise?.then((scene) => scene.dispose());
    overlay.dispose();
    dialog.dispose();
    audio.dispose();
  });
}
