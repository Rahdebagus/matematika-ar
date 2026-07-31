# 02 — Model Data (JSON)

Satu file `public/data/app-data.json` berisi semua objek, diekspor dari Unity
(lihat `05-asset-pipeline.md`). Sistem koordinat: posisi **lokal terhadap
model**, satuan meter.

## Tipe TypeScript

```ts
// src/data/types.ts
export type Vec3 = [number, number, number];

export interface PointData {
  id: string;            // "A", "B", ... "P"
  position: Vec3;        // lokal terhadap model
}

export interface MeasurementDef {
  id: string;            // "AB" (unik)
  from: string;          // point id
  to: string;            // point id ; from === to => titik tunggal (label saja)
  category?: string;     // "Bedug", "Frame", ...
  symbol?: string;       // "d"
  displayName?: string;  // "Diameter"
  value?: string;        // "100" (manual)
  unit?: string;         // "cm"
  showPointPair?: boolean;
  visibleOnStart?: boolean;
}

export interface MeasurementStyle {
  lineColor: string;      // "#14E6FF"
  lineWidth: number;      // world units
  labelColor: string;
  labelFontSize: number;  // px (CSS2D)
  showArrows: boolean;
  arrowLength: number;
  arrowHalfWidth: number;
}

export interface ObjectData {
  id: string;             // "bedug"
  displayName: string;    // "Bedug"
  modelUrl: string;       // "/models/bedug.glb"
  targetIndex: number;    // indeks di file .mind
  scale?: number;
  points: PointData[];
  measurements: MeasurementDef[];
  style?: Partial<MeasurementStyle>;   // override default
}

export interface AppData {
  targetsUrl: string;     // "/targets/targets.mind"
  defaultStyle: MeasurementStyle;
  objects: ObjectData[];
}
```

## Contoh app-data.json

```json
{
  "targetsUrl": "/targets/targets.mind",
  "defaultStyle": { "lineColor": "#14E6FF", "lineWidth": 0.008,
    "labelColor": "#FFFFFF", "labelFontSize": 22, "showArrows": true,
    "arrowLength": 0.04, "arrowHalfWidth": 0.018 },
  "objects": [
    {
      "id": "bedug", "displayName": "Bedug",
      "modelUrl": "/models/bedug.glb", "targetIndex": 0,
      "points": [
        { "id": "A", "position": [-0.5, 0.0, 0.5] },
        { "id": "B", "position": [ 0.5, 0.0, 0.5] }
      ],
      "measurements": [
        { "id": "AB", "from": "A", "to": "B",
          "displayName": "Lebar", "value": "100", "unit": "cm",
          "category": "Bedug", "visibleOnStart": true }
      ]
    }
  ]
}
```
