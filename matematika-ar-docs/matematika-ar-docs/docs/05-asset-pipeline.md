# 05 — Pipeline Aset

Tiga aset yang disiapkan di luar kode aplikasi.

## Model 3D (.glb)
Ekspor dari Unity/Blender ke glTF/GLB. Kompres dengan Draco bila ukurannya
besar. Taruh di `public/models/`.

## File target (.mind)
Kumpulkan gambar penanda (marker), lalu compile jadi satu `targets.mind`
memakai MindAR Image Target Compiler (tool online MindAR atau paket npm).
Urutan gambar menentukan `targetIndex` pada `app-data.json`. Taruh di
`public/targets/`.

## Data measurement (JSON)
Diekspor dari Unity. Buat **editor script** di Unity yang:
- membaca semua `MeasurementPoint` (posisi lokal terhadap model),
- membaca `MeasurementProfile` (measurements + style),
- menulis `app-data.json` sesuai skema di `02-data-model.md`.

Ini memindahkan penataan visual Unity ke web tanpa mengetik koordinat manual.
Taruh hasilnya di `public/data/app-data.json`.

> Rekomendasi: buat exporter Unity ini LEBIH DULU sebelum menulis kode web,
> supaya data siap saat modul measurement dikerjakan (Fase 3).
