import type pl from "../locales/pl.json";

export type OutputFormat = "jpeg" | "png" | "webp";

export type JobStatus = "queued" | "processing" | "done" | "error";

export interface CropRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ProcessingSettings {
  width: number;
  height: number;
  format: OutputFormat;
  quality: number;
}

type NotificationKey = keyof (typeof pl)["notifications"]["messages"];
export type JobErrorKey = keyof (typeof pl)["errors"];

export interface NotificationMessage {
  id: string;
  level: "info" | "success" | "warning" | "error";
  key: NotificationKey;
  params?: Record<string, string | number>;
}

export interface ImageJob {
  id: string;
  file: File;
  customName: string | null;
  rotationDeg: 0 | 90 | 180 | 270;
  swapTargetAxes: boolean;
  originalUrl: string;
  status: JobStatus;
  error: JobErrorKey | null;
  outputBlob: Blob | null;
  outputUrl: string | null;
  outputName: string | null;
  sourceWidth: number | null;
  sourceHeight: number | null;
  autoCropRect: CropRect | null;
  manualCropRect: CropRect | null;
  updatedAt: number;
}
