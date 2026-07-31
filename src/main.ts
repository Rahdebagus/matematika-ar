import { App } from './core/App';

const container = document.querySelector<HTMLDivElement>('#app');
if (!container) {
  throw new Error('Elemen #app tidak ditemukan di index.html');
}

const app = new App(container);
app.start();

// Hot reload Vite: lepas resource lama agar tidak menumpuk context WebGL.
if (import.meta.hot) {
  import.meta.hot.dispose(() => app.dispose());
}
