# 04 — Catatan Teknis Penting

- **Garis tebal**: pakai `Line2` + `LineGeometry` + `LineMaterial` dari
  `three/examples/jsm/lines/*`. `LineBasicMaterial` mengabaikan ketebalan di
  banyak device. Set `material.resolution` saat resize.
- **Label**: `CSS2DRenderer` + `CSS2DObject`. Renderer label diposisikan
  absolute di atas canvas 3D; ukuran font px, otomatis menghadap kamera.
  Ini padanan TMP label yang tajam dan mudah di-style dengan CSS.
- **Neon/glow**: `EffectComposer` + `RenderPass` + `UnrealBloomPass`. Buat
  warna garis HDR (nilai > 1) agar melewati threshold bloom.
- **Transparansi model**: set `material.transparent = true` lalu animasikan
  `material.opacity` (atau tukar ke material "ghost"). Lewati mesh garis.
- **Titik tunggal** (`from === to`): jangan gambar garis; tampilkan label saja
  di posisi titik.
- **HTTPS wajib**: kamera hanya aktif di origin aman (localhost dev atau HTTPS).
- **Performa HP**: kompres `.glb` (gltf-pipeline/Draco), turunkan resolusi
  tekstur, batasi `renderer.setPixelRatio(Math.min(devicePixelRatio, 2))`.
- **maxTrack**: jumlah target dilacak bersamaan; set sesuai kebutuhan MindAR.
- **Render loop tunggal** di `App`; modul mengekspos `update()` bila perlu.
- **Dispose**: bebaskan geometry/material/texture Three.js saat objek dilepas.
