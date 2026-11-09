<script setup lang="ts">
import { computed } from "vue";

const props = defineProps<{
  readyCount: number;
  totalCount: number;
  isBusy: boolean;
  isDownloadLocked: boolean;
}>();

const emit = defineEmits<{
  zip: [];
}>();

const canDownloadAllZip = computed(
  () =>
    props.totalCount > 0 &&
    props.readyCount === props.totalCount &&
    !props.isBusy &&
    !props.isDownloadLocked,
);
</script>

<template>
  <section class="step-card panel-rise step-5">
    <header class="step-head">
      <h2>{{ $t("download.title") }}</h2>
    </header>
    <p class="step-copy">
      {{ $t("download.description") }}
    </p>

    <div class="actions-row">
      <button
        class="step-btn step-btn-blue"
        type="button"
        :disabled="!canDownloadAllZip"
        @click="emit('zip')"
      >
        {{ $t("download.zip") }}
      </button>
    </div>
  </section>
</template>

<style scoped>
.step-card {
  border: 3px solid #141414;
  background: #fff;
}

.step-5 {
  background: #2654c4;
  color: #fff;
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

.actions-row {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 10px;
}

.step-btn {
  border: 2px solid #141414;
  padding: 8px 10px;
  font-size: 12px;
  font-weight: 800;
  text-transform: uppercase;
  cursor: pointer;
}

.step-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.step-btn-blue {
  background: #fff;
  color: #141414;
}
</style>
