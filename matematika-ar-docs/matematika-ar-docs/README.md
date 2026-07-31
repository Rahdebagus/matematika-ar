# Matematika AR — WebAR

Aplikasi edukasi matematika berbasis **WebAR (image/marker tracking)**. Anak
mengarahkan kamera HP ke kartu penanda, lalu objek 3D (bedug, joglo, dsb.)
muncul lengkap dengan titik, garis ukur, dan label untuk belajar pengukuran,
bangun ruang, dan geometri. Jalan di browser HP tanpa install APK, dibagikan
lewat link/QR.

Versi web ini menggantikan versi Unity+Vuforia dengan logika yang sama,
ditulis ulang di web.

## Dokumentasi (baca berurutan)

1. [Arsitektur](docs/01-architecture.md) — struktur folder, modul, alur AR, pemetaan Unity→Web
2. [Model Data](docs/02-data-model.md) — skema JSON + tipe TypeScript
3. [Antarmuka Modul](docs/03-modules.md) — kontrak tiap class (untuk Copilot)
4. [Catatan Teknis](docs/04-tech-notes.md) — Line2, CSS2D, bloom, HTTPS, performa
5. [Pipeline Aset](docs/05-asset-pipeline.md) — .glb, .mind, ekspor JSON
6. [Setup & Deploy](docs/06-setup-deploy.md) — Vite, perintah, Vercel
7. [Roadmap](docs/07-roadmap.md) — fase pengembangan
8. [Konvensi](docs/08-conventions.md) — gaya kode + dependencies

## Tech stack singkat

| Bagian | Pilihan |
|---|---|
| Bahasa | TypeScript |
| Build | Vite |
| 3D | Three.js |
| AR | MindAR image (fork WebARKit) |
| Hosting | Vercel (statis + HTTPS) |

## Cara pakai dengan Copilot (VSCode)

- Taruh folder ini di root proyek.
- Saat meminta Copilot, rujuk file spesifik, mis:
  "implementasikan MeasurementController sesuai `docs/03-modules.md`".
- Kerjakan mengikuti `docs/07-roadmap.md` — fase demi fase, jangan sekaligus.
