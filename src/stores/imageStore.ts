import { defineStore } from "pinia";
import { ref, computed } from "vue";
import { saveAs } from "file-saver";
import type {
  CropRect,
  ImageJob,
  NotificationMessage,
  ProcessingSettings,
} from "../types/image";
import {
  MAX_FILE_SIZE_MB,
  MAX_FILES,
  validateFiles,
} from "../utils/fileValidation";
import {
  ProcessingError,
  processImageFile,
  readImageDimensions,
} from "../utils/imagePipeline";
import {
  getCenteredCropRect,
  getTargetRatioForSource,
} from "../utils/imageMath";
import { downloadZip } from "../utils/zip";

const DEFAULT_SETTINGS: ProcessingSettings = {
  width: 800,
  height: 600,
  format: "jpeg",
  quality: 0.9,
};

function createId(): string {
  return crypto.randomUUID();
}

function baseNameWithoutExtension(fileName: string): string {
  if (!fileName.includes(".")) {
    return fileName;
  }

  return fileName.substring(0, fileName.lastIndexOf("."));
}

function extensionFromName(fileName: string): string {
  if (!fileName.includes(".")) {
    return "";
  }

  return fileName.substring(fileName.lastIndexOf("."));
}

function sanitizeCustomName(value: string): string {
  return value
    .trim()
    .replace(/[\\/:*?"<>|]/g, "-")
    .replace(/\s+/g, " ");
}

export const useImageStore = defineStore("image-store", () => {
  const jobs = ref<ImageJob[]>([]);
  const settings = ref<ProcessingSettings>({ ...DEFAULT_SETTINGS });
  const lastProcessedSettings = ref<ProcessingSettings | null>(null);
  const notifications = ref<NotificationMessage[]>([]);
  const isProcessing = ref(false);
  const activeCropJobId = ref<string | null>(null);

  function areSettingsEqual(
    left: ProcessingSettings,
    right: ProcessingSettings,
  ): boolean {
    return (
      left.width === right.width &&
      left.height === right.height &&
      left.format === right.format &&
      left.quality === right.quality
    );
  }

  const queuedJobs = computed(() =>
    jobs.value.filter((job) => job.status === "queued"),
  );
  const doneJobs = computed(() =>
    jobs.value.filter(
      (job) => job.status === "done" && job.outputBlob && job.outputName,
    ),
  );
  const errorJobs = computed(() =>
    jobs.value.filter((job) => job.status === "error"),
  );
  const isDownloadLockedBySettings = computed(() => {
    if (!lastProcessedSettings.value) {
      return false;
    }

    return !areSettingsEqual(settings.value, lastProcessedSettings.value);
  });

  function pushNotification(
    level: NotificationMessage["level"],
    key: NotificationMessage["key"],
    params?: NotificationMessage["params"],
  ): void {
    notifications.value.unshift({ id: createId(), level, key, params });
  }

  function dismissNotification(id: string): void {
    notifications.value = notifications.value.filter((item) => item.id !== id);
  }

  function clearNotifications(): void {
    notifications.value = [];
  }

  function refreshAutoCropForJob(job: ImageJob): void {
    if (!job.sourceWidth || !job.sourceHeight || job.manualCropRect) {
      return;
    }

    const targetRatio = getTargetRatioForSource(
      job.sourceWidth,
      job.sourceHeight,
      settings.value.width,
      settings.value.height,
    );

    job.autoCropRect = getCenteredCropRect(
      job.sourceWidth,
      job.sourceHeight,
      targetRatio,
    );
    job.updatedAt = Date.now();
  }

  async function hydrateJobAutoCrop(jobId: string, file: File): Promise<void> {
    try {
      const dimensions = await readImageDimensions(file);
      const job = jobs.value.find((item) => item.id === jobId);
      if (!job) {
        return;
      }

      job.sourceWidth = dimensions.sourceWidth;
      job.sourceHeight = dimensions.sourceHeight;
      refreshAutoCropForJob(job);
    } catch {
      // Keep job queued even if preview metadata fails; processing path still handles errors explicitly.
    }
  }

  function addFiles(filesToAdd: File[]): void {
    const validation = validateFiles(filesToAdd, jobs.value.length);

    for (const accepted of validation.accepted) {
      const objectUrl = URL.createObjectURL(accepted);
      const job: ImageJob = {
        id: createId(),
        file: accepted,
        customName: null,
        rotationDeg: 0,
        swapTargetAxes: false,
        originalUrl: objectUrl,
        status: "queued",
        error: null,
        outputBlob: null,
        outputUrl: null,
        outputName: null,
        sourceWidth: null,
        sourceHeight: null,
        autoCropRect: null,
        manualCropRect: null,
        updatedAt: Date.now(),
      };

      jobs.value.push(job);
      void hydrateJobAutoCrop(job.id, accepted);
    }

    if (validation.accepted.length > 0) {
      pushNotification("success", "filesAdded", {
        count: validation.accepted.length,
      });
    }

    for (const rejected of validation.rejected) {
      pushNotification("warning", rejected.reason, {
        fileName: rejected.fileName,
        max: MAX_FILES,
        maxSizeMb: MAX_FILE_SIZE_MB,
      });
    }
  }

  function updateSettings(next: Partial<ProcessingSettings>): void {
    settings.value = { ...settings.value, ...next };

    for (const job of jobs.value) {
      if (job.status === "done") {
        if (job.outputUrl) {
          URL.revokeObjectURL(job.outputUrl);
        }
        job.outputBlob = null;
        job.outputUrl = null;
        job.outputName = null;
        job.status = "queued";
        job.updatedAt = Date.now();
      }
    }

    for (const job of jobs.value) {
      refreshAutoCropForJob(job);
    }
  }

  function clearAll(): void {
    for (const job of jobs.value) {
      URL.revokeObjectURL(job.originalUrl);
      if (job.outputUrl) {
        URL.revokeObjectURL(job.outputUrl);
      }
    }
    jobs.value = [];
    lastProcessedSettings.value = null;
    activeCropJobId.value = null;
    pushNotification("info", "queueCleared");
  }

  function removeJob(jobId: string): void {
    const index = jobs.value.findIndex((job) => job.id === jobId);
    if (index === -1) {
      return;
    }

    const [removedJob] = jobs.value.splice(index, 1);
    URL.revokeObjectURL(removedJob.originalUrl);
    if (removedJob.outputUrl) {
      URL.revokeObjectURL(removedJob.outputUrl);
    }

    if (activeCropJobId.value === jobId) {
      activeCropJobId.value = null;
    }

    pushNotification("info", "jobRemoved", { name: removedJob.file.name });
  }

  function openCropEditor(jobId: string): void {
    activeCropJobId.value = jobId;
  }

  function setJobCustomName(jobId: string, nextName: string): void {
    const job = jobs.value.find((item) => item.id === jobId);
    if (!job) {
      return;
    }

    const sanitized = sanitizeCustomName(nextName);
    const currentBase =
      job.customName ?? baseNameWithoutExtension(job.file.name);
    if (sanitized === currentBase) {
      return;
    }

    job.customName = sanitized.length > 0 ? sanitized : null;

    if (job.outputName) {
      const ext = extensionFromName(job.outputName);
      const base = job.customName ?? baseNameWithoutExtension(job.file.name);
      job.outputName = `${base}${ext}`;
    }

    job.updatedAt = Date.now();
  }

  function applyPrefixToAllNames(prefix: string): void {
    const sanitizedPrefix = sanitizeCustomName(prefix);
    if (!sanitizedPrefix || jobs.value.length === 0) {
      return;
    }

    for (const [index, job] of jobs.value.entries()) {
      const numberedName = `${sanitizedPrefix}-${String(index + 1).padStart(3, "0")}`;
      setJobCustomName(job.id, numberedName);
    }

    pushNotification("info", "prefixApplied", { count: jobs.value.length });
  }

  function closeCropEditor(): void {
    activeCropJobId.value = null;
  }

  function applyManualCrop(
    jobId: string,
    cropRect: CropRect,
    sourceWidth?: number,
    sourceHeight?: number,
    rotationDeg?: 0 | 90 | 180 | 270,
    swapTargetAxes?: boolean,
  ): void {
    const job = jobs.value.find((item) => item.id === jobId);
    if (!job) {
      return;
    }

    job.manualCropRect = cropRect;
    if (sourceWidth && sourceHeight) {
      job.sourceWidth = sourceWidth;
      job.sourceHeight = sourceHeight;
    }
    if (rotationDeg !== undefined) {
      job.rotationDeg = rotationDeg;
    }
    if (swapTargetAxes !== undefined) {
      job.swapTargetAxes = swapTargetAxes;
    }
    job.status = "queued";
    job.error = null;
    job.updatedAt = Date.now();
    activeCropJobId.value = null;
    pushNotification("info", "cropSaved", { name: job.file.name });
  }

  async function processJob(job: ImageJob): Promise<void> {
    job.status = "processing";
    job.error = null;
    job.updatedAt = Date.now();

    try {
      const result = await processImageFile(
        job.file,
        settings.value,
        job.manualCropRect,
        job.customName ?? undefined,
        job.rotationDeg,
        job.swapTargetAxes,
      );

      if (job.outputUrl) {
        URL.revokeObjectURL(job.outputUrl);
      }

      job.outputBlob = result.blob;
      job.outputName = result.outputName;
      job.outputUrl = URL.createObjectURL(result.blob);
      job.sourceWidth = result.sourceWidth;
      job.sourceHeight = result.sourceHeight;
      job.autoCropRect = result.autoCropRect;
      job.status = "done";
      job.updatedAt = Date.now();
    } catch (error) {
      job.status = "error";
      if (error instanceof ProcessingError) {
        job.error = error.code;
      } else {
        console.error(error);
        job.error = "unknown";
      }
      job.updatedAt = Date.now();
    }
  }

  async function processAll(): Promise<void> {
    if (jobs.value.length === 0) {
      pushNotification("info", "noFiles");
      return;
    }

    isProcessing.value = true;

    const toProcess = jobs.value.filter(
      (job) => job.status === "queued" || job.status === "error",
    );

    for (const job of toProcess) {
      await processJob(job);
    }

    if (toProcess.length > 0) {
      lastProcessedSettings.value = { ...settings.value };
    }

    isProcessing.value = false;

    if (errorJobs.value.length > 0) {
      pushNotification("warning", "processedWithErrors");
      return;
    }

    pushNotification("success", "processed");
  }

  function downloadSingle(jobId: string): void {
    if (isDownloadLockedBySettings.value) {
      pushNotification("warning", "settingsChanged");
      return;
    }

    const job = jobs.value.find((item) => item.id === jobId);
    if (!job || !job.outputBlob || !job.outputName) {
      pushNotification("warning", "notReady");
      return;
    }

    saveAs(job.outputBlob, job.outputName);
  }

  async function downloadAllAsZip(): Promise<void> {
    if (isDownloadLockedBySettings.value) {
      pushNotification("warning", "settingsChanged");
      return;
    }

    const files = doneJobs.value
      .map((job) => ({
        fileName: job.outputName,
        blob: job.outputBlob,
      }))
      .filter((item): item is { fileName: string; blob: Blob } =>
        Boolean(item.fileName && item.blob),
      );

    if (files.length === 0) {
      pushNotification("warning", "nothingToZip");
      return;
    }

    await downloadZip(files, `img-cropper-${Date.now()}.zip`);
  }

  const activeCropJob = computed(() => {
    if (!activeCropJobId.value) {
      return null;
    }

    return jobs.value.find((item) => item.id === activeCropJobId.value) ?? null;
  });

  return {
    jobs,
    settings,
    notifications,
    isProcessing,
    queuedJobs,
    doneJobs,
    errorJobs,
    isDownloadLockedBySettings,
    activeCropJob,
    addFiles,
    updateSettings,
    clearAll,
    removeJob,
    setJobCustomName,
    applyPrefixToAllNames,
    openCropEditor,
    closeCropEditor,
    applyManualCrop,
    processAll,
    downloadSingle,
    downloadAllAsZip,
    dismissNotification,
    clearNotifications,
  };
});
