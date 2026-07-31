# Matematika AR

Aplikasi edukasi matematika berbasis **WebAR**. Anak mengarahkan kamera HP ke
kartu penanda, lalu objek 3D muncul lengkap dengan titik, garis ukur, dan label
untuk belajar pengukuran, bangun ruang, dan geometri. Jalan di browser HP tanpa
install APK.

## Tech stack

TypeScript · Vite · Three.js · MindAR (image tracking) · Vercel

## Perintah

```bash
npm install
npm run dev        # dev server (--host, bisa dibuka dari HP via IP lokal)
npm run build      # tsc + vite build -> dist/
npm run preview    # cek hasil build
npm run typecheck  # tsc --noEmit
npm run check:data # nilai label vs jarak titik di app-data.json (ikut jalan saat build)

# Uji asap end-to-end: Chrome sungguhan + kamera palsu yang "melihat" kartu.
# Perlu `npm run build` dulu. SMOKE_SHOT=<file.png> untuk menyimpan tangkapan layar.
npm run test:smoke -- public/markers/object-1.png

# Kompilasi ulang kartu penanda -> public/targets/targets.mind
# Jalankan hanya kalau gambar di public/markers/ berubah.
npm run compile:targets

# Optimasi model Blender/Unity untuk HP (tekstur -> WebP 1024px, geometri Draco)
npm run optimize:model -- "<sumber.glb>" public/models/<nama>.glb
```

> Urutan file di `scripts/compile-targets.mjs` menentukan `targetIndex`
> (object-1 = 0, object-2 = 1, dst). Jangan diacak tanpa memperbarui data.

> Kamera hanya aktif di origin aman: `localhost` atau HTTPS. Untuk uji AR di HP,
> deploy ke Vercel — bukan lewat IP lokal `http://`.

## Kontrol AR

| Gestur | Aksi |
|---|---|
| Geser satu jari mendatar | Putar objek 360°, tanpa batas |
| Geser satu jari tegak | Miringkan objek 360°, tanpa batas |
| Cubit dua jari | Perbesar / perkecil (0,35x – 3x) |
| Roda tetikus | Perbesar / perkecil (untuk uji di laptop) |
| Tombol Reset | Kembalikan putaran, ukuran, transparansi, dan tampilan garis |

Putaran memakai **sumbu layar**, bukan sumbu tetap objek: arah putar selalu
mengikuti arah jari berapa pun kemiringan kartu terhadap kamera. Rotasinya
ditumpuk sebagai quaternion sehingga bisa berputar terus tanpa terkunci.

Gestur dipasang di canvas 3D, bukan di container, supaya sentuhan pada tombol
overlay tidak ikut memutar objek.

## Status

Roadmap ada di [`matematika-ar-docs/matematika-ar-docs/docs/07-roadmap.md`](matematika-ar-docs/matematika-ar-docs/docs/07-roadmap.md).

- [x] **Fase 0** — Scaffold: Vite + TS + Three, render loop, kubus uji
- [x] **Fase 1** — Kamera AR: MindAR menyala, 4 marker terlacak, kubus di anchor
- [x] **Fase 2** — `ModelLoader` (.glb di atas marker) — baru Objek 4 yang punya model
- [x] **Fase 3** — Measurement: garis + label dari JSON (kubus & balok sebagai contoh)
- [x] **Fase 4** — Overlay AR: tampilkan/sembunyikan/transparan/reset + saring kategori
- [x] **Fase 5** — Layar & Router: menu, panduan, tentang, dialog Materi, transisi fade
- [x] **Fase 6** — Polish: bloom neon, fade transparansi, bunyi klik (musik menunggu berkas)
- [ ] **Fase 7** — Multi-marker
- [ ] **Fase 8** — Deploy + QR

## Dokumentasi

Spesifikasi lengkap (arsitektur, model data, kontrak modul, pipeline aset) ada di
[`matematika-ar-docs/matematika-ar-docs/`](matematika-ar-docs/matematika-ar-docs/).
