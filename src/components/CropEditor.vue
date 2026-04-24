<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from "vue";
import type { CropRect } from "../types/image";

const props = defineProps<{
  sourceUrl: string;
  sourceWidth: number | null;
  sourceHeight: number | null;
  targetWidth: number;
  targetHeight: number;
  initialCrop: CropRect | null;
  initialRotation: 0 | 90 | 180 | 270;
  initialSwapTargetAxes: boolean;
}>();

const emit = defineEmits<{
  save: [
    payload: {
      cropRect: CropRect;
      sourceWidth: number;
      sourceHeight: number;
      rotationDeg: 0 | 90 | 180 | 270;
      swapTargetAxes: boolean;
    },
  ];
}>();

const canvasRef = ref<HTMLCanvasElement | null>(null);
const imageRef = ref<HTMLImageElement | null>(null);
const originalImageRef = ref<HTMLImageElement | null>(null);
const cropRect = ref<CropRect | null>(null);
const rotationDeg = ref<0 | 90 | 180 | 270>(props.initialRotation);
const swapTargetAxes = ref(props.initialSwapTargetAxes);
const dragging = ref(false);
const activePointerId = ref<number | null>(null);
const dragOffset = ref({ x: 0, y: 0 });
const canvasCursor = ref("default");
const interactionMode = ref<
  "none" | "move" | "resize-nw" | "resize-ne" | "resize-sw" | "resize-se"
>("none");

const HANDLE_SIZE = 8;
const HANDLE_HIT_RADIUS = 10;
const MIN_CROP_WIDTH = 40;

const targetRatio = computed(() => {
  const baseRatio = props.targetWidth / props.targetHeight;
  return swapTargetAxes.value ? 1 / baseRatio : baseRatio;
});

function centeredCrop(sourceWidth: number, sourceHeight: number): CropRect {
  const sourceRatio = sourceWidth / sourceHeight;
  if (sourceRatio > targetRatio.value) {
    const width = Math.round(sourceHeight * targetRatio.value);
    return {
      x: Math.round((sourceWidth - width) / 2),
      y: 0,
      width,
      height: sourceHeight,
    };
  }

  const height = Math.round(sourceWidth / targetRatio.value);
  return {
    x: 0,
    y: Math.round((sourceHeight - height) / 2),
    width: sourceWidth,
    height,
  };
}

function centerRectForCurrentRatio(
  sourceWidth: number,
  sourceHeight: number,
): CropRect {
  return clampRect(
    centeredCrop(sourceWidth, sourceHeight),
    sourceWidth,
    sourceHeight,
  );
}

function clampRect(
  rect: CropRect,
  sourceWidth: number,
  sourceHeight: number,
): CropRect {
  const width = Math.min(rect.width, sourceWidth);
  const height = Math.min(rect.height, sourceHeight);
  const x = Math.max(0, Math.min(rect.x, sourceWidth - width));
  const y = Math.max(0, Math.min(rect.y, sourceHeight - height));
  return {
    x: Math.round(x),
    y: Math.round(y),
    width: Math.round(width),
    height: Math.round(height),
  };
}

function normalizeRotation(next: number): 0 | 90 | 180 | 270 {
  const normalized = ((next % 360) + 360) % 360;
  if (normalized === 90 || normalized === 180 || normalized === 270) {
    return normalized;
  }

  return 0;
}

async function buildRotatedImage(
  image: HTMLImageElement,
  rotation: 0 | 90 | 180 | 270,
): Promise<HTMLImageElement> {
  if (rotation === 0) {
    return image;
  }

  const canvas = document.createElement("canvas");
  if (rotation === 90 || rotation === 270) {
    canvas.width = image.naturalHeight;
    canvas.height = image.naturalWidth;
  } else {
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
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

  ctx.drawImage(image, 0, 0);

  const rotatedImage = new Image();
  rotatedImage.src = canvas.toDataURL("image/png");
  await rotatedImage.decode();
  return rotatedImage;
}

async function applyRotation(next: 0 | 90 | 180 | 270): Promise<void> {
  const original = originalImageRef.value;
  if (!original) {
    return;
  }

  rotationDeg.value = next;
  imageRef.value = await buildRotatedImage(original, next);

  const image = imageRef.value;
  if (!image) {
    return;
  }

  const useInitial = props.initialCrop && next === props.initialRotation;
  cropRect.value = useInitial
    ? clampRect(props.initialCrop, image.naturalWidth, image.naturalHeight)
    : centerRectForCurrentRatio(image.naturalWidth, image.naturalHeight);

  await nextTick();
  drawCanvas();
}

async function rotateBy(delta: number): Promise<void> {
  const nextRotation = normalizeRotation(rotationDeg.value + delta);
  await applyRotation(nextRotation);
}

function rotateSelectionArea(): void {
  const image = imageRef.value;
  const rect = cropRect.value;
  if (!image || !rect) {
    return;
  }

  swapTargetAxes.value = !swapTargetAxes.value;

  const nextRatio = targetRatio.value;
  const area = rect.width * rect.height;
  const centerX = rect.x + rect.width / 2;
  const centerY = rect.y + rect.height / 2;

  const estimatedWidth = Math.sqrt(Math.max(area, MIN_CROP_WIDTH) * nextRatio);
  const width = Math.max(MIN_CROP_WIDTH, estimatedWidth);
  const height = width / nextRatio;

  cropRect.value = clampRect(
    {
      x: Math.round(centerX - width / 2),
      y: Math.round(centerY - height / 2),
      width: Math.round(width),
      height: Math.round(height),
    },
    image.naturalWidth,
    image.naturalHeight,
  );

  drawCanvas();
}

function drawCanvas(): void {
  const canvas = canvasRef.value;
  const image = imageRef.value;
  const rect = cropRect.value;
  if (!canvas || !image || !rect) {
    return;
  }

  const maxDisplay = 800;
  const scale = Math.min(
    maxDisplay / image.naturalWidth,
    520 / image.naturalHeight,
    1,
  );
  const displayWidth = Math.round(image.naturalWidth * scale);
  const displayHeight = Math.round(image.naturalHeight * scale);

  canvas.width = displayWidth;
  canvas.height = displayHeight;

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return;
  }

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(image, 0, 0, displayWidth, displayHeight);

  const scaleX = displayWidth / image.naturalWidth;
  const scaleY = displayHeight / image.naturalHeight;

  const rx = rect.x * scaleX;
  const ry = rect.y * scaleY;
  const rw = rect.width * scaleX;
  const rh = rect.height * scaleY;

  ctx.fillStyle = "rgba(0,0,0,0.45)";
  ctx.fillRect(0, 0, displayWidth, displayHeight);

  // Repaint selected region so the crop area stays visible instead of becoming transparent.
  ctx.drawImage(image, rect.x, rect.y, rect.width, rect.height, rx, ry, rw, rh);

  ctx.strokeStyle = "#cf6f41";
  ctx.lineWidth = 2;
  ctx.strokeRect(rx, ry, rw, rh);

  const handles = [
    { x: rx, y: ry },
    { x: rx + rw, y: ry },
    { x: rx, y: ry + rh },
    { x: rx + rw, y: ry + rh },
  ];

  ctx.fillStyle = "#ffffff";
  ctx.strokeStyle = "#141414";
  ctx.lineWidth = 1.5;
  for (const handle of handles) {
    ctx.fillRect(
      handle.x - HANDLE_SIZE / 2,
      handle.y - HANDLE_SIZE / 2,
      HANDLE_SIZE,
      HANDLE_SIZE,
    );
    ctx.strokeRect(
      handle.x - HANDLE_SIZE / 2,
      handle.y - HANDLE_SIZE / 2,
      HANDLE_SIZE,
      HANDLE_SIZE,
    );
  }
}

function canvasDisplayPoint(
  event: PointerEvent,
): { x: number; y: number } | null {
  const canvas = canvasRef.value;
  if (!canvas) {
    return null;
  }

  const bounds = canvas.getBoundingClientRect();
  const px = event.clientX - bounds.left;
  const py = event.clientY - bounds.top;

  if (px < 0 || py < 0 || px > bounds.width || py > bounds.height) {
    return null;
  }

  return { x: px, y: py };
}

function canvasPoint(event: PointerEvent): { x: number; y: number } | null {
  const canvas = canvasRef.value;
  const image = imageRef.value;
  if (!canvas || !image) {
    return null;
  }

  const displayPoint = canvasDisplayPoint(event);
  if (!displayPoint) {
    return null;
  }

  const bounds = canvas.getBoundingClientRect();

  const x = (displayPoint.x / bounds.width) * image.naturalWidth;
  const y = (displayPoint.y / bounds.height) * image.naturalHeight;

  return { x, y };
}

function getDisplayCropRect(
  rect: CropRect,
  image: HTMLImageElement,
  canvas: HTMLCanvasElement,
): CropRect {
  const scaleX = canvas.width / image.naturalWidth;
  const scaleY = canvas.height / image.naturalHeight;
  return {
    x: rect.x * scaleX,
    y: rect.y * scaleY,
    width: rect.width * scaleX,
    height: rect.height * scaleY,
  };
}

function getHoverMode(
  event: PointerEvent,
): "none" | "move" | "resize-nw" | "resize-ne" | "resize-sw" | "resize-se" {
  const point = canvasDisplayPoint(event);
  const canvas = canvasRef.value;
  const image = imageRef.value;
  const rect = cropRect.value;
  if (!point || !canvas || !image || !rect) {
    return "none";
  }

  const displayRect = getDisplayCropRect(rect, image, canvas);

  const corners = [
    { mode: "resize-nw" as const, x: displayRect.x, y: displayRect.y },
    {
      mode: "resize-ne" as const,
      x: displayRect.x + displayRect.width,
      y: displayRect.y,
    },
    {
      mode: "resize-sw" as const,
      x: displayRect.x,
      y: displayRect.y + displayRect.height,
    },
    {
      mode: "resize-se" as const,
      x: displayRect.x + displayRect.width,
      y: displayRect.y + displayRect.height,
    },
  ];

  for (const corner of corners) {
    const dist = Math.hypot(point.x - corner.x, point.y - corner.y);
    if (dist <= HANDLE_HIT_RADIUS) {
      return corner.mode;
    }
  }

  const inside =
    point.x >= displayRect.x &&
    point.x <= displayRect.x + displayRect.width &&
    point.y >= displayRect.y &&
    point.y <= displayRect.y + displayRect.height;

  return inside ? "move" : "none";
}

function cursorForMode(
  mode: "none" | "move" | "resize-nw" | "resize-ne" | "resize-sw" | "resize-se",
): string {
  if (mode === "move") {
    return "move";
  }
  if (mode === "resize-nw" || mode === "resize-se") {
    return "nwse-resize";
  }
  if (mode === "resize-ne" || mode === "resize-sw") {
    return "nesw-resize";
  }
  return "default";
}

function getResizedRect(
  mode: "resize-nw" | "resize-ne" | "resize-sw" | "resize-se",
  point: { x: number; y: number },
  currentRect: CropRect,
  sourceWidth: number,
  sourceHeight: number,
): CropRect {
  const ratio = targetRatio.value;
  const minWidth = MIN_CROP_WIDTH;

  let anchorX = 0;
  let anchorY = 0;
  let proposedWidth = minWidth;
  let maxWidth = minWidth;

  if (mode === "resize-se") {
    anchorX = currentRect.x;
    anchorY = currentRect.y;
    proposedWidth = Math.min(point.x - anchorX, (point.y - anchorY) * ratio);
    maxWidth = Math.min(
      sourceWidth - anchorX,
      (sourceHeight - anchorY) * ratio,
    );
    const width = Math.max(
      1,
      Math.min(maxWidth, Math.max(minWidth, proposedWidth)),
    );
    return {
      x: Math.round(anchorX),
      y: Math.round(anchorY),
      width: Math.round(width),
      height: Math.round(width / ratio),
    };
  }

  if (mode === "resize-nw") {
    anchorX = currentRect.x + currentRect.width;
    anchorY = currentRect.y + currentRect.height;
    proposedWidth = Math.min(anchorX - point.x, (anchorY - point.y) * ratio);
    maxWidth = Math.min(anchorX, anchorY * ratio);
    const width = Math.max(
      1,
      Math.min(maxWidth, Math.max(minWidth, proposedWidth)),
    );
    return {
      x: Math.round(anchorX - width),
      y: Math.round(anchorY - width / ratio),
      width: Math.round(width),
      height: Math.round(width / ratio),
    };
  }

  if (mode === "resize-ne") {
    anchorX = currentRect.x;
    anchorY = currentRect.y + currentRect.height;
    proposedWidth = Math.min(point.x - anchorX, (anchorY - point.y) * ratio);
    maxWidth = Math.min(sourceWidth - anchorX, anchorY * ratio);
    const width = Math.max(
      1,
      Math.min(maxWidth, Math.max(minWidth, proposedWidth)),
    );
    return {
      x: Math.round(anchorX),
      y: Math.round(anchorY - width / ratio),
      width: Math.round(width),
      height: Math.round(width / ratio),
    };
  }

  anchorX = currentRect.x + currentRect.width;
  anchorY = currentRect.y;
  proposedWidth = Math.min(anchorX - point.x, (point.y - anchorY) * ratio);
  maxWidth = Math.min(anchorX, (sourceHeight - anchorY) * ratio);
  const width = Math.max(
    1,
    Math.min(maxWidth, Math.max(minWidth, proposedWidth)),
  );
  return {
    x: Math.round(anchorX - width),
    y: Math.round(anchorY),
    width: Math.round(width),
    height: Math.round(width / ratio),
  };
}

function pointerDown(event: PointerEvent): void {
  const point = canvasPoint(event);
  const canvas = canvasRef.value;
  const image = imageRef.value;
  if (!point || !canvas || !image) {
    return;
  }

  const mode = getHoverMode(event);
  if (mode === "none") {
    return;
  }

  dragging.value = true;
  activePointerId.value = event.pointerId;
  interactionMode.value = mode;
  canvasCursor.value = cursorForMode(mode);
  canvas.setPointerCapture(event.pointerId);

  if (mode === "move") {
    const rect = cropRect.value;
    if (!rect) {
      return;
    }

    dragOffset.value = {
      x: point.x - rect.x,
      y: point.y - rect.y,
    };
  }
}

function pointerMove(event: PointerEvent): void {
  const image = imageRef.value;
  const rect = cropRect.value;
  if (!image || !rect) {
    canvasCursor.value = "default";
    return;
  }

  if (!dragging.value) {
    const hoverMode = getHoverMode(event);
    canvasCursor.value = cursorForMode(hoverMode);
    return;
  }

  if (activePointerId.value !== event.pointerId) {
    return;
  }

  const point = canvasPoint(event);
  if (!point) {
    return;
  }

  if (interactionMode.value === "move") {
    cropRect.value = clampRect(
      {
        ...rect,
        x: point.x - dragOffset.value.x,
        y: point.y - dragOffset.value.y,
      },
      image.naturalWidth,
      image.naturalHeight,
    );
  } else if (interactionMode.value !== "none") {
    const resized = getResizedRect(
      interactionMode.value,
      point,
      rect,
      image.naturalWidth,
      image.naturalHeight,
    );

    cropRect.value = clampRect(
      resized,
      image.naturalWidth,
      image.naturalHeight,
    );
  }

  drawCanvas();
}

function pointerUp(event: PointerEvent): void {
  const canvas = canvasRef.value;
  if (canvas && activePointerId.value === event.pointerId) {
    canvas.releasePointerCapture(event.pointerId);
  }

  activePointerId.value = null;
  interactionMode.value = "none";
  dragging.value = false;

  const hoverMode = getHoverMode(event);
  canvasCursor.value = cursorForMode(hoverMode);
}

function saveCrop(): void {
  const rect = cropRect.value;
  const image = imageRef.value;
  if (!rect || !image) {
    return;
  }

  emit("save", {
    cropRect: rect,
    sourceWidth: image.naturalWidth,
    sourceHeight: image.naturalHeight,
    rotationDeg: rotationDeg.value,
    swapTargetAxes: swapTargetAxes.value,
  });
}

async function loadImage(): Promise<void> {
  const image = new Image();
  image.src = props.sourceUrl;
  await image.decode();
  originalImageRef.value = image;
  swapTargetAxes.value = props.initialSwapTargetAxes;
  await applyRotation(props.initialRotation);
}

watch(
  () => props.sourceUrl,
  async () => {
    await loadImage();
  },
);

watch(
  () => [props.targetWidth, props.targetHeight],
  async () => {
    const image = imageRef.value;
    if (!image) {
      return;
    }

    cropRect.value = centerRectForCurrentRatio(
      image.naturalWidth,
      image.naturalHeight,
    );
    await nextTick();
    drawCanvas();
  },
);

onMounted(async () => {
  await loadImage();
});
</script>

<template>
  <section
    class="panel-rise relative border-4 border-bauBlack bg-[#e7eeff] p-5 shadow-bauHard"
  >
    <div
      class="pointer-events-none absolute left-0 top-0 h-2 w-20 bg-bauRed"
    ></div>
    <div
      class="pointer-events-none absolute left-20 top-0 h-2 w-20 bg-bauYellow"
    ></div>
    <h3 class="text-2xl font-bold uppercase tracking-wide text-bauBlack">
      Reczne kadrowanie
    </h3>
    <p class="mt-2 text-base font-medium text-bauBlack/80">
      Przeciagnij zaznaczony prostokat, aby ustawic kadr. Proporcja jest
      zablokowana do finalnego rozmiaru.
    </p>

    <div class="editor-sections">
      <div class="controls-row">
        <button
          class="rotate-btn"
          aria-label="Obroc w lewo"
          type="button"
          @click="rotateBy(-90)"
        >
          <svg class="icon-fill" viewBox="0 0 24 24" aria-hidden="true">
            <path
              d="M7.1 6.2V2.5L2.6 7l4.5 4.5V7.8h6.6a5 5 0 1 1-5 5h-2a7 7 0 1 0 7-7H7.1Z"
            />
          </svg>
        </button>
        <button
          class="rotate-btn"
          aria-label="Obroc w prawo"
          type="button"
          @click="rotateBy(90)"
        >
          <svg class="icon-fill" viewBox="0 0 24 24" aria-hidden="true">
            <path
              d="M16.9 6.2V2.5l4.5 4.5-4.5 4.5V7.8h-6.6a5 5 0 1 0 5 5h2a7 7 0 1 1-7-7h6.6Z"
            />
          </svg>
        </button>
        <button
          class="rotate-btn rotate-btn-orientation"
          aria-label="Obroc ramke"
          title="Obroc ramke"
          type="button"
          @click="rotateSelectionArea"
        >
          <svg class="icon-stroke" viewBox="0 0 24 24" aria-hidden="true">
            <rect x="8" y="8" width="8" height="8" rx="1" />
            <path d="M7 4H4v3" />
            <path d="M4 7a7 7 0 0 1 11-3" />
            <path d="M17 20h3v-3" />
            <path d="M20 17a7 7 0 0 1-11 3" />
          </svg>
          <span>Obroc ramke</span>
        </button>
      </div>

      <div
        class="canvas-wrap overflow-auto border-2 border-bauBlack bg-bauCream p-2"
      >
        <canvas
          ref="canvasRef"
          class="mx-auto block touch-none"
          :style="{ cursor: canvasCursor }"
          @pointerdown="pointerDown"
          @pointermove="pointerMove"
          @pointerup="pointerUp"
          @pointercancel="pointerUp"
        />
      </div>

      <div class="save-row flex flex-wrap gap-3">
        <button
          class="step-btn step-btn-yellow"
          type="button"
          @click="saveCrop"
        >
          Zapisz
        </button>
      </div>
    </div>
  </section>
</template>

<style scoped>
.editor-sections {
  --section-gap: 8px;
  margin-top: var(--section-gap);
  display: grid;
  gap: var(--section-gap);
}

.controls-row {
  display: flex;
  flex-direction: row;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-start;
  column-gap: 8px;
  row-gap: 8px;
}

.rotate-btn {
  border: 2px solid #141414;
  background: #fff;
  width: 34px;
  height: 34px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

.rotate-btn .icon-fill {
  width: 18px;
  height: 18px;
  fill: #141414;
}

.rotate-btn .icon-stroke {
  width: 18px;
  height: 18px;
  fill: none;
  stroke: #141414;
  stroke-width: 2;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.rotate-btn-orientation {
  width: auto;
  min-width: 34px;
  padding: 0 10px;
  gap: 5px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-wrap: nowrap;
  white-space: nowrap;
}

.rotate-btn-orientation span {
  font-size: 10px;
  font-weight: 800;
  text-transform: uppercase;
  line-height: 1;
  white-space: nowrap;
}

.step-btn {
  border: 2px solid #141414;
  padding: 8px 10px;
  font-size: 12px;
  font-weight: 800;
  text-transform: uppercase;
  cursor: pointer;
}

.step-btn-yellow {
  background: #f2c230;
  color: #141414;
}
</style>
