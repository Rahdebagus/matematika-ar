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

const panduan = new InfoScreen({
  title: 'Panduan',
  accent: '#3ec95b',
  icon: 'help',
  onBack: () => router.show('menu'),
  blocks: [
    {
      type: 'steps',
      items: [
        { title: 'Siapkan kartu', text: 'Ambil kartu penanda Object 1-4.' },
        { title: 'Tekan Mulai AR', text: 'Izinkan aplikasi memakai kamera.' },
        { title: 'Arahkan ke kartu', text: 'Objek 3D akan muncul di layar.' },
        { title: 'Amati ukurannya', text: 'Garis dan angka menunjukkan ukuran.' },
        { title: 'Coba tombolnya', text: 'Tampilkan, sembunyikan, atau transparan.' },
      ],
    },
    { type: 'divider' },
    {
      type: 'paragraph',
      text: 'Tombol Kunci membekukan objek di tempat, jadi kamera boleh dialihkan dari kartu. Geser satu jari untuk memutar, cubit dua jari untuk memperbesar.',
    },
    {
      type: 'links',
      title: 'Kartu penanda',
      items: [
        { label: 'Kartu 1 — Object-1', href: '/markers/object-1.png' },
        { label: 'Kartu 2 — Object-2', href: '/markers/object-2.png' },
        { label: 'Kartu 3 — Object-3', href: '/markers/object-3.png' },
        { label: 'Kartu 4 — Object-4', href: '/markers/object-4.png' },
      ],
    },
  ],
});

const tentang = new InfoScreen({
  title: 'Tentang',
  accent: '#4f8cff',
  icon: 'info',
  onBack: () => router.show('menu'),
  blocks: [
    {
      type: 'paragraph',
      text: 'Matematika AR adalah media pembelajaran interaktif yang memanfaatkan Augmented Reality untuk membantu memahami bangun ruang melalui visualisasi 3D.',
    },
    { type: 'divider' },
    {
      type: 'features',
      items: [
        {
          icon: 'cube',
          title: 'Visualisasi 3D',
          text: 'Lihat bangun ruang secara nyata melalui kamera.',
        },
        {
          icon: 'ruler',
          title: 'Pengukuran interaktif',
          text: 'Amati panjang, lebar, tinggi, dan diameter objek.',
        },
        {
          icon: 'rotate',
          title: 'Belajar lebih mudah',
          text: 'Putar, perbesar, dan pelajari objek dari berbagai sisi.',
        },
      ],
    },
    { type: 'qr', caption: 'Pindai untuk membuka aplikasi ini di HP lain:' },
    { type: 'note', text: 'Versi 1.0' },
  ],
});

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
