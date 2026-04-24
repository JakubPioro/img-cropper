<script setup lang="ts">
import { ref } from "vue";

const emit = defineEmits<{
  filesSelected: [files: File[]];
}>();

const isDragging = ref(false);

function emitFiles(fileList: FileList | null): void {
  if (!fileList) {
    return;
  }

  emit("filesSelected", Array.from(fileList));
}

function onInputChange(event: Event): void {
  const target = event.target as HTMLInputElement;
  emitFiles(target.files);
  target.value = "";
}

function onDrop(event: DragEvent): void {
  event.preventDefault();
  isDragging.value = false;
  emitFiles(event.dataTransfer?.files ?? null);
}
</script>

<template>
  <section class="step-card panel-rise step-1">
    <header class="step-head">
      <h2>Krok 1. Dodaj zdjecia</h2>
    </header>
    <p class="step-copy">
      Przeciagnij pliki tutaj albo wybierz je przyciskiem. Obslugiwane formaty:
      JPG, PNG, WebP. Limit: 50 plikow, do 20MB na plik.
    </p>

    <div
      class="drop-zone"
      :class="isDragging ? 'drop-zone-active' : ''"
      @dragover.prevent="isDragging = true"
      @dragleave.prevent="isDragging = false"
      @drop="onDrop"
    >
      <p class="drop-title">Upusc pliki w tym obszarze</p>
      <p class="drop-or">lub</p>
      <label class="step-btn step-btn-red">
        Wybierz zdjecia
        <input
          class="hidden"
          type="file"
          multiple
          accept="image/jpeg,image/png,image/webp"
          @change="onInputChange"
        />
      </label>
    </div>
  </section>
</template>

<style scoped>
.step-card {
  border: 3px solid #141414;
  background: #fff;
}

.step-1 {
  background: #e9f0ff;
}

.step-head {
  border-bottom: 3px solid #141414;
  padding: 10px;
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

.drop-zone {
  margin: 10px;
  border: 3px solid #141414;
  background: #fff;
  padding: 16px;
  text-align: center;
}

.drop-zone-active {
  background: #f2c230;
}

.drop-title {
  margin: 0;
  font-size: 15px;
  font-weight: 700;
  text-transform: uppercase;
}

.drop-or {
  margin: 8px 0;
  font-size: 11px;
  font-weight: 700;
}

.step-btn {
  display: inline-block;
  cursor: pointer;
  border: 2px solid #141414;
  padding: 8px 12px;
  font-size: 12px;
  font-weight: 800;
  text-transform: uppercase;
}

.step-btn-red {
  background: #d64933;
  color: #fff;
}
</style>
