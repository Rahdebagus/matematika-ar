import { App } from './core/App';
import { ARSession } from './core/ARSession';
import { MarkerRegistry } from './ar/MarkerRegistry';
import { AnchorController } from './ar/AnchorController';
import { ModelLoader } from './models/ModelLoader';
import { loadAppData } from './data/loadAppData';

const container = document.querySelector<HTMLDivElement>('#app');
const statusEl = document.querySelector<HTMLParagraphElement>('#status');
const startButton = document.querySelector<HTMLButtonElement>('#start');

if (!container || !statusEl || !startButton) {
  throw new Error('Elemen #app / #status / #start tidak ditemukan di index.html');
}

const setStatus = (text: string) => {
  statusEl.textContent = text;
};

async function bootstrap(
  root: HTMLDivElement,
  button: HTMLButtonElement,
): Promise<void> {
  const app = new App(root);
  app.start();

  const data = await loadAppData('/data/app-data.json');

  const session = new ARSession({
    container: root,
    camera: app.camera,
    targetsUrl: data.targetsUrl,
    // Fase 7 menaikkan ini agar beberapa marker terlacak bersamaan.
    maxTrack: 1,
  });

  const models = new ModelLoader();
  const anchors = new Map<number, AnchorController>();

  const registry = new MarkerRegistry(app.scene, {
    onFound: (targetIndex) => {
      const anchor = anchors.get(targetIndex);
      if (!anchor) return;

      setStatus(`${anchor.object.displayName} terdeteksi`);
      void showAnchor(anchor);
    },
    onLost: () => setStatus('Arahkan kamera ke kartu penanda'),
  });

  for (const object of data.objects) {
    anchors.set(
      object.targetIndex,
      new AnchorController(
        registry.register(object.targetIndex),
        object,
        data.defaultStyle,
        models,
      ),
    );
  }

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
    } catch (error) {
      setStatus(`Gagal memuat ${anchor.object.displayName}`);
      console.error(error);
    }
  }

  app.addResizeHandler(() => {
    session.syncCamera();
    syncResolution();
  });

  button.addEventListener('click', async () => {
    button.disabled = true;
    setStatus('Menyalakan kamera...');

    try {
      await session.start();
      button.hidden = true;
      setStatus('Arahkan kamera ke kartu penanda');
    } catch (error) {
      button.disabled = false;
      setStatus(error instanceof Error ? error.message : 'Gagal memulai AR');
      console.error(error);
    }
  });

  // Hot reload Vite: lepas resource lama agar tidak menumpuk context WebGL.
  if (import.meta.hot) {
    import.meta.hot.dispose(() => {
      session.dispose();
      for (const anchor of anchors.values()) anchor.dispose();
      registry.dispose();
      models.dispose();
      app.dispose();
    });
  }
}

bootstrap(container, startButton).catch((error: unknown) => {
  startButton.disabled = true;
  setStatus(error instanceof Error ? error.message : 'Gagal memulai aplikasi');
  console.error(error);
});
