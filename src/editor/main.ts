import { EditorScene } from './EditorScene';
import { EditorUI } from './EditorUI';
import { loadAppData } from '../data/loadAppData';

const viewport = document.querySelector<HTMLDivElement>('#viewport');
const panel = document.querySelector<HTMLElement>('#panel');

if (!viewport || !panel) {
  throw new Error('Kerangka DOM di editor.html tidak lengkap');
}

async function bootstrap(view: HTMLDivElement, host: HTMLElement): Promise<void> {
  const data = await loadAppData('/data/app-data.json');
  if (data.objects.length === 0) {
    throw new Error('app-data.json belum berisi objek apa pun');
  }

  let ui: EditorUI | null = null;
  const scene = new EditorScene(view, {
    onPointsChanged: () => ui?.refresh(),
    onSelectionChanged: () => ui?.refresh(),
  });

  ui = new EditorUI(host, scene, data);
}

bootstrap(viewport, panel).catch((error: unknown) => {
  const message = error instanceof Error ? error.message : 'Gagal memulai editor';
  panel.textContent = message;
  console.error(error);
});
