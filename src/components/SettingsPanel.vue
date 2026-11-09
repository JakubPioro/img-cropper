<script setup lang="ts">
import { computed, reactive, watch } from "vue";
import { useI18n } from "vue-i18n";
import type { OutputFormat, ProcessingSettings } from "../types/image";

const props = defineProps<{
  settings: ProcessingSettings;
}>();

const emit = defineEmits<{
  update: [patch: Partial<ProcessingSettings>];
  dirtyState: [isDirty: boolean];
}>();

const DEFAULT_SETTINGS: ProcessingSettings = {
  width: 800,
  height: 600,
  format: "jpeg",
  quality: 0.9,
};

const { t } = useI18n();

const draft = reactive<ProcessingSettings>({ ...props.settings });

watch(
  () => props.settings,
  (next) => {
    draft.width = next.width;
    draft.height = next.height;
    draft.format = next.format;
    draft.quality = next.quality;
  },
  { deep: true },
);

const hasChanges = computed(
  () =>
    draft.width !== props.settings.width ||
    draft.height !== props.settings.height ||
    draft.format !== props.settings.format ||
    draft.quality !== props.settings.quality,
);

watch(
  hasChanges,
  (isDirty) => {
    emit("dirtyState", isDirty);
  },
  { immediate: true },
);

const formatLabel = computed(() => {
  return t(`settings.formats.${draft.format}`);
});

function updateNumber(field: "width" | "height", event: Event): void {
  const target = event.target as HTMLInputElement;
  const value = Number(target.value);
  if (Number.isNaN(value) || value < 1 || value > 8000) {
    return;
  }
  draft[field] = Math.round(value);
}

function updateFormat(event: Event): void {
  const target = event.target as HTMLSelectElement;
  draft.format = target.value as OutputFormat;
}

function updateQuality(event: Event): void {
  const target = event.target as HTMLInputElement;
  draft.quality = Number(target.value);
}

function confirmSettings(): void {
  emit("update", {
    width: draft.width,
    height: draft.height,
    format: draft.format,
    quality: draft.quality,
  });
}

function restoreDefaults(): void {
  draft.width = DEFAULT_SETTINGS.width;
  draft.height = DEFAULT_SETTINGS.height;
  draft.format = DEFAULT_SETTINGS.format;
  draft.quality = DEFAULT_SETTINGS.quality;

  emit("update", { ...DEFAULT_SETTINGS });
}
</script>

<template>
  <section class="step-card panel-rise step-2">
    <header class="step-head">
      <h2>{{ $t("settings.title") }}</h2>
    </header>
    <p class="step-copy">
      {{ $t("settings.description") }}
    </p>

    <div class="fields-grid">
      <label>
        {{ $t("settings.width") }}
        <input
          class="field"
          type="number"
          min="1"
          max="8000"
          :value="draft.width"
          @input="updateNumber('width', $event)"
        />
      </label>

      <label>
        {{ $t("settings.height") }}
        <input
          class="field"
          type="number"
          min="1"
          max="8000"
          :value="draft.height"
          @input="updateNumber('height', $event)"
        />
      </label>

      <label>
        {{ $t("settings.format") }}
        <select class="field" :value="draft.format" @change="updateFormat">
          <option value="jpeg">JPG</option>
          <option value="png">PNG</option>
          <option value="webp">WebP</option>
        </select>
      </label>

      <label>
        {{ $t("settings.quality") }}
        <input
          class="slider"
          type="range"
          min="0.5"
          max="1"
          step="0.01"
          :value="draft.quality"
          :disabled="draft.format === 'png'"
          @input="updateQuality"
        />
      </label>
    </div>

    <p class="format-chip">
      {{ $t("settings.selectedFormat", { format: formatLabel }) }}
    </p>

    <div class="actions-row">
      <button
        class="action-btn action-confirm"
        type="button"
        :disabled="!hasChanges"
        @click="confirmSettings"
      >
        {{ $t("settings.confirm") }}
      </button>
      <button
        class="action-btn action-restore"
        type="button"
        @click="restoreDefaults"
      >
        {{ $t("settings.restore") }}
      </button>
    </div>
  </section>
</template>

<style scoped>
.step-card {
  border: 3px solid #141414;
  background: #fff;
}

.step-2 {
  background: #fff4cf;
}

.step-head {
  border-bottom: 3px solid #141414;
  padding: 10px;
}

h2 {
  margin: 4px 0 0;
  font-size: 22px;
  font-weight: 800;
  text-transform: uppercase;
}

.step-copy {
  margin: 0;
  padding: 10px;
  border-bottom: 3px solid #141414;
  font-size: 14px;
  font-weight: 600;
}

.fields-grid {
  padding: 10px;
  display: grid;
  gap: 10px;
  grid-template-columns: 1fr 1fr;
}

label {
  display: grid;
  gap: 5px;
  font-size: 12px;
  font-weight: 700;
  text-transform: uppercase;
}

.field {
  border: 2px solid #141414;
  padding: 8px;
  font-size: 14px;
  font-family: "IBM Plex Mono", monospace;
  background: #fff;
}

.slider {
  accent-color: #2654c4;
}

.slider:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.actions-row {
  display: flex;
  gap: 8px;
  padding: 0 10px 10px;
}

.action-btn {
  border: 2px solid #141414;
  padding: 6px 10px;
  font-size: 11px;
  font-weight: 800;
  text-transform: uppercase;
  cursor: pointer;
}

.action-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.action-confirm {
  background: #2654c4;
  color: #fff;
}

.action-restore {
  background: #fff;
  color: #141414;
}

.format-chip {
  margin: 0 10px 10px;
  border: 2px solid #141414;
  display: inline-block;
  padding: 5px 8px;
  font-size: 11px;
  font-weight: 700;
  background: #2654c4;
  color: #fff;
}

@media (max-width: 420px) {
  .fields-grid {
    grid-template-columns: 1fr;
  }
}
</style>
