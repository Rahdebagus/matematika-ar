/**
 * mind-ar tidak mengirim file .d.ts. Kita hanya memakai `Controller`
 * (inti tracking, bebas Three.js), bukan wrapper `MindARThree` — wrapper itu
 * meng-import `sRGBEncoding` yang sudah dihapus sejak three r152.
 */
declare module 'mind-ar/src/image-target/controller.js' {
  export interface ControllerUpdateData {
    type: 'updateMatrix' | string;
    targetIndex: number;
    /** Matriks 4x4 column-major, atau null saat target hilang. */
    worldMatrix: number[] | null;
  }

  export interface ControllerOptions {
    inputWidth: number;
    inputHeight: number;
    onUpdate?: ((data: ControllerUpdateData) => void) | null;
    debugMode?: boolean;
    maxTrack?: number;
    warmupTolerance?: number | null;
    missTolerance?: number | null;
    filterMinCF?: number | null;
    filterBeta?: number | null;
  }

  export class Controller {
    inputWidth: number;
    inputHeight: number;

    constructor(options: ControllerOptions);

    /** Memuat .mind; `dimensions` = [lebar, tinggi] tiap target, urut targetIndex. */
    addImageTargets(fileURL: string): Promise<{ dimensions: [number, number][] }>;

    /** Pemanasan GPU — kernel pertama lambat dibangun. */
    dummyRun(input: HTMLVideoElement): void;

    processVideo(input: HTMLVideoElement): void;
    stopProcessVideo(): void;

    /** Matriks proyeksi GL (column-major, 16 angka). */
    getProjectionMatrix(): number[];

    dispose(): void;
  }
}
