<script lang="ts" setup>
import { watch } from "vue";
import { STORAGE_KEY, SUPPORTED_LOCALES, type AppLocale } from "../i18n.ts";
import { useI18n } from "vue-i18n";

const i18n = useI18n();

function setLocale(nextLocale: AppLocale) {
  i18n.locale.value = nextLocale;
  localStorage.setItem(STORAGE_KEY, nextLocale);
}

const isCurrentLocale = (lang: AppLocale) => i18n.locale.value === lang;

watch(
  i18n.locale,
  (newLocale) => {
    document.documentElement.lang = newLocale;
  },
  { immediate: true },
);
</script>

<template>
  <div
    role="group"
    :aria-label="$t('app.languageToggle')"
    class="locale-switch"
  >
    <button
      v-for="lang in SUPPORTED_LOCALES"
      :key="lang"
      class="locale-btn"
      type="button"
      :lang="lang"
      :aria-pressed="isCurrentLocale(lang)"
      @click="setLocale(lang)"
    >
      {{ lang }}
    </button>
  </div>
</template>

<style scoped>
.locale-switch {
  display: inline-flex;
  border: 2px solid #141414;
  background: #fff;
  box-shadow: 3px 3px 0 #141414;
}

.locale-btn {
  min-width: 44px;
  min-height: 34px;
  padding: 6px 10px;
  border: 0;
  background: transparent;
  color: #141414;
  font-size: 12px;
  font-weight: 800;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  cursor: pointer;
  transition:
    background-color 120ms ease,
    color 120ms ease;
}

.locale-btn + .locale-btn {
  border-left: 2px solid #141414;
}

.locale-btn:hover:not([aria-pressed="true"]) {
  background: #fff4cf;
}

.locale-btn[aria-pressed="true"] {
  background: #f2c230;
  cursor: default;
}

.locale-btn:focus-visible {
  outline: 3px solid #2654c4;
  outline-offset: -5px;
}

@media (prefers-reduced-motion: reduce) {
  .locale-btn {
    transition: none;
  }
}
</style>
