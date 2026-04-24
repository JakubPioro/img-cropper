import type { CropRect } from "../types/image";

export function getTargetRatio(width: number, height: number): number {
  return width / height;
}

export function getOrientedTargetSize(
  sourceWidth: number,
  sourceHeight: number,
  targetWidth: number,
  targetHeight: number,
): { width: number; height: number } {
  const sourceIsLandscape = sourceWidth >= sourceHeight;
  const targetIsLandscape = targetWidth >= targetHeight;

  if (sourceIsLandscape === targetIsLandscape) {
    return { width: targetWidth, height: targetHeight };
  }

  return { width: targetHeight, height: targetWidth };
}

export function getTargetRatioForSource(
  sourceWidth: number,
  sourceHeight: number,
  targetWidth: number,
  targetHeight: number,
): number {
  const orientedTarget = getOrientedTargetSize(
    sourceWidth,
    sourceHeight,
    targetWidth,
    targetHeight,
  );

  return orientedTarget.width / orientedTarget.height;
}

export function getCenteredCropRect(
  sourceWidth: number,
  sourceHeight: number,
  targetRatio: number,
): CropRect {
  const sourceRatio = sourceWidth / sourceHeight;

  if (Math.abs(sourceRatio - targetRatio) < 0.0001) {
    return { x: 0, y: 0, width: sourceWidth, height: sourceHeight };
  }

  if (sourceRatio > targetRatio) {
    const cropWidth = Math.round(sourceHeight * targetRatio);
    return {
      x: Math.round((sourceWidth - cropWidth) / 2),
      y: 0,
      width: cropWidth,
      height: sourceHeight,
    };
  }

  const cropHeight = Math.round(sourceWidth / targetRatio);
  return {
    x: 0,
    y: Math.round((sourceHeight - cropHeight) / 2),
    width: sourceWidth,
    height: cropHeight,
  };
}

export function clampCropRect(
  rect: CropRect,
  sourceWidth: number,
  sourceHeight: number,
): CropRect {
  const width = Math.max(1, Math.min(rect.width, sourceWidth));
  const height = Math.max(1, Math.min(rect.height, sourceHeight));
  const x = Math.max(0, Math.min(rect.x, sourceWidth - width));
  const y = Math.max(0, Math.min(rect.y, sourceHeight - height));

  return {
    x: Math.round(x),
    y: Math.round(y),
    width: Math.round(width),
    height: Math.round(height),
  };
}
