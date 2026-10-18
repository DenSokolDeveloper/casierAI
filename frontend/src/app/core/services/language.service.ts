import { Injectable, inject } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { LANGUAGE_STORAGE_KEY, SUPPORTED_LANGUAGES, SupportedLanguage } from '../i18n/language.constants';

@Injectable({ providedIn: 'root' })
export class LanguageService {
  private readonly translate = inject(TranslateService);

  readonly languages: SupportedLanguage[] = SUPPORTED_LANGUAGES;
  readonly currentLang = this.translate.currentLang;

  setLanguage(code: string): void {
    this.translate.use(code).subscribe();
    try {
      localStorage.setItem(LANGUAGE_STORAGE_KEY, code);
    } catch {
      // Storage unavailable - language just won't persist across reloads.
    }
  }
}
