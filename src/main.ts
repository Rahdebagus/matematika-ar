import { App } from './core/App';
import { ARSession } from './core/ARSession';
import { Router } from './core/Router';
import { MarkerRegistry } from './ar/MarkerRegistry';
import { AnchorController } from './ar/AnchorController';
import { ModelLoader } from './models/ModelLoader';
import { ObjectTransform } from './ar/ObjectTransform';
import { AROverlay } from './ui/AROverlay';
import { Dialog } from './ui/Dialog';
import { MenuScreen } from './ui/screens/MenuScreen';
import { InfoScreen } from './ui/screens/InfoScreen';
import { AudioManager } from './audio/AudioManager';
import { loadAppData } from './data/loadAppData';

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

async function bootstrap(root: HTMLDivElement): Promise<void> {
  const app = new App(root);
  app.start();

  const data = await loadAppData('/data/app-data.json');

  app.setBloom(data.bloom.enabled ? data.bloom : null);

  const session = new ARSession({
    container: root,
    camera: app.camera,
    targetsUrl: data.targetsUrl,
    // Fase 7 menaikkan ini agar beberapa marker terlacak bersamaan.
    maxTrack: 1,
  });

  const models = new ModelLoader();
  const anchors = new Map<number, AnchorController>();

  // Dipasang di canvas, bukan container: sentuhan pada tombol overlay
  // tidak boleh ikut memutar objek.
  const transform = new ObjectTransform(app.renderer.domElement, app.camera);
  overlay.setResetHook(() => transform.reset());

  const registry = new MarkerRegistry(app.scene, {
    onFound: (targetIndex) => {
      const anchor = anchors.get(targetIndex);
      if (!anchor) return;

      overlay.setStatus(`${anchor.object.displayName} terdeteksi`);
      void showAnchor(anchor);
    },
    onLost: () => {
      // Tombol dimatikan supaya tidak ada aksi tanpa objek aktif.
      overlay.bind(null);
      transform.bind(null);
      overlay.setStatus('Arahkan kamera ke kartu penanda');
    },
  });

  for (const object of data.objects) {
    anchors.set(
      object.targetIndex,
      new AnchorController(
        registry.register(object.targetIndex),
        object,
        data.defaultStyle,
        models,
        data.markerWidthMeters,
      ),
    );
  }

  // Tanpa ini anchor tidak pernah menerima matriks tracking: objek tetap
  // tersembunyi dan onFound tidak pernah jalan.
  registry.bind(session);

  const syncResolution = () => {
    for (const anchor of anchors.values()) {
      anchor.measurements?.setResolution(root.clientWidth, root.clientHeight);
    }
  };

  /** Isi anchor dimuat saat markernya pertama terlihat, bukan di awal. */
  async function showAnchor(anchor: AnchorController): Promise<void> {
    try {
      await anchor.load();
      syncResolution();

      // Transparansi dianimasikan, jadi controller ikut render loop.
      const measurements = anchor.measurements;
      if (measurements) app.addUpdatable(measurements);

      overlay.bind(measurements);
      transform.bind(anchor.pivot);
    } catch (error) {
      overlay.setStatus(`Gagal memuat ${anchor.object.displayName}`);
      console.error(error);
    }
  }

  app.addResizeHandler(() => {
    session.syncCamera();
    syncResolution();
  });

  // Kamera hanya menyala selama layar AR terbuka — menutup halaman menu
  // dengan kamera tetap hidup boros baterai dan bikin was-was.
  router.onEnter('ar', () => {
    overlay.setStatus('Menyalakan kamera...');
    session.start().then(
      () => overlay.setStatus('Arahkan kamera ke kartu penanda'),
      (error: unknown) => {
        overlay.setStatus(error instanceof Error ? error.message : 'Gagal memulai AR');
        console.error(error);
      },
    );
  });

  router.onExit('ar', () => {
    session.stop();
    registry.hideAll();
    overlay.bind(null);
  });

  router.show('menu');

  // Hot reload Vite: lepas resource lama agar tidak menumpuk context WebGL.
  if (import.meta.hot) {
    import.meta.hot.dispose(() => {
      session.dispose();
      for (const anchor of anchors.values()) anchor.dispose();
      registry.dispose();
      models.dispose();
      transform.dispose();
      overlay.dispose();
      dialog.dispose();
      audio.dispose();
      app.dispose();
    });
  }
}

bootstrap(container).catch((error: unknown) => {
  overlay.setStatus(error instanceof Error ? error.message : 'Gagal memulai aplikasi');
  console.error(error);
});
