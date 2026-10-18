import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { CategoriesService } from '../../../core/services/categories.service';
import { Category } from '../../../core/models/catalog.models';

@Component({
  selector: 'app-admin-categories',
  imports: [ReactiveFormsModule],
  templateUrl: './categories.component.html',
  styleUrl: './categories.component.scss',
})
export class CategoriesComponent implements OnInit {
  private readonly categoriesService = inject(CategoriesService);
  private readonly fb = inject(FormBuilder);

  protected readonly categories = signal<Category[]>([]);
  protected readonly isLoading = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly editingId = signal<string | null>(null);
  protected readonly selectedPhoto = signal<File | null>(null);
  protected readonly photoPreview = signal<string | null>(null);

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
        this.errorMessage.set('Не удалось загрузить категории');
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
      error: () => this.errorMessage.set('Не удалось сохранить категорию'),
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
        this.errorMessage.set('Категория сохранена, но не удалось загрузить фото');
        this.cancelEdit();
        this.load();
      },
    });
  }

  remove(category: Category): void {
    if (!confirm(`Удалить категорию "${category.name}"?`)) {
      return;
    }
    this.categoriesService.remove(category._id).subscribe({
      next: () => this.load(),
      error: () =>
        this.errorMessage.set(
          'Не удалось удалить категорию (возможно, есть товары в этой категории)',
        ),
    });
  }
}
