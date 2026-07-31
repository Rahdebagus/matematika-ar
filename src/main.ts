import * as THREE from 'three';
import { App } from './core/App';
import { ARSession } from './core/ARSession';
import { MarkerRegistry } from './ar/MarkerRegistry';

/** Urutan sama dengan MARKERS di scripts/compile-targets.mjs = targetIndex. */
const MARKERS = [
  { label: 'Objek 1', color: 0x4f8cff },
  { label: 'Objek 2', color: 0xffb347 },
  { label: 'Objek 3', color: 0x5ddc7a },
  { label: 'Objek 4', color: 0xff6b8a },
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

const registry = new MarkerRegistry(app.scene, {
  onFound: (targetIndex) => setStatus(`${MARKERS[targetIndex].label} terdeteksi`),
  onLost: () => setStatus('Arahkan kamera ke kartu penanda'),
});

/**
 * Kubus penanda Fase 1 — bukti anchor menempel benar di marker.
 * Fase 2 mengganti isinya dengan model .glb lewat ModelLoader.
 */
const cubes = MARKERS.map(({ color }) => {
  // 1 unit = lebar marker, jadi 0.3 = 30% lebar kartu.
  const size = 0.3;
  const cube = new THREE.Mesh(
    new THREE.BoxGeometry(size, size, size),
    new THREE.MeshStandardMaterial({ color, roughness: 0.35, metalness: 0.1 }),
  );
  // Z+ keluar dari permukaan marker — geser agar kubus duduk di atas kartu.
  cube.position.z = size / 2;
  return cube;
});

cubes.forEach((cube, targetIndex) => registry.register(targetIndex, cube));
registry.bind(session);

app.addUpdatable({
  update: (delta) => {
    for (const cube of cubes) {
      cube.rotation.z += delta * 0.8;
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
    app.dispose();
  });
}
