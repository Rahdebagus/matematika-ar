# 07 — Roadmap Bertahap

Kerjakan berurutan; tiap fase menghasilkan sesuatu yang bisa diuji di HP.

- **Fase 0 — Scaffold.** Vite+TS+Three render scene kosong + kubus.
- **Fase 1 — Kamera AR.** MindAR menyala; satu target menampilkan kubus di marker.
- **Fase 2 — Model.** `ModelLoader` memuat `.glb` di atas marker.
- **Fase 3 — Measurement.** Load JSON → `MeasurementController` gambar garis + label.
- **Fase 4 — Overlay AR.** Tombol tampilkan/sembunyikan/transparan/reset + status.
- **Fase 5 — Layar & Router.** Menu, Panduan, Tentang, transisi fade; Materi = Dialog.
- **Fase 6 — Polish.** Bloom neon, transparansi fade, audio klik + musik.
- **Fase 7 — Multi-marker.** 4 objek dengan `targetIndex` berbeda.
- **Fase 8 — Deploy.** Vercel + QR + optimasi ukuran model.

Setiap fase = satu atau beberapa permintaan ke Copilot yang merujuk
`03-modules.md`. Jangan minta seluruh aplikasi sekaligus.
