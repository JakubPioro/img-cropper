<script setup lang="ts">
import type { NotificationMessage } from "../types/image";

const props = defineProps<{
  items: NotificationMessage[];
}>();

const emit = defineEmits<{
  dismiss: [id: string];
}>();

function colorClass(level: NotificationMessage["level"]): string {
  if (level === "success") {
    return "note-success";
  }
  if (level === "warning") {
    return "note-warning";
  }
  if (level === "error") {
    return "note-error";
  }
  return "note-info";
}
</script>

<template>
  <section v-if="items.length > 0" class="notes-wrap panel-rise">
    <div class="notes-list">
      <article
        v-for="item in items"
        :key="item.id"
        class="note-row"
        :class="colorClass(item.level)"
      >
        <p class="note-text">{{ item.text }}</p>
        <button
          class="note-close"
          type="button"
          :aria-label="$t('notifications.dismiss')"
          @click="emit('dismiss', item.id)"
        >
          x
        </button>
      </article>
    </div>
  </section>
</template>

<style scoped>
.notes-wrap {
  border: 3px solid #141414;
  background: #fff;
}

.notes-list {
  max-height: 260px;
  overflow: auto;
}

.note-row {
  display: grid;
  grid-template-columns: 1fr auto;
  align-items: start;
  gap: 8px;
  padding: 6px 8px;
  border-bottom: 2px solid #141414;
}

.note-row:last-child {
  border-bottom: none;
}

.note-text {
  margin: 0;
  font-size: 12px;
  font-weight: 700;
  line-height: 1.2;
}

.note-close {
  border: 2px solid #141414;
  background: #141414;
  color: #fff;
  width: 24px;
  height: 24px;
  padding: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  font-weight: 800;
  line-height: 1;
  cursor: pointer;
}

.note-close:hover {
  background: #000;
}

.note-success {
  background: #d8f0c8;
  color: #141414;
}

.note-warning {
  background: #f2c230;
  color: #141414;
}

.note-error {
  background: #d64933;
  color: #fff;
}

.note-info {
  background: #2654c4;
  color: #fff;
}
</style>
