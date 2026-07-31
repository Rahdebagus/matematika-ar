# 08 — Konvensi Kode & Dependencies

## Konvensi
- Satu class/modul per file; nama file = nama class.
- Tidak ada framework UI; tiap layar = modul TS yang mengelola elemennya.
- Semua posisi dalam meter, lokal terhadap model.
- Warna disimpan sebagai hex string; util konversi ke `THREE.Color` di satu tempat.
- Data (JSON) tidak pernah di-hardcode di logika; selalu lewat `types.ts`.
- Render loop tunggal di `App`; modul mengekspos `update()` bila perlu.
- Bersihkan resource Three.js di `dispose()` (geometry, material, texture).

## Dependencies

```jsonc
{
  "dependencies": {
    "three": "^0.16x",        // versi Three.js terbaru saat setup
    "mind-ar": "^1.2.x"       // fork WebARKit
  },
  "devDependencies": {
    "typescript": "^5.x",
    "vite": "^5.x"
  }
}
```

> Kunci versi persis saat `npm install` pertama, lalu commit `package-lock.json`.
