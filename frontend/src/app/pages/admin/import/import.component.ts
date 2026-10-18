import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { TranslatePipe } from '@ngx-translate/core';
import { ImportService } from '../../../core/services/import.service';
import { ImportCommitResult, ImportPreviewRow } from '../../../core/models/import.models';

interface PreviewRowState extends ImportPreviewRow {
  include: boolean;
}

@Component({
  selector: 'app-admin-import',
  imports: [
    FormsModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatTableModule,
    MatCheckboxModule,
    MatFormFieldModule,
    MatInputModule,
    MatChipsModule,
    MatProgressSpinnerModule,
    TranslatePipe,
  ],
  templateUrl: './import.component.html',
  styleUrl: './import.component.scss',
})
export class ImportComponent {
  private readonly importService = inject(ImportService);

  protected readonly selectedFile = signal<File | null>(null);
  protected readonly isUploading = signal(false);
  protected readonly isCommitting = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly successResult = signal<ImportCommitResult | null>(null);
  protected readonly parseErrors = signal<string[]>([]);
  protected readonly aiUsed = signal(false);
  protected readonly rows = signal<PreviewRowState[]>([]);
  protected readonly displayedColumns = [
    'include',
    'name',
    'category',
    'price',
    'unit',
    'stockQty',
  ];

  get includedCount(): number {
    return this.rows().filter((row) => row.include).length;
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    this.selectedFile.set(file);
    this.rows.set([]);
    this.parseErrors.set([]);
    this.errorMessage.set(null);
    this.successResult.set(null);
  }

  upload(): void {
    const file = this.selectedFile();
    if (!file) {
      return;
    }
    this.isUploading.set(true);
    this.errorMessage.set(null);
    this.successResult.set(null);
    this.importService.preview(file).subscribe({
      next: (result) => {
        this.rows.set(result.rows.map((row) => ({ ...row, include: true })));
        this.parseErrors.set(result.errors);
        this.aiUsed.set(result.aiUsed);
        this.isUploading.set(false);
      },
      error: (err) => {
        this.errorMessage.set(err?.error?.message ?? 'admin.import.previewError');
        this.isUploading.set(false);
      },
    });
  }

  toggleAll(include: boolean): void {
    this.rows.set(this.rows().map((row) => ({ ...row, include })));
  }

  commit(): void {
    const selected = this.rows().filter((row) => row.include);
    if (selected.length === 0) {
      return;
    }
    this.isCommitting.set(true);
    this.errorMessage.set(null);
    this.importService.commit(selected).subscribe({
      next: (result) => {
        this.successResult.set(result);
        this.rows.set([]);
        this.parseErrors.set([]);
        this.selectedFile.set(null);
        this.isCommitting.set(false);
      },
      error: (err) => {
        this.errorMessage.set(err?.error?.message ?? 'admin.import.commitError');
        this.isCommitting.set(false);
      },
    });
  }
}
