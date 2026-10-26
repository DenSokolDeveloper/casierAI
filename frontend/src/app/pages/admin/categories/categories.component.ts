import { Component, OnInit, ViewChild, inject, signal } from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { SelectionModel } from '@angular/cdk/collections';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatTableModule, MatTableDataSource } from '@angular/material/table';
import { MatSort, MatSortModule, Sort } from '@angular/material/sort';
import { MatPaginator, MatPaginatorIntl, MatPaginatorModule } from '@angular/material/paginator';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { DatePipe } from '@angular/common';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { CategoriesService } from '../../../core/services/categories.service';
import { Category } from '../../../core/models/catalog.models';
import { TranslatedPaginatorIntl } from '../../../core/services/translated-paginator-intl.service';

@Component({
  selector: 'app-admin-categories',
  imports: [
    FormsModule,
    ReactiveFormsModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatCheckboxModule,
    MatTableModule,
    MatSortModule,
    MatPaginatorModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
    DatePipe,
    TranslatePipe,
  ],
  providers: [{ provide: MatPaginatorIntl, useClass: TranslatedPaginatorIntl }],
  templateUrl: './categories.component.html',
  styleUrl: './categories.component.scss',
})
export class CategoriesComponent implements OnInit {
  private readonly categoriesService = inject(CategoriesService);
  private readonly fb = inject(FormBuilder);
  private readonly translate = inject(TranslateService);

  protected readonly categories = signal<Category[]>([]);
  protected readonly isLoading = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly editingId = signal<string | null>(null);
  protected readonly selectedPhoto = signal<File | null>(null);
  protected readonly photoPreview = signal<string | null>(null);
  protected readonly showDialog = signal(false);
  protected readonly searchTerm = signal('');

  protected readonly displayedColumns = ['select', 'photo', 'name', 'description', 'createdAt', 'actions'];
  protected readonly dataSource = new MatTableDataSource<Category>([]);
  protected readonly selection = new SelectionModel<string>(true, []);

  protected readonly form = this.fb.group({
    name: ['', Validators.required],
    description: [''],
  });

  @ViewChild(MatPaginator) set paginator(value: MatPaginator) {
    this.dataSource.paginator = value ?? null;
  }

  @ViewChild(MatSort) set sort(value: MatSort) {
    this.dataSource.sort = value ?? null;
  }

  // A plain method, not computed(): the underlying SelectionModel and
  // MatTableDataSource are not signals, so computed() would never see a
  // dependency change and the result would cache stale forever. A method
  // call is re-evaluated on every change-detection pass instead.
  protected allSelected(): boolean {
    const visible = this.dataSource.filteredData;
    return visible.length > 0 && visible.every((category) => this.selection.isSelected(category._id));
  }

  constructor() {
    this.dataSource.filterPredicate = (category, filter) =>
      category.name.toLowerCase().includes(filter);
  }

  ngOnInit(): void {
    this.load();
  }

  protected onSearchChange(term: string): void {
    this.searchTerm.set(term);
    this.dataSource.filter = term.trim().toLowerCase();
    if (this.dataSource.paginator) {
      this.dataSource.paginator.firstPage();
    }
  }

  protected sortData(sort: Sort): void {
    // MatSort already drives dataSource.sort; this hook just resets to
    // page 1 so a re-sort doesn't strand the view on a now-empty page.
    void sort;
    if (this.dataSource.paginator) {
      this.dataSource.paginator.firstPage();
    }
  }

  load(): void {
    this.isLoading.set(true);
    this.categoriesService.list().subscribe({
      next: (categories) => {
        this.categories.set(categories);
        this.dataSource.data = categories;
        this.selection.clear();
        this.isLoading.set(false);
      },
      error: () => {
        this.errorMessage.set('admin.categories.loadError');
        this.isLoading.set(false);
      },
    });
  }

  protected toggleAll(): void {
    if (this.allSelected()) {
      this.dataSource.filteredData.forEach((category) => this.selection.deselect(category._id));
    } else {
      this.dataSource.filteredData.forEach((category) => this.selection.select(category._id));
    }
  }

  protected toggleOne(categoryId: string): void {
    this.selection.toggle(categoryId);
  }

  protected deleteSelected(): void {
    const ids = this.selection.selected;
    if (ids.length === 0) {
      return;
    }
    const confirmMessage = this.translate.instant('admin.categories.confirmDeleteSelected', {
      count: ids.length,
    });
    if (!confirm(confirmMessage)) {
      return;
    }
    this.errorMessage.set(null);
    let remaining = ids.length;
    let hadError = false;
    ids.forEach((id) => {
      this.categoriesService.remove(id).subscribe({
        next: () => this.afterBulkDeleteOne(--remaining, hadError),
        error: () => {
          hadError = true;
          this.afterBulkDeleteOne(--remaining, hadError);
        },
      });
    });
  }

  private afterBulkDeleteOne(remaining: number, hadError: boolean): void {
    if (remaining > 0) {
      return;
    }
    if (hadError) {
      this.errorMessage.set('admin.categories.deleteError');
    }
    this.load();
  }

  startCreate(): void {
    this.editingId.set(null);
    this.form.reset({ name: '', description: '' });
    this.selectedPhoto.set(null);
    this.photoPreview.set(null);
    this.errorMessage.set(null);
    this.showDialog.set(true);
  }

  startEdit(category: Category): void {
    this.editingId.set(category._id);
    this.form.setValue({ name: category.name, description: category.description ?? '' });
    this.selectedPhoto.set(null);
    this.photoPreview.set(category.photoUrl ?? null);
    this.errorMessage.set(null);
    this.showDialog.set(true);
  }

  cancelEdit(): void {
    this.editingId.set(null);
    this.showDialog.set(false);
    this.form.reset({ name: '', description: '' });
    this.selectedPhoto.set(null);
    this.photoPreview.set(null);
  }

  onPhotoSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) {
      return;
    }
    this.selectedPhoto.set(file);
    const reader = new FileReader();
    reader.onload = () => this.photoPreview.set(reader.result as string);
    reader.readAsDataURL(file);
  }

  submit(): void {
    if (this.form.invalid) {
      return;
    }
    const { name, description } = this.form.getRawValue();
    const payload = { name: name!, description: description || undefined };
    this.errorMessage.set(null);

    const editingId = this.editingId();
    const request = editingId
      ? this.categoriesService.update(editingId, payload)
      : this.categoriesService.create(payload);

    request.subscribe({
      next: (category) => this.afterSave(category._id),
      error: () => this.errorMessage.set('admin.categories.saveError'),
    });
  }

  private afterSave(categoryId: string): void {
    const photo = this.selectedPhoto();
    if (!photo) {
      this.cancelEdit();
      this.load();
      return;
    }
    this.categoriesService.uploadPhoto(categoryId, photo).subscribe({
      next: () => {
        this.cancelEdit();
        this.load();
      },
      error: () => {
        this.errorMessage.set('admin.categories.photoError');
        this.cancelEdit();
        this.load();
      },
    });
  }

  remove(category: Category): void {
    const confirmMessage = this.translate.instant('admin.categories.confirmDelete', {
      name: category.name,
    });
    if (!confirm(confirmMessage)) {
      return;
    }
    this.categoriesService.remove(category._id).subscribe({
      next: () => this.load(),
      error: () => this.errorMessage.set('admin.categories.deleteError'),
    });
  }
}
