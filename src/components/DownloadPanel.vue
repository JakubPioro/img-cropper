<script setup lang="ts">
import { computed, ref } from "vue";

const props = defineProps<{
  readyCount: number;
  totalCount: number;
  isBusy: boolean;
}>();

const emit = defineEmits<{
  process: [];
  zip: [];
  clear: [];
  "rename-prefix": [prefix: string];
}>();

const namePrefix = ref("");
const canApplyPrefix = computed(() => namePrefix.value.trim().length > 0);
const canProcess = computed(() => props.totalCount > 0 && !props.isBusy);
const canDownloadAllZip = computed(
  () =>
    props.totalCount > 0 &&
    props.readyCount === props.totalCount &&
    !props.isBusy,
);

function applyPrefixToAll(): void {
  const nextPrefix = namePrefix.value.trim();
  if (!nextPrefix) {
    return;
  }

  emit("rename-prefix", nextPrefix);
  namePrefix.value = "";
}
</script>

<template>
  <section class="step-card panel-rise step-4">
    <header class="step-head">
      <h2>Krok 4. Przetworz i pobierz</h2>
    </header>
    <p class="step-copy">
      Najpierw kliknij przetwarzanie. Gdy pliki beda gotowe, pobierzesz je
      osobno lub wszystkie naraz w ZIP.
    </p>

    <div class="actions-row">
      <div class="prefix-row">
        <input
          v-model="namePrefix"
          class="prefix-input"
          type="text"
          placeholder="prefix nazwy, np. sesja"
          @keydown.enter.prevent="applyPrefixToAll"
        />
        <button
          class="step-btn step-btn-white"
          type="button"
          :disabled="!canApplyPrefix || props.totalCount === 0"
          @click="applyPrefixToAll"
        >
          Nadaj prefix wszystkim
        </button>
      </div>

      <button
        class="step-btn step-btn-yellow"
        type="button"
        :disabled="!canProcess"
        @click="emit('process')"
      >
        {{ isBusy ? "Przetwarzanie..." : "Uruchom przetwarzanie" }}
      </button>
      <button
        class="step-btn step-btn-white"
        type="button"
        :disabled="!canDownloadAllZip"
        @click="emit('zip')"
      >
        Pobierz wszystko jako ZIP
      </button>
      <button
        class="step-btn step-btn-blue"
        type="button"
        @click="emit('clear')"
      >
        Wyczysc
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

.prefix-row {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 8px;
}

.prefix-input {
  border: 2px solid #141414;
  background: #fff;
  color: #141414;
  padding: 8px 10px;
  font-size: 12px;
  font-weight: 700;
  font-family: "IBM Plex Mono", monospace;
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

.step-btn-blue {
  background: #2654c4;
  color: #fff;
}
</style>
