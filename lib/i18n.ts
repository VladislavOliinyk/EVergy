export type Language = "en" | "uk";
const LANGUAGE_KEY = "evergy-language";
export const translations = {
  en: { home: "HOME", stats: "STATS", car: "MY CAR", settings: "SETTINGS", diagnostics: "DIAGNOSTICS", language: "Language", ukrainian: "Українська", english: "English", save: "Save", active: "Active", use: "Use" },
  uk: { home: "ГОЛОВНА", stats: "СТАТИСТИКА", car: "МІЙ АВТО", settings: "НАЛАШТУВАННЯ", diagnostics: "ДІАГНОСТИКА", language: "Мова", ukrainian: "Українська", english: "English", save: "Зберегти", active: "Активна", use: "Обрати" },
} as const;
export function getLanguage(): Language { if (typeof window === "undefined") return "en"; return localStorage.getItem(LANGUAGE_KEY) === "uk" ? "uk" : "en"; }
export function saveLanguage(language: Language) { if (typeof window !== "undefined") { localStorage.setItem(LANGUAGE_KEY, language); window.dispatchEvent(new Event("evergy:language-change")); } }
