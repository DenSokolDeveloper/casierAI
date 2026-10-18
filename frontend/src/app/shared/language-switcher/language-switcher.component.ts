import { Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatTooltipModule } from '@angular/material/tooltip';
import { LanguageService } from '../../core/services/language.service';

@Component({
  selector: 'app-language-switcher',
  imports: [MatButtonModule, MatIconModule, MatMenuModule, MatTooltipModule],
  templateUrl: './language-switcher.component.html',
  styles: `
    .active-lang {
      font-weight: 600;
      color: var(--mat-sys-primary);
    }
  `,
})
export class LanguageSwitcherComponent {
  protected readonly languageService = inject(LanguageService);

  protected select(code: string): void {
    this.languageService.setLanguage(code);
  }
}
