import { Injectable, inject } from '@angular/core';
import { MatPaginatorIntl } from '@angular/material/paginator';
import { TranslateService } from '@ngx-translate/core';

// MatPaginatorIntl ships with hardcoded English labels and no hook for
// ngx-translate, so this re-reads them from i18n on creation and on every
// language switch, then fires changes so the paginator re-renders.
@Injectable()
export class TranslatedPaginatorIntl extends MatPaginatorIntl {
  private readonly translate = inject(TranslateService);

  constructor() {
    super();
    this.translateLabels();
    this.translate.onLangChange.subscribe(() => this.translateLabels());
  }

  override getRangeLabel = (page: number, pageSize: number, length: number): string => {
    if (length === 0 || pageSize === 0) {
      return `0 ${this.translate.instant('common.paginatorOf')} ${length}`;
    }
    const start = page * pageSize;
    const end = Math.min(start + pageSize, length);
    return `${start + 1} - ${end} ${this.translate.instant('common.paginatorOf')} ${length}`;
  };

  private translateLabels(): void {
    this.itemsPerPageLabel = this.translate.instant('common.paginatorItemsPerPage');
    this.nextPageLabel = this.translate.instant('common.paginatorNextPage');
    this.previousPageLabel = this.translate.instant('common.paginatorPreviousPage');
    this.firstPageLabel = this.translate.instant('common.paginatorFirstPage');
    this.lastPageLabel = this.translate.instant('common.paginatorLastPage');
    this.changes.next();
  }
}
