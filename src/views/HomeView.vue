<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { storeToRefs } from "pinia";
import { useI18n } from "vue-i18n";
import UploadPanel from "../components/UploadPanel.vue";
import SettingsPanel from "../components/SettingsPanel.vue";
import QueuePanel from "../components/QueuePanel.vue";
import DownloadPanel from "../components/DownloadPanel.vue";
import DownloadSummaryPanel from "../components/DownloadSummaryPanel.vue";
import NotificationsPanel from "../components/NotificationsPanel.vue";
import CropEditor from "../components/CropEditor.vue";
import { useImageStore } from "../stores/imageStore";
import { getOrientedTargetSize } from "../utils/imageMath";
import type { NotificationMessage } from "../types/image";
import LanguageToggle from "../components/LanguageToggle.vue";

const imageStore = useImageStore();
const { t } = useI18n();
const {
  jobs,
  settings,
  notifications,
  isProcessing,
  doneJobs,
  errorJobs,
  activeCropJob,
  isDownloadLockedBySettings,
} = storeToRefs(imageStore);
const settingsDirty = ref(false);
const stepThreeAccepted = ref(false);

const currentStep = computed(() => {
  if (activeCropJob.value) {
    return 3;
  }

  if (jobs.value.length === 0) {
    return 1;
  }

  if (settingsDirty.value) {
    return 2;
  }

  if (isProcessing.value) {
    return 4;
  }

  if (errorJobs.value.length > 0) {
    return 3;
  }

  if (isProcessing.value) {
    return 4;
  }

  if (doneJobs.value.length === jobs.value.length && jobs.value.length > 0) {
    return 5;
  }

  if (stepThreeAccepted.value) {
    return 4;
  }

  return 3;
});

const nextActionText = computed(() => {
  if (activeCropJob.value) {
    return t("process.next.cropping");
  }

  if (jobs.value.length === 0) {
    return t("process.next.empty");
  }

  if (isProcessing.value) {
    return t("process.next.processing");
  }

  if (errorJobs.value.length > 0) {
    return t("process.next.hasErrors");
  }

  if (doneJobs.value.length === jobs.value.length && jobs.value.length > 0) {
    return t("process.next.done");
  }

  return t("process.next.ready");
});

const STEP_IDS = [
  "upload",
  "settings",
  "review",
  "process",
  "download",
] as const;

const stepInstructions = computed(() =>
  STEP_IDS.map((id) => t(`process.steps.${id}.instruction`)),
);

const stepLabels = computed(() =>
  STEP_IDS.map((id) => t(`process.steps.${id}.label`)),
);

const hoveredInstructionStep = ref<number | null>(null);
const displayedInstructionStep = computed(
  () => hoveredInstructionStep.value ?? currentStep.value,
);
const displayedInstructionText = computed(() => {
  const index = displayedInstructionStep.value - 1;
  return stepInstructions.value[index] ?? nextActionText.value;
});

function setHoveredInstructionStep(step: number): void {
  hoveredInstructionStep.value = step;
}

function clearHoveredInstructionStep(): void {
  hoveredInstructionStep.value = null;
}

const notificationsOverlayOpen = ref(false);
const isTabletOrDown = ref(false);
const activeToasts = ref<NotificationMessage[]>([]);
const toastTimers = new Map<string, ReturnType<typeof setTimeout>>();

function toastColorClass(level: NotificationMessage["level"]): string {
  if (level === "success") {
    return "toast-success";
  }
  if (level === "warning") {
    return "toast-warning";
  }
  if (level === "error") {
    return "toast-error";
  }
  return "toast-info";
}

function removeToast(id: string): void {
  const timerId = toastTimers.get(id);
  if (timerId) {
    clearTimeout(timerId);
    toastTimers.delete(id);
  }
  activeToasts.value = activeToasts.value.filter((item) => item.id !== id);
}

function pushToast(note: NotificationMessage): void {
  if (activeToasts.value.some((item) => item.id === note.id)) {
    return;
  }

  activeToasts.value = [note, ...activeToasts.value].slice(0, 3);
  const timerId = setTimeout(() => {
    removeToast(note.id);
  }, 3200);
  toastTimers.set(note.id, timerId);
}

function updateViewportFlags(): void {
  isTabletOrDown.value = window.matchMedia("(max-width: 900px)").matches;
}

function onFilesSelected(files: File[]): void {
  imageStore.addFiles(files);
}

function onSettingsDirtyState(isDirty: boolean): void {
  settingsDirty.value = isDirty;
}

function acceptStepThreeState(): void {
  stepThreeAccepted.value = true;
}

function handleEscapeClose(event: KeyboardEvent): void {
  if (event.key !== "Escape") {
    return;
  }

  if (!activeCropJob.value) {
    return;
  }

  imageStore.closeCropEditor();
}

onMounted(() => {
  updateViewportFlags();
  window.addEventListener("keydown", handleEscapeClose);
  window.addEventListener("resize", updateViewportFlags);
});

onBeforeUnmount(() => {
  window.removeEventListener("keydown", handleEscapeClose);
  window.removeEventListener("resize", updateViewportFlags);
  for (const timerId of toastTimers.values()) {
    clearTimeout(timerId);
  }
  toastTimers.clear();
});

function toggleNotificationsOverlay(): void {
  notificationsOverlayOpen.value = !notificationsOverlayOpen.value;
}

function closeNotificationsOverlay(): void {
  notificationsOverlayOpen.value = false;
}

function clearAllNotifications(): void {
  imageStore.clearNotifications();
  for (const timerId of toastTimers.values()) {
    clearTimeout(timerId);
  }
  toastTimers.clear();
  activeToasts.value = [];
}

const activeCropTargetSize = computed(() => {
  const job = activeCropJob.value;
  if (!job?.sourceWidth || !job.sourceHeight) {
    return { width: settings.value.width, height: settings.value.height };
  }

  return getOrientedTargetSize(
    job.sourceWidth,
    job.sourceHeight,
    settings.value.width,
    settings.value.height,
  );
});

const floatingStatusText = computed(() =>
  t("app.statusChip", {
    done: doneJobs.value.length,
    total: jobs.value.length,
    errors: errorJobs.value.length,
  }),
);

watch(
  () => notifications.value[0]?.id,
  (nextId) => {
    if (!nextId) {
      return;
    }

    const newest = notifications.value.find((item) => item.id === nextId);
    if (newest) {
      pushToast(newest);
    }
  },
  {
    flush: "post",
  },
);

watch(
  () => ({
    settingsDirty: settingsDirty.value,
    activeCropJobId: activeCropJob.value?.id ?? null,
    jobsSignature: jobs.value
      .map((job) => `${job.id}:${job.status}:${job.updatedAt}`)
      .join("|"),
  }),
  () => {
    stepThreeAccepted.value = false;
  },
);
</script>

<template>
  <main class="app-shell">
    <section class="app-header panel-rise">
      <!-- The tagline is real text laid over a gap in the banner, so it switches with the language without loading another image. -->
      <h1 class="brand">
        <img
          class="brand-banner"
          src="/main-banner.png"
          alt="img-cropper"
          draggable="false"
        />
        <span class="brand-tagline">{{ $t("app.tagline") }}</span>
      </h1>
      <LanguageToggle />
    </section>

    <TransitionGroup
      v-if="activeToasts.length > 0"
      tag="section"
      name="toast"
      class="toast-stack"
      aria-live="polite"
    >
      <article
        v-for="item in activeToasts"
        :key="item.id"
        class="toast-item"
        :class="toastColorClass(item.level)"
      >
        {{ $t(`notifications.messages.${item.key}`, item.params ?? {}) }}
      </article>
    </TransitionGroup>

    <div class="notify-floating-wrap">
      <div class="floating-status-chip">{{ floatingStatusText }}</div>
      <button
        class="notify-toggle-btn"
        type="button"
        :aria-label="$t('notifications.open')"
        @click="toggleNotificationsOverlay"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true" class="notify-bell-icon">
          <path
            d="M12 3a4 4 0 0 0-4 4v1.2c0 1.5-.5 3-1.4 4.2L5 14.6V16h14v-1.4l-1.6-2.2A7.2 7.2 0 0 1 16 8.2V7a4 4 0 0 0-4-4Zm0 18a2.5 2.5 0 0 0 2.4-2h-4.8A2.5 2.5 0 0 0 12 21Z"
            fill="currentColor"
          />
        </svg>
        <span class="notify-count-badge">{{ notifications.length }}</span>
      </button>
    </div>

    <section class="process-section panel-rise">
      <div class="process-head">{{ $t("process.heading") }}</div>
      <div
        class="process-track"
        role="list"
        :aria-label="$t('process.stepsLabel')"
      >
        <button
          v-for="(label, index) in stepLabels"
          :key="label"
          type="button"
          class="process-step"
          :class="{
            active: currentStep === index + 1,
            done: currentStep > index + 1,
            selected: displayedInstructionStep === index + 1,
          }"
          :aria-current="
            displayedInstructionStep === index + 1 ? 'step' : undefined
          "
          @mouseenter="setHoveredInstructionStep(index + 1)"
          @mouseleave="clearHoveredInstructionStep"
          @focus="setHoveredInstructionStep(index + 1)"
          @blur="clearHoveredInstructionStep"
          role="listitem"
        >
          <span class="process-index">{{ index + 1 }}</span>
          <span class="process-label">{{ label }}</span>
        </button>
      </div>
      <p class="process-action">{{ displayedInstructionText }}</p>
    </section>

    <section class="steps-layout">
      <aside class="steps-left">
        <UploadPanel @files-selected="onFilesSelected" />
        <SettingsPanel
          :settings="settings"
          @update="imageStore.updateSettings"
          @dirty-state="onSettingsDirtyState"
        />
        <QueuePanel
          v-if="isTabletOrDown"
          :items="jobs"
          :target-width="settings.width"
          :target-height="settings.height"
          :is-download-locked="isDownloadLockedBySettings"
          :is-step-three-approved="stepThreeAccepted"
          @edit-crop="imageStore.openCropEditor"
          @rename-prefix="imageStore.applyPrefixToAllNames"
          @accept-current-state="acceptStepThreeState"
          @clear-all="imageStore.clearAll"
          @download="imageStore.downloadSingle"
          @remove="imageStore.removeJob"
          @rename="imageStore.setJobCustomName"
        />
        <DownloadPanel
          :ready-count="doneJobs.length"
          :total-count="jobs.length"
          :is-busy="isProcessing"
          :is-step-three-approved="stepThreeAccepted"
          @process="imageStore.processAll"
        />
        <DownloadSummaryPanel
          :ready-count="doneJobs.length"
          :total-count="jobs.length"
          :is-busy="isProcessing"
          :is-download-locked="isDownloadLockedBySettings"
          @zip="imageStore.downloadAllAsZip"
        />
      </aside>

      <section v-if="!isTabletOrDown" class="steps-right">
        <QueuePanel
          :items="jobs"
          :target-width="settings.width"
          :target-height="settings.height"
          :is-download-locked="isDownloadLockedBySettings"
          :is-step-three-approved="stepThreeAccepted"
          @edit-crop="imageStore.openCropEditor"
          @rename-prefix="imageStore.applyPrefixToAllNames"
          @accept-current-state="acceptStepThreeState"
          @clear-all="imageStore.clearAll"
          @download="imageStore.downloadSingle"
          @remove="imageStore.removeJob"
          @rename="imageStore.setJobCustomName"
        />
      </section>
    </section>

    <section
      v-if="activeCropJob"
      class="crop-overlay"
      @click.self="imageStore.closeCropEditor"
    >
      <div class="crop-modal">
        <button
          class="crop-close-btn"
          type="button"
          :aria-label="$t('crop.closeEditor')"
          @click="imageStore.closeCropEditor"
        >
          x
        </button>

        <CropEditor
          :source-url="activeCropJob.originalUrl"
          :source-width="activeCropJob.sourceWidth"
          :source-height="activeCropJob.sourceHeight"
          :target-width="activeCropTargetSize.width"
          :target-height="activeCropTargetSize.height"
          :initial-rotation="activeCropJob.rotationDeg"
          :initial-swap-target-axes="activeCropJob.swapTargetAxes"
          :initial-crop="
            activeCropJob.manualCropRect ?? activeCropJob.autoCropRect
          "
          @save="
            imageStore.applyManualCrop(
              activeCropJob.id,
              $event.cropRect,
              $event.sourceWidth,
              $event.sourceHeight,
              $event.rotationDeg,
              $event.swapTargetAxes,
            )
          "
        />
      </div>
    </section>

    <section
      v-if="notificationsOverlayOpen"
      class="notifications-overlay"
      @click.self="closeNotificationsOverlay"
    >
      <div class="notifications-modal">
        <header class="notifications-modal-head">
          <div class="notifications-head-left">
            <h3>{{ $t("notifications.title") }}</h3>
            <div class="notifications-modal-actions">
              <span class="notifications-count-chip">{{
                notifications.length
              }}</span>
            </div>
          </div>
          <div class="notifications-head-right">
            <button
              type="button"
              class="notifications-clear-btn"
              :disabled="notifications.length === 0"
              @click="clearAllNotifications"
            >
              {{ $t("notifications.clearAll") }}
            </button>
            <button
              type="button"
              class="notifications-close-btn"
              @click="closeNotificationsOverlay"
              :aria-label="$t('notifications.close')"
            >
              x
            </button>
          </div>
        </header>

        <NotificationsPanel
          :items="notifications"
          @dismiss="imageStore.dismissNotification"
        />

        <p v-if="notifications.length === 0" class="notifications-empty">
          {{ $t("notifications.empty") }}
        </p>
      </div>
    </section>
  </main>
</template>

<style scoped>
.app-shell {
  height: 100dvh;
  width: 100%;
  padding: 12px;
  display: grid;
  grid-template-rows: auto auto 1fr;
  gap: 10px;
  overflow: hidden;
  position: relative;
}

.app-header {
  border: 4px solid #141414;
  background: #ede1d3;
  padding: 10px;
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 12px;
}

.toast-stack {
  position: fixed !important;
  top: calc(12px + env(safe-area-inset-top, 0px));
  right: 12px;
  z-index: 9999;
  display: grid;
  gap: 8px;
  max-width: min(420px, calc(100vw - 24px));
  pointer-events: none;
}

.toast-item {
  border: 3px solid #141414;
  box-shadow: 4px 4px 0 #141414;
  padding: 8px 10px;
  font-size: 12px;
  font-weight: 800;
  line-height: 1.2;
}

.toast-enter-active,
.toast-leave-active {
  transition:
    transform 220ms cubic-bezier(0.2, 0.8, 0.2, 1),
    opacity 220ms ease;
}

.toast-move {
  transition: transform 220ms cubic-bezier(0.2, 0.8, 0.2, 1);
}

.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translateY(-8px) translateX(10px) scale(0.98);
}

.toast-success {
  background: #d8f0c8;
  color: #141414;
}

.toast-warning {
  background: #f2c230;
  color: #141414;
}

.toast-error {
  background: #d64933;
  color: #fff;
}

.toast-info {
  background: #2654c4;
  color: #fff;
}

/* Banner source is 1360×320; the tagline gap starts at x≈698 and is centred at y≈137. */
.brand {
  position: relative;
  container-type: inline-size;
  width: min(100%, 1360px);
  margin: 0;
  font: inherit;
  user-select: none;
}

.brand-banner {
  display: block;
  width: 100%;
  height: auto;
}

.brand-tagline {
  position: absolute;
  left: 51.3%;
  top: 42.7%;
  transform: translateY(-50%);
  color: #141414;
  font-size: 2.6cqi;
  font-weight: 400;
  line-height: 1;
  white-space: nowrap;
}

/* On phones show only the logo, left of the divider: its marks span x 48–625,
   y 20–252 of 1360×320, so crop to x 28–645, y 0–272 for an even 20px margin. */
@media (max-width: 640px) {
  .brand {
    width: min(100%, 280px);
    aspect-ratio: 617 / 272;
    overflow: hidden;
  }

  .brand-banner {
    width: calc(100% * 1360 / 617);
    max-width: none;
    margin-left: calc(-100% * 28 / 617);
  }

  /* Hidden visually but still read as part of the heading. */
  .brand-tagline {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
  }
}

@media (min-width: 901px) {
  .brand {
    width: min(50%, 1360px);
  }
}

@media (min-width: 1400px) {
  .brand {
    width: min(40%, 1360px);
  }
}

.notify-toggle-btn {
  border: 2px solid #141414;
  background: #2654c4;
  color: #fff;
  padding: 0;
  width: 34px;
  height: 34px;
  font-weight: 800;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  position: relative;
  cursor: pointer;
}

.notify-bell-icon {
  width: 16px;
  height: 16px;
}

.notify-count-badge {
  position: absolute;
  right: -7px;
  top: -7px;
  min-width: 18px;
  height: 18px;
  padding: 0 4px;
  border: 2px solid #141414;
  background: #fff;
  color: #141414;
  font-size: 10px;
  font-weight: 800;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  line-height: 1;
}

.notify-floating-wrap {
  position: absolute;
  right: 18px;
  bottom: 18px;
  z-index: 20;
  display: flex;
  align-items: center;
  flex-direction: row;
  flex-wrap: nowrap;
  gap: 8px;
}

.floating-status-chip {
  border: 2px solid #141414;
  background: #fff;
  color: #141414;
  padding: 6px 10px;
  font-size: 11px;
  font-weight: 800;
  text-transform: uppercase;
  white-space: nowrap;
}

.process-section {
  border: 4px solid #141414;
  background: #fff;
}

.process-head {
  border-bottom: 3px solid #141414;
  background: #2654c4;
  color: #fff;
  font-size: 12px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.1em;
  padding: 6px 10px;
}

.process-track {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  border-bottom: 3px solid #141414;
}

.process-step {
  border: none;
  text-align: left;
  font: inherit;
  cursor: default;
  transition:
    background-color 140ms ease,
    filter 140ms ease;
  min-width: 0;
  display: grid;
  grid-template-columns: auto 1fr;
  align-items: center;
  gap: 6px;
  padding: 8px;
  border-right: 3px solid #141414;
  background: #f3efe2;
}

.process-step:last-child {
  border-right: none;
}

.process-step.done {
  background: #d8f0c8;
}

.process-step.active {
  background: #f2c230;
}

.process-step.selected {
  background: #d3e1ff;
}

.process-step.active.selected {
  background: #f3cf4f;
}

.process-step.done.selected {
  background: #cde9b8;
}

.process-step:focus-visible {
  outline: 2px solid #141414;
  outline-offset: -2px;
}

.process-index {
  display: inline-grid;
  place-items: center;
  width: 22px;
  height: 22px;
  border: 2px solid #141414;
  background: #fff;
  font-size: 11px;
  font-weight: 800;
}

.process-label {
  font-size: 11px;
  text-transform: uppercase;
  font-weight: 800;
  line-height: 1.1;
}

.process-action {
  margin: 0;
  padding: 9px 10px;
  font-size: 14px;
  font-weight: 700;
}

.steps-layout {
  min-height: 0;
  display: grid;
  grid-template-columns: 430px 1fr;
  border: 4px solid #141414;
  overflow: hidden;
}

.steps-left {
  min-height: 0;
  overflow: auto;
  border-right: 4px solid #141414;
  padding: 8px;
  display: grid;
  gap: 8px;
  background: #f3efe2;
}

.steps-right {
  min-height: 0;
  overflow: hidden;
  padding: 8px;
  background: #fff;
}

.crop-overlay {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.45);
  display: grid;
  place-items: center;
  padding: 12px;
}

.crop-modal {
  position: relative;
  width: min(1120px, 100%);
  max-height: 100%;
  overflow: auto;
  border: 4px solid #141414;
  background: #f3efe2;
  padding: 10px;
}

.crop-close-btn {
  position: absolute;
  top: 10px;
  right: 10px;
  width: 28px;
  height: 28px;
  border: 2px solid #141414;
  background: #fff;
  font-size: 16px;
  font-weight: 800;
  line-height: 1;
  text-transform: uppercase;
  cursor: pointer;
  z-index: 10;
}

.crop-close-btn:hover {
  background: #f2c230;
}

.notifications-overlay {
  position: absolute;
  inset: 0;
  z-index: 35;
  background: rgba(0, 0, 0, 0.35);
  display: grid;
  place-items: end end;
  padding: 18px;
}

.notifications-modal {
  width: min(460px, calc(100vw - 32px));
  max-height: min(70vh, 540px);
  overflow: auto;
  border: 4px solid #141414;
  background: #f3efe2;
  padding: 8px;
}

.notifications-modal-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 8px;
}

.notifications-head-left {
  display: flex;
  align-items: center;
  gap: 8px;
}

.notifications-head-right {
  display: flex;
  align-items: center;
  gap: 6px;
}

.notifications-modal-head h3 {
  margin: 0;
  font-size: 14px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.notifications-modal-actions {
  display: flex;
  align-items: center;
  gap: 6px;
}

.notifications-count-chip {
  min-width: 24px;
  height: 24px;
  border: 2px solid #141414;
  background: #fff;
  color: #141414;
  font-size: 11px;
  font-weight: 800;
  line-height: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.notifications-clear-btn {
  border: 2px solid #141414;
  background: #141414;
  color: #fff;
  font-size: 10px;
  font-weight: 800;
  text-transform: uppercase;
  padding: 4px 8px;
  cursor: pointer;
}

.notifications-clear-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.notifications-close-btn {
  border: 2px solid #141414;
  background: #fff;
  width: 26px;
  height: 26px;
  padding: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  font-weight: 800;
  line-height: 1;
  cursor: pointer;
}

.notifications-empty {
  margin: 0;
  border: 2px solid #141414;
  background: #fff;
  padding: 8px;
  font-size: 12px;
  font-weight: 700;
}

@media (max-width: 1150px) {
  .app-shell {
    padding-bottom: calc(56px + env(safe-area-inset-bottom, 0px));
  }

  .steps-layout {
    grid-template-columns: 360px 1fr;
  }

  .notify-floating-wrap {
    position: fixed;
    right: 12px;
    bottom: 12px;
    z-index: 45;
  }
}

@media (max-width: 900px) {
  .app-shell {
    height: auto;
    min-height: 100dvh;
    padding-bottom: calc(68px + env(safe-area-inset-bottom, 0px));
    overflow-y: auto;
    overflow-x: hidden;
    grid-template-rows: auto auto auto;
  }

  .steps-layout {
    grid-template-columns: 1fr;
    grid-template-rows: auto auto;
    overflow: visible;
  }

  .steps-left {
    order: 1;
    border-right: none;
    border-bottom: 4px solid #141414;
    overflow: visible;
  }

  .steps-right {
    max-height: min(62vh, 720px);
    overflow: auto;
  }

  .notify-floating-wrap {
    right: 12px;
    bottom: 12px;
    flex-direction: row;
    align-items: center;
  }

  .process-track {
    grid-template-columns: 1fr 1fr;
  }

  .process-step:nth-child(2n) {
    border-right: none;
  }

  .process-step:nth-child(-n + 4) {
    border-bottom: 3px solid #141414;
  }

  .process-step:last-child {
    grid-column: 1 / -1;
  }
}
</style>
