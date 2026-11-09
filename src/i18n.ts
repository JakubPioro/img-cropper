import { createI18n } from "vue-i18n";
import pl from "./locales/pl.json";
import en from "./locales/en.json";

export const SUPPORTED_LOCALES = ["pl", "en"] as const;
export type AppLocale = (typeof SUPPORTED_LOCALES)[number];
export const STORAGE_KEY = "img-cropper-locale";

function isSupported(value: string | null): value is AppLocale {
  return value !== null && SUPPORTED_LOCALES.includes(value as AppLocale);
}

function detectLocale(): AppLocale {
  const localStorageLang = localStorage.getItem(STORAGE_KEY);
  if (isSupported(localStorageLang)) return localStorageLang;

  const navigatorLang = navigator.language.split("-")[0].toLowerCase();
  if (isSupported(navigatorLang)) return navigatorLang;
  return "en";
}

export function polishPluralRule(
  choice: number,
  _choicesLength: number,
): number {
  if (choice === 1) return 0;
  if ([2, 3, 4].includes(choice % 10) && ![12, 13, 14].includes(choice % 100))
    return 1;
  return 2;
}

export const i18n = createI18n({
  locale: detectLocale(),
  legacy: false,
  fallbackLocale: "en",
  messages: {
    pl,
    en,
  },
  pluralRules: {
    pl: polishPluralRule,
  },
});
