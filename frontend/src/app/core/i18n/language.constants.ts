export interface SupportedLanguage {
  code: string;
  label: string;
}

export const SUPPORTED_LANGUAGES: SupportedLanguage[] = [
  { code: 'ru', label: 'Русский' },
  { code: 'en', label: 'English' },
  { code: 'uk', label: 'Українська' },
  { code: 'pl', label: 'Polski' },
];

export const DEFAULT_LANGUAGE = 'ru';
export const LANGUAGE_STORAGE_KEY = 'casierai_lang';

export function readStoredLanguage(): string {
  try {
    const saved = localStorage.getItem(LANGUAGE_STORAGE_KEY);
    if (saved && SUPPORTED_LANGUAGES.some((lang) => lang.code === saved)) {
      return saved;
    }
  } catch {
    // Storage unavailable - fall through to the default.
  }
  return DEFAULT_LANGUAGE;
}
