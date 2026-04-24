import type {
  CropRect,
  OutputFormat,
  ProcessingSettings,
} from "../types/image";
import {
  clampCropRect,
  getCenteredCropRect,
  getOrientedTargetSize,
} from "./imageMath";

interface DecodedSource {
  source: CanvasImageSource;
  width: number;
  height: number;
  cleanup: () => void;
}

type RotationDeg = 0 | 90 | 180 | 270;

export interface ProcessResult {
  blob: Blob;
  outputName: string;
  sourceWidth: number;
  sourceHeight: number;
  autoCropRect: CropRect;
}

export interface ImageDimensions {
  sourceWidth: number;
  sourceHeight: number;
}

function mimeForFormat(format: OutputFormat): string {
  if (format === "png") {
    return "image/png";
  }

  if (format === "webp") {
    return "image/webp";
  }

  return "image/jpeg";
}

function extForFormat(format: OutputFormat): string {
  if (format === "png") {
    return "png";
  }

  if (format === "webp") {
    return "webp";
  }

  return "jpg";
}

function getOutputName(fileName: string, format: OutputFormat): string {
  const ext = extForFormat(format);
  const base = fileName.includes(".")
    ? fileName.substring(0, fileName.lastIndexOf("."))
    : fileName;
  return `${base}.${ext}`;
}

function loadImageElement(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Nie udalo sie wczytac obrazu."));
    img.src = url;
  });
}

async function decodeImage(file: File): Promise<DecodedSource> {
  if ("createImageBitmap" in window) {
    try {
      const bitmap = await createImageBitmap(file, {
        imageOrientation: "from-image",
      } as ImageBitmapOptions);
      return {
        source: bitmap,
        width: bitmap.width,
        height: bitmap.height,
        cleanup: () => bitmap.close(),
      };
    } catch {
      // Fallback below.
    }
  }

  const url = URL.createObjectURL(file);
  const image = await loadImageElement(url);
  return {
    source: image,
    width: image.naturalWidth,
    height: image.naturalHeight,
    cleanup: () => URL.revokeObjectURL(url),
  };
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  mime: string,
  quality: number,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("Nie udalo sie wygenerowac obrazu wyjsciowego."));
          return;
        }
        resolve(blob);
      },
      mime,
      quality,
    );
  });
}

function normalizeRotationDeg(rotationDeg: number): RotationDeg {
  const normalized = ((rotationDeg % 360) + 360) % 360;
  if (normalized === 90 || normalized === 180 || normalized === 270) {
    return normalized;
  }

  return 0;
}

function getRotatedSource(
  decoded: DecodedSource,
  rotationDeg: number,
): DecodedSource {
  const rotation = normalizeRotationDeg(rotationDeg);
  if (rotation === 0) {
    return {
      source: decoded.source,
      width: decoded.width,
      height: decoded.height,
      cleanup: () => {},
    };
  }

  const canvas = document.createElement("canvas");
  if (rotation === 90 || rotation === 270) {
    canvas.width = decoded.height;
    canvas.height = decoded.width;
  } else {
    canvas.width = decoded.width;
    canvas.height = decoded.height;
  }

  const ctx = canvas.getContext("2d", { alpha: false });
  if (!ctx) {
    throw new Error("Przegladarka nie obsluguje Canvas 2D.");
  }

  if (rotation === 90) {
    ctx.translate(canvas.width, 0);
    ctx.rotate(Math.PI / 2);
  } else if (rotation === 180) {
    ctx.translate(canvas.width, canvas.height);
    ctx.rotate(Math.PI);
  } else {
    ctx.translate(0, canvas.height);
    ctx.rotate(-Math.PI / 2);
  }

  ctx.drawImage(decoded.source, 0, 0);

  return {
    source: canvas,
    width: canvas.width,
    height: canvas.height,
    cleanup: () => {},
  };
}

export async function processImageFile(
  file: File,
  settings: ProcessingSettings,
  manualCropRect: CropRect | null,
  customName?: string,
  rotationDeg: RotationDeg = 0,
  swapTargetAxes = false,
): Promise<ProcessResult> {
  const decoded = await decodeImage(file);

  try {
    const rotated = getRotatedSource(decoded, rotationDeg);

    const orientedTargetSize = getOrientedTargetSize(
      rotated.width,
      rotated.height,
      settings.width,
      settings.height,
    );
    const targetSize = swapTargetAxes
      ? { width: orientedTargetSize.height, height: orientedTargetSize.width }
      : orientedTargetSize;
    const targetRatio = targetSize.width / targetSize.height;
    const autoCropRect = getCenteredCropRect(
      rotated.width,
      rotated.height,
      targetRatio,
    );
    const cropRect = manualCropRect
      ? clampCropRect(manualCropRect, rotated.width, rotated.height)
      : autoCropRect;

    const canvas = document.createElement("canvas");
    canvas.width = targetSize.width;
    canvas.height = targetSize.height;

    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) {
      throw new Error("Przegladarka nie obsluguje Canvas 2D.");
    }

    ctx.drawImage(
      rotated.source,
      cropRect.x,
      cropRect.y,
      cropRect.width,
      cropRect.height,
      0,
      0,
      targetSize.width,
      targetSize.height,
    );

    const blob = await canvasToBlob(
      canvas,
      mimeForFormat(settings.format),
      settings.quality,
    );

    return {
      blob,
      outputName: getOutputName(customName ?? file.name, settings.format),
      sourceWidth: rotated.width,
      sourceHeight: rotated.height,
      autoCropRect,
    };
  } finally {
    decoded.cleanup();
  }
}

export async function readImageDimensions(
  file: File,
): Promise<ImageDimensions> {
  const decoded = await decodeImage(file);
  try {
    return {
      sourceWidth: decoded.width,
      sourceHeight: decoded.height,
    };
  } finally {
    decoded.cleanup();
  }
}
