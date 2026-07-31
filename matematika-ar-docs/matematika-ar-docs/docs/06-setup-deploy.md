# 06 — Setup & Deploy

## Setup proyek

```bash
# 1. Buat proyek Vite + TypeScript
npm create vite@latest matematika-ar -- --template vanilla-ts
cd matematika-ar

# 2. Dependencies
npm install three
npm install mind-ar            # gunakan fork WebARKit bila perlu
npm install -D typescript vite

# 3. Jalankan dev (buka di HP via IP lokal, atau langsung deploy Vercel)
npm run dev -- --host

# 4. Build produksi
npm run build                  # output ke /dist
```

> Untuk uji kamera di HP saat dev, cara termudah adalah deploy ke Vercel
> (HTTPS otomatis) daripada mengurus sertifikat lokal.

## Deploy ke Vercel

1. Push proyek ke GitHub.
2. Di Vercel: New Project → import repo. Vercel mendeteksi Vite otomatis
   (build `npm run build`, output `dist`).
3. Setiap push = deploy ulang otomatis. Dapat URL HTTPS.
4. Buat QR dari URL untuk dibagikan.

`vercel.json` (opsional, bila butuh cross-origin isolation):

```json
{
  "headers": [
    { "source": "/(.*)", "headers": [
      { "key": "Cross-Origin-Opener-Policy", "value": "same-origin" },
      { "key": "Cross-Origin-Embedder-Policy", "value": "require-corp" }
    ]}
  ]
}
```
