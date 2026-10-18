import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { CategoriesService } from '../../../core/services/categories.service';
import { Category } from '../../../core/models/catalog.models';

@Component({
  selector: 'app-admin-categories',
  imports: [
    ReactiveFormsModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatTableModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
    TranslatePipe,
  ],
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
  protected readonly displayedColumns = ['photo', 'name', 'description', 'actions'];

  protected readonly form = this.fb.group({
    name: ['', Validators.required],
    description: [''],
  });

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.isLoading.set(true);
    this.categoriesService.list().subscribe({
      next: (categories) => {
        this.categories.set(categories);
        this.isLoading.set(false);
      },
      error: () => {
        this.errorMessage.set('admin.categories.loadError');
        this.isLoading.set(false);
      },
    });
  }

  startCreate(): void {
    this.editingId.set(null);
    this.form.reset({ name: '', description: '' });
    this.selectedPhoto.set(null);
    this.photoPreview.set(null);
  }

  startEdit(category: Category): void {
    this.editingId.set(category._id);
    this.form.setValue({ name: category.name, description: category.description ?? '' });
    this.selectedPhoto.set(null);
    this.photoPreview.set(category.photoUrl ?? null);
  }

  cancelEdit(): void {
    this.editingId.set(null);
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
