import * as THREE from 'three';
import { App } from './core/App';
import { ARSession } from './core/ARSession';
import { MarkerRegistry } from './ar/MarkerRegistry';
import { ModelLoader } from './models/ModelLoader';
import { fitToMarker } from './models/fitToMarker';

/**
 * Urutan sama dengan MARKERS di scripts/compile-targets.mjs = targetIndex.
 * `model: null` berarti belum ada .glb — kubus placeholder yang dipakai.
 */
const MARKERS: { label: string; color: number; model: string | null }[] = [
  { label: 'Objek 1', color: 0x4f8cff, model: null },
  { label: 'Objek 2', color: 0xffb347, model: null },
  { label: 'Objek 3', color: 0x5ddc7a, model: null },
  { label: 'Objek 4', color: 0xff6b8a, model: '/models/object-4.glb' },
];

const container = document.querySelector<HTMLDivElement>('#app');
const statusEl = document.querySelector<HTMLParagraphElement>('#status');
const startButton = document.querySelector<HTMLButtonElement>('#start');

if (!container || !statusEl || !startButton) {
  throw new Error('Elemen #app / #status / #start tidak ditemukan di index.html');
}

const setStatus = (text: string) => {
  statusEl.textContent = text;
};

const app = new App(container);
app.start();

const session = new ARSession({
  container,
  camera: app.camera,
  targetsUrl: '/targets/targets.mind',
  // Fase 7 menaikkan ini agar beberapa marker terlacak bersamaan.
  maxTrack: 1,
});

const models = new ModelLoader();

/** Placeholder sebelum model .glb tersedia / selesai diunduh. */
const cubes = MARKERS.map(({ color }) => {
  const size = 0.3; // 1 unit = lebar marker
  const cube = new THREE.Mesh(
    new THREE.BoxGeometry(size, size, size),
    new THREE.MeshStandardMaterial({ color, roughness: 0.35, metalness: 0.1 }),
  );
  cube.position.z = size / 2;
  return cube;
});

const registry = new MarkerRegistry(app.scene, {
  onFound: (targetIndex) => {
    setStatus(`${MARKERS[targetIndex].label} terdeteksi`);
    void ensureModel(targetIndex);
  },
  onLost: () => setStatus('Arahkan kamera ke kartu penanda'),
});

const groups = cubes.map((cube, targetIndex) => registry.register(targetIndex, cube));

/** Model diunduh saat markernya pertama kali terlihat, bukan di awal. */
const requested = new Set<number>();

async function ensureModel(targetIndex: number): Promise<void> {
  const { label, model } = MARKERS[targetIndex];
  if (!model || requested.has(targetIndex)) return;
  requested.add(targetIndex);

  setStatus(`Memuat model ${label}...`);

  try {
    const loaded = await models.load(model);
    const group = groups[targetIndex];

    group.add(fitToMarker(loaded, 1));
    group.remove(cubes[targetIndex]);
    cubes[targetIndex].geometry.dispose();
    cubes[targetIndex].material.dispose();

    setStatus(`${label} terdeteksi`);
  } catch (error) {
    // Boleh dicoba lagi saat marker terlihat berikutnya.
    requested.delete(targetIndex);
    setStatus(`Gagal memuat model ${label}`);
    console.error(error);
  }
}

app.addUpdatable({
  update: (delta) => {
    for (const cube of cubes) {
      if (cube.parent) cube.rotation.z += delta * 0.8;
    }
  },
});

app.addResizeHandler(() => session.syncCamera());

startButton.addEventListener('click', async () => {
  startButton.disabled = true;
  setStatus('Menyalakan kamera...');

  try {
    await session.start();
    startButton.hidden = true;
    setStatus('Arahkan kamera ke kartu penanda');
  } catch (error) {
    startButton.disabled = false;
    setStatus(error instanceof Error ? error.message : 'Gagal memulai AR');
    console.error(error);
  }
});

// Hot reload Vite: lepas resource lama agar tidak menumpuk context WebGL.
if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    session.dispose();
    registry.dispose();
    models.dispose();
    app.dispose();
  });
}
