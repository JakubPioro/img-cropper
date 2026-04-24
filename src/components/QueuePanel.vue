<script setup lang="ts">
import { computed, ref } from "vue";
import type { ImageJob } from "../types/image";
import { getOrientedTargetSize } from "../utils/imageMath";

const props = defineProps<{
  items: ImageJob[];
  targetWidth: number;
  targetHeight: number;
}>();

const emit = defineEmits<{
  editCrop: [jobId: string];
  download: [jobId: string];
  remove: [jobId: string];
  rename: [jobId: string, nextName: string];
}>();

const viewMode = ref<"grid" | "list">("grid");
const statusFilter = ref<"all" | ImageJob["status"]>("all");
const editingJobId = ref<string | null>(null);
const renameDraft = ref("");

const filteredItems = computed(() => {
  if (statusFilter.value === "all") {
    return props.items;
  }

  return props.items.filter((job) => job.status === statusFilter.value);
});

const statusFilters = computed(() => {
  const allCount = props.items.length;
  const queuedCount = props.items.filter(
    (job) => job.status === "queued",
  ).length;
  const processingCount = props.items.filter(
    (job) => job.status === "processing",
  ).length;
  const doneCount = props.items.filter((job) => job.status === "done").length;
  const errorCount = props.items.filter((job) => job.status === "error").length;

  return [
    { key: "all" as const, label: "Wszystkie", count: allCount },
    { key: "queued" as const, label: "Oczekujacy", count: queuedCount },
    {
      key: "processing" as const,
      label: "Przetwarzanie",
      count: processingCount,
    },
    { key: "done" as const, label: "Gotowe", count: doneCount },
    { key: "error" as const, label: "Bledy", count: errorCount },
  ];
});

function previewUrl(job: ImageJob): string {
  return job.outputUrl ?? job.originalUrl;
}

function effectiveCropRect(job: ImageJob) {
  return job.manualCropRect ?? job.autoCropRect;
}

function useCropPreview(job: ImageJob): boolean {
  return Boolean(effectiveCropRect(job) && job.sourceWidth && job.sourceHeight);
}

function previewSource(job: ImageJob): string {
  return useCropPreview(job) ? job.originalUrl : previewUrl(job);
}

function previewImageStyle(job: ImageJob): Record<string, string> {
  const rect = effectiveCropRect(job);
  if (!rect || !job.sourceWidth || !job.sourceHeight || !useCropPreview(job)) {
    return {};
  }

  return {
    width: `${(job.sourceWidth / rect.width) * 100}%`,
    height: `${(job.sourceHeight / rect.height) * 100}%`,
    left: `-${(rect.x / rect.width) * 100}%`,
    top: `-${(rect.y / rect.height) * 100}%`,
  };
}

function previewAspectRatio(job: ImageJob): number {
  if (!job.sourceWidth || !job.sourceHeight) {
    return props.targetWidth / props.targetHeight;
  }

  const target = getOrientedTargetSize(
    job.sourceWidth,
    job.sourceHeight,
    props.targetWidth,
    props.targetHeight,
  );

  if (job.swapTargetAxes) {
    return target.height / target.width;
  }

  return target.width / target.height;
}

function statusLabel(status: ImageJob["status"]): string {
  if (status === "processing") {
    return "Przetwarzanie...";
  }
  if (status === "done") {
    return "Gotowe";
  }
  if (status === "error") {
    return "Blad";
  }
  return "Oczekujacy";
}

function baseNameWithoutExtension(fileName: string): string {
  if (!fileName.includes(".")) {
    return fileName;
  }

  return fileName.substring(0, fileName.lastIndexOf("."));
}

function editableName(job: ImageJob): string {
  return job.customName ?? baseNameWithoutExtension(job.file.name);
}

function startRename(job: ImageJob): void {
  editingJobId.value = job.id;
  renameDraft.value = editableName(job);
}

function cancelRename(): void {
  editingJobId.value = null;
  renameDraft.value = "";
}

function applyRename(jobId: string): void {
  emit("rename", jobId, renameDraft.value);
  cancelRename();
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  const kb = bytes / 1024;
  if (kb < 1024) {
    return `${kb.toFixed(1)} KB`;
  }

  return `${(kb / 1024).toFixed(2)} MB`;
}

function targetSizeLabel(job: ImageJob): string {
  if (!job.sourceWidth || !job.sourceHeight) {
    return `${props.targetWidth}x${props.targetHeight}`;
  }

  const target = getOrientedTargetSize(
    job.sourceWidth,
    job.sourceHeight,
    props.targetWidth,
    props.targetHeight,
  );

  if (job.swapTargetAxes) {
    return `${target.height}x${target.width}`;
  }

  return `${target.width}x${target.height}`;
}
</script>

<template>
  <section class="step-card panel-rise">
    <header class="step-head">
      <div>
        <h2>Krok 3. Lista plikow i status</h2>
      </div>
      <div class="view-controls" v-if="items.length > 0">
        <span class="view-label">Status</span>
        <button
          v-for="filter in statusFilters"
          :key="filter.key"
          type="button"
          class="view-btn filter-btn"
          :class="{ active: statusFilter === filter.key }"
          @click="statusFilter = filter.key"
        >
          {{ filter.label }} ({{ filter.count }})
        </button>

        <span class="view-label">Widok</span>
        <button
          type="button"
          class="view-btn"
          :class="{ active: viewMode === 'grid' }"
          @click="viewMode = 'grid'"
        >
          Siatka
        </button>
        <button
          type="button"
          class="view-btn"
          :class="{ active: viewMode === 'list' }"
          @click="viewMode = 'list'"
        >
          Lista
        </button>
      </div>
    </header>
    <p class="step-copy">
      Po przetworzeniu mozesz pobrac plik od razu albo poprawic recznie kadr i
      uruchomic przetwarzanie ponownie.
    </p>

    <ul
      class="jobs-grid"
      :class="{ 'jobs-list-mode': viewMode === 'list' }"
      v-if="filteredItems.length > 0"
    >
      <li
        v-for="job in filteredItems"
        :key="job.id"
        class="job-card"
        :class="{ 'job-card-list': viewMode === 'list' }"
      >
        <article class="instax-card">
          <span class="status-pill" :class="`status-${job.status}`">{{
            statusLabel(job.status)
          }}</span>

          <div
            class="photo-stage"
            :class="{ 'photo-stage-list': viewMode === 'list' }"
          >
            <div
              class="photo-wrap"
              :class="{ 'photo-wrap-list': viewMode === 'list' }"
              :style="{ '--preview-ratio': String(previewAspectRatio(job)) }"
            >
              <img
                :src="previewSource(job)"
                :alt="`Podglad ${job.file.name}`"
                class="photo"
                :class="{ 'photo-cropped': useCropPreview(job) }"
                :style="previewImageStyle(job)"
              />
            </div>
          </div>

          <div class="instax-caption">
            <div
              class="name-edit"
              v-if="viewMode === 'grid' && editingJobId === job.id"
            >
              <input
                class="name-input"
                type="text"
                v-model="renameDraft"
                @keydown.enter.prevent="applyRename(job.id)"
                @keydown.esc.prevent="cancelRename"
              />
              <button
                type="button"
                class="rename-save-btn"
                @click="applyRename(job.id)"
              >
                OK
              </button>
            </div>
            <div class="name-display" v-else-if="viewMode === 'grid'">
              <p class="job-name">{{ editableName(job) }}</p>
              <button
                type="button"
                class="rename-trigger-btn"
                aria-label="Edytuj nazwe pliku"
                @click="startRename(job)"
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    d="M3 17.25V21h3.75L17.8 9.94l-3.75-3.75L3 17.25Zm17.71-10.04a1 1 0 0 0 0-1.41l-2.51-2.51a1 1 0 0 0-1.41 0l-1.96 1.96 3.75 3.75 2.13-2.13Z"
                  />
                </svg>
              </button>
            </div>
            <p v-if="job.error" class="job-error">{{ job.error }}</p>
            <p v-else class="caption-hint">
              Podglad:
              {{ useCropPreview(job) ? "zaznaczony obszar" : "kadr eksportu" }}
            </p>
          </div>
        </article>

        <section v-if="viewMode === 'list'" class="job-meta">
          <div class="name-edit" v-if="editingJobId === job.id">
            <input
              class="name-input"
              type="text"
              v-model="renameDraft"
              @keydown.enter.prevent="applyRename(job.id)"
              @keydown.esc.prevent="cancelRename"
            />
            <button
              type="button"
              class="rename-save-btn"
              @click="applyRename(job.id)"
            >
              OK
            </button>
          </div>
          <div class="name-display" v-else>
            <p class="job-name">{{ editableName(job) }}</p>
            <button
              type="button"
              class="rename-trigger-btn"
              aria-label="Edytuj nazwe pliku"
              @click="startRename(job)"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path
                  d="M3 17.25V21h3.75L17.8 9.94l-3.75-3.75L3 17.25Zm17.71-10.04a1 1 0 0 0 0-1.41l-2.51-2.51a1 1 0 0 0-1.41 0l-1.96 1.96 3.75 3.75 2.13-2.13Z"
                />
              </svg>
            </button>
          </div>

          <p><strong>Plik:</strong> {{ job.file.name }}</p>
          <p><strong>Rozmiar:</strong> {{ formatFileSize(job.file.size) }}</p>
          <p>
            <strong>Zrodlo:</strong>
            {{
              job.sourceWidth && job.sourceHeight
                ? `${job.sourceWidth}x${job.sourceHeight}`
                : "-"
            }}
          </p>
          <p><strong>Cel:</strong> {{ targetSizeLabel(job) }}</p>
        </section>

        <div class="job-actions">
          <button
            class="step-btn step-btn-white"
            :class="{ 'step-btn-icon-only': viewMode === 'grid' }"
            type="button"
            aria-label="Popraw kadr"
            @click="emit('editCrop', job.id)"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path
                d="M3 17.25V21h3.75L17.8 9.94l-3.75-3.75L3 17.25Zm17.71-10.04a1 1 0 0 0 0-1.41l-2.51-2.51a1 1 0 0 0-1.41 0l-1.96 1.96 3.75 3.75 2.13-2.13Z"
              />
            </svg>
            <span v-if="viewMode === 'list'">Popraw kadr</span>
          </button>
          <button
            class="step-btn step-btn-blue"
            :class="{ 'step-btn-icon-only': viewMode === 'grid' }"
            type="button"
            aria-label="Pobierz"
            :disabled="job.status !== 'done'"
            @click="emit('download', job.id)"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path
                d="M12 3a1 1 0 0 1 1 1v8.59l2.3-2.3a1 1 0 1 1 1.4 1.42l-4 4a1 1 0 0 1-1.4 0l-4-4a1 1 0 1 1 1.4-1.42L11 12.6V4a1 1 0 0 1 1-1Zm-7 14a1 1 0 0 1 1 1v1h12v-1a1 1 0 1 1 2 0v2a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-2a1 1 0 0 1 1-1Z"
              />
            </svg>
            <span v-if="viewMode === 'list'">Pobierz</span>
          </button>
          <button
            class="step-btn step-btn-red"
            :class="{ 'step-btn-icon-only': viewMode === 'grid' }"
            type="button"
            aria-label="Usun"
            @click="emit('remove', job.id)"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path
                d="M9 3h6l1 2h4v2H4V5h4l1-2Zm-2 6h10v10a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2V9Zm2 2v7h2v-7H9Zm4 0v7h2v-7h-2Z"
              />
            </svg>
            <span v-if="viewMode === 'list'">Usun</span>
          </button>
        </div>
      </li>
    </ul>

    <p v-else-if="items.length > 0" class="empty-copy">
      Brak plikow pasujacych do wybranego statusu.
    </p>

    <p v-else class="empty-copy">Brak plikow w kolejce.</p>
  </section>
</template>

<style scoped>
.step-card {
  height: 100%;
  min-height: 0;
  display: grid;
  grid-template-rows: auto auto 1fr;
  border: 3px solid #141414;
  background: #ffe9d7;
}

.step-head {
  border-bottom: 3px solid #141414;
  padding: 10px;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 8px;
}

h2 {
  margin: 4px 0 0;
  font-size: 24px;
  text-transform: uppercase;
}

.step-copy {
  margin: 0;
  padding: 10px;
  border-bottom: 3px solid #141414;
  font-size: 14px;
  font-weight: 600;
}

.view-controls {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
}

.view-label {
  font-size: 11px;
  font-weight: 800;
  text-transform: uppercase;
  margin-right: 2px;
}

.view-btn {
  border: 2px solid #141414;
  background: #fff;
  padding: 3px 7px;
  font-size: 10px;
  font-weight: 800;
  text-transform: uppercase;
  cursor: pointer;
}

.view-btn.active {
  background: #f2c230;
}

.filter-btn {
  font-size: 9px;
  letter-spacing: 0.02em;
}

.jobs-grid {
  min-height: 0;
  margin: 0;
  padding: 12px;
  list-style: none;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(230px, 1fr));
  gap: 18px;
  overflow: auto;
  align-content: start;
  grid-auto-rows: 340px;
}

.jobs-list-mode {
  grid-template-columns: 1fr;
  grid-auto-rows: auto;
}

.job-card {
  display: grid;
  grid-template-rows: 1fr auto;
  gap: 8px;
  min-width: 0;
  align-content: start;
  background: #f3efe2;
  border: 2px solid #141414;
  padding: 8px;
  box-shadow: 3px 3px 0 rgba(20, 20, 20, 0.18);
  overflow: hidden;
  height: 340px;
}

.job-card-list {
  grid-template-columns: minmax(170px, 220px) 1fr;
  grid-template-rows: 1fr auto;
  align-items: start;
  height: auto;
  min-height: 250px;
}

.instax-card {
  position: relative;
  border: 2px solid #141414;
  background: #ffffff;
  padding: 10px 10px 16px;
  display: grid;
  gap: 10px;
  box-shadow: 5px 5px 0 rgba(20, 20, 20, 0.35);
  overflow: hidden;
  height: 100%;
  align-content: start;
}

.job-card-list .instax-card {
  margin-bottom: 0;
  grid-column: 1;
  grid-row: 1 / span 2;
}

.job-meta {
  border: 2px solid #141414;
  background: #fff;
  padding: 8px;
  font-size: 12px;
  font-weight: 700;
  line-height: 1.25;
  display: grid;
  gap: 4px;
  align-content: start;
}

.job-meta p {
  margin: 0;
}

.photo-stage {
  --preview-stage-height: 168px;
  border: 2px solid #141414;
  background: #cfcfcf;
  height: var(--preview-stage-height);
  display: grid;
  place-items: center;
  overflow: hidden;
  padding: 6px;
}

.photo-wrap {
  position: relative;
  border: 2px solid #141414;
  background: #cfcfcf;
  width: min(
    100%,
    calc(var(--preview-stage-height) * var(--preview-ratio, 1.3333))
  );
  height: min(100%, calc(100% / var(--preview-ratio, 1.3333)));
  aspect-ratio: var(--preview-ratio, 1.3333);
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
}

.photo-stage-list {
  --preview-stage-height: 176px;
}

.photo-wrap-list {
  aspect-ratio: var(--preview-ratio, 1.3333);
}

.photo {
  width: 100%;
  height: 100%;
  object-fit: contain;
  object-position: center;
  display: block;
  background: #cfcfcf;
}

.photo-cropped {
  position: absolute;
  object-fit: fill;
}

.status-pill {
  position: absolute;
  top: 8px;
  left: 8px;
  z-index: 3;
  border: 2px solid #141414;
  background: #fff;
  padding: 2px 6px;
  font-size: 10px;
  font-weight: 800;
  text-transform: uppercase;
}

.status-queued {
  background: #f3efe2;
}

.status-processing {
  background: #f2c230;
}

.status-done {
  background: #d8f0c8;
}

.status-error {
  background: #d64933;
  color: #fff;
}

.instax-caption {
  min-height: 42px;
  display: grid;
  gap: 4px;
  align-content: start;
}

.name-edit {
  display: grid;
  grid-template-columns: 1fr auto;
  align-items: center;
  gap: 6px;
}

.name-display {
  display: grid;
  grid-template-columns: 1fr auto;
  align-items: center;
  gap: 6px;
}

.name-input {
  width: 100%;
  border: 2px solid #141414;
  background: #fff;
  padding: 4px 6px;
  font-size: 11px;
  font-weight: 700;
  font-family: "IBM Plex Mono", monospace;
}

.rename-trigger-btn,
.rename-save-btn {
  border: 2px solid #141414;
  background: #fff;
  height: 28px;
  min-width: 28px;
  padding: 0 8px;
  display: inline-grid;
  place-items: center;
  cursor: pointer;
}

.rename-trigger-btn {
  border-width: 1px;
  height: 22px;
  min-width: 22px;
  padding: 0;
  background: #f5f5f5;
}

.rename-trigger-btn svg {
  width: 11px;
  height: 11px;
  fill: #141414;
}

.rename-save-btn {
  font-size: 10px;
  font-weight: 800;
  text-transform: uppercase;
  background: #f2c230;
}

.job-name {
  margin: 0;
  font-size: 12px;
  font-family: "IBM Plex Mono", monospace;
  font-weight: 700;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.caption-hint {
  margin: 4px 0 0;
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  font-weight: 700;
  color: #555;
}

.job-error {
  margin: 4px 0 0;
  font-size: 10px;
  color: #d64933;
  font-weight: 700;
}

.job-actions {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 6px;
  min-width: 0;
  margin-top: auto;
}

.job-card-list .job-actions {
  align-self: end;
  margin-top: 8px;
}

.step-btn {
  border: 2px solid #141414;
  padding: 6px 9px;
  font-size: 10px;
  font-weight: 800;
  text-transform: uppercase;
  cursor: pointer;
  min-width: 0;
  width: 100%;
  white-space: normal;
  line-height: 1.15;
  min-height: 30px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
}

.step-btn svg {
  width: 14px;
  height: 14px;
  fill: currentColor;
}

.step-btn-icon-only {
  padding: 0;
  gap: 0;
}

.step-btn-icon-only span {
  display: none;
}

.step-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.step-btn-white {
  background: #fff;
  color: #141414;
}

.step-btn-blue {
  background: #2654c4;
  color: #fff;
}

.step-btn-red {
  background: #d64933;
  color: #fff;
}

.empty-copy {
  margin: 0;
  padding: 10px;
  font-size: 14px;
  font-weight: 600;
}

@media (max-width: 900px) {
  .jobs-grid {
    grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
    gap: 12px;
    grid-auto-rows: 300px;
  }

  .job-card {
    height: 300px;
  }

  .step-head {
    flex-direction: column;
    align-items: flex-start;
  }

  .job-card-list {
    grid-template-columns: 1fr;
    grid-template-rows: auto auto auto;
  }

  .job-card-list .instax-card {
    grid-column: auto;
    grid-row: auto;
  }

  .job-meta {
    grid-column: auto;
    grid-row: auto;
  }

  .photo-wrap-list {
    aspect-ratio: 4 / 3;
  }

  .photo-stage {
    --preview-stage-height: 152px;
  }

  .job-actions {
    grid-template-columns: 1fr;
  }
}
</style>
