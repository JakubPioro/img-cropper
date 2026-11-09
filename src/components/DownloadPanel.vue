<script setup lang="ts">
import { computed } from "vue";

const props = defineProps<{
  readyCount: number;
  totalCount: number;
  isBusy: boolean;
  isStepThreeApproved: boolean;
}>();

const emit = defineEmits<{
  process: [];
}>();

const canProcess = computed(
  () => props.totalCount > 0 && !props.isBusy && props.isStepThreeApproved,
);
</script>

<template>
  <section class="step-card panel-rise step-4">
    <header class="step-head">
      <h2>{{ $t("processing.title") }}</h2>
    </header>
    <p class="step-copy">
      {{ $t("processing.description") }}
    </p>

    <div class="actions-row">
      <button
        class="step-btn step-btn-yellow"
        type="button"
        :disabled="!canProcess"
        @click="emit('process')"
      >
        {{ isBusy ? $t("processing.inProgress") : $t("processing.start") }}
      </button>
    </div>
  </section>
</template>

<style scoped>
.step-card {
  border: 3px solid #141414;
  background: #fff;
}

.step-4 {
  background: #d64933;
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
  flex-wrap: wrap;
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

.step-btn-yellow {
  background: #f2c230;
  color: #141414;
}

.step-btn-white {
  background: #fff;
  color: #141414;
}
</style>
