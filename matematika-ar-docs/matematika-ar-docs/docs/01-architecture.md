# 01 — Arsitektur

## Struktur folder

```
matematika-ar/
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
├── vercel.json                  # header COOP/COEP bila perlu
├── public/
│   ├── targets/targets.mind     # gambar penanda ter-compile (semua marker)
│   ├── models/*.glb             # model 3D per objek
│   ├── data/app-data.json       # titik + measurement + style
│   └── markers/*.png            # kartu penanda siap cetak
└── src/
    ├── main.ts                  # entry point
    ├── core/
    │   ├── App.ts               # bootstrap aplikasi + render loop
    │   ├── Router.ts            # navigasi antar-layar + transisi
    │   └── ARSession.ts         # siklus MindAR (start/stop kamera)
    ├── ar/
    │   ├── MarkerRegistry.ts    # target index -> objek + event found/lost
    │   └── AnchorController.ts  # isi tiap anchor (model + measurement)
    ├── measurement/
    │   ├── MeasurementController.ts  # ~ MeasurementManager
    │   ├── LineVisual.ts             # ~ MeasurementVisual (garis + panah)
    │   └── Label.ts                  # label CSS2D
    ├── models/
    │   └── ModelLoader.ts       # GLTFLoader + cache
    ├── ui/
    │   ├── screens/             # menu, materi, panduan, tentang
    │   ├── AROverlay.ts         # kontrol AR
    │   └── Dialog.ts            # popup "coming soon" (Materi)
    ├── data/
    │   ├── types.ts             # semua interface
    │   └── loadAppData.ts       # fetch + parse JSON
    ├── audio/
    │   └── AudioManager.ts      # ~ AudioManager
    └── styles/*.css
```

## Pemetaan Unity → Web

Konsep identik; hanya pindah bahasa/mesin.

| Unity (C#) | Web (TypeScript) |
|---|---|
| `MeasurementManager` | `measurement/MeasurementController.ts` |
| `MeasurementVisual` | `measurement/LineVisual.ts` + `Label.ts` |
| `MeasurementPoint` | data JSON `points[]` |
| `MeasurementDefinition` | data JSON `measurements[]` |
| `MeasurementVisualStyle` | data JSON `style` |
| `ARMarker` / `ARMarkerManager` | `ar/MarkerRegistry.ts` + `AnchorController.ts` |
| `MeasurementUIController` / `ARUIController` | `ui/AROverlay.ts` |
| `ModelTransparencyToggle` | method di `MeasurementController` |
| `AudioManager` | `audio/AudioManager.ts` |
| `SceneNavigator` / `SceneTransition` | `core/Router.ts` |
| `ComingSoonDialog` | `ui/Dialog.ts` |

## Alur AR

1. `ARSession` menginisialisasi MindAR dengan `targetsUrl` dan kamera.
2. MindAR menyediakan satu **anchor** per `targetIndex`, dengan event
   `onTargetFound` / `onTargetLost`.
3. `MarkerRegistry` memetakan `targetIndex → ObjectData`, membuat satu
   `AnchorController` per objek, dan menempelkan `Object3D` ke anchor MindAR.
4. Saat found: muat model (`ModelLoader`), bangun measurement
   (`MeasurementController.build()`), arahkan UI ke controller aktif.
5. Saat lost: konten disembunyikan; UI kembali ke status "arahkan ke marker".

Model + garis mengikuti anchor karena menempel sebagai child-nya — sama
seperti Bedug menjadi child ImageTarget di Unity.
