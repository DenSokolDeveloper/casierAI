import { Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatTableModule } from '@angular/material/table';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { ProductsService } from '../../../core/services/products.service';
import { CategoriesService } from '../../../core/services/categories.service';
import { Category, PriceType, Product } from '../../../core/models/catalog.models';
import { downloadCsv } from '../../../core/utils/csv.util';
import { UnitLabelPipe } from '../../../core/pipes/unit-label.pipe';

@Component({
  selector: 'app-admin-products',
  imports: [
    ReactiveFormsModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule,
    MatSlideToggleModule,
    MatTableModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
    TranslatePipe,
    UnitLabelPipe,
  ],
  templateUrl: './products.component.html',
  styleUrl: './products.component.scss',
})
export class ProductsComponent implements OnInit {
  private readonly productsService = inject(ProductsService);
  private readonly categoriesService = inject(CategoriesService);
  private readonly fb = inject(FormBuilder);
  private readonly translate = inject(TranslateService);

  protected readonly products = signal<Product[]>([]);
  protected readonly categories = signal<Category[]>([]);
  protected readonly isLoading = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly editingId = signal<string | null>(null);
  protected readonly selectedPhoto = signal<File | null>(null);
  protected readonly photoPreview = signal<string | null>(null);
  protected readonly displayedColumns = ['photo', 'name', 'category', 'price', 'stock', 'active', 'actions'];

  protected readonly form = this.fb.group({
    name: ['', Validators.required],
    categoryId: [''],
    priceType: ['fixed' as PriceType, Validators.required],
    price: [0, [Validators.required, Validators.min(0)]],
    unit: ['pcs'],
    stockQty: [0, [Validators.min(0)]],
    visualDescription: [''],
    active: [true],
  });

  protected readonly CREATE_CATEGORY_VALUE = '__create_category__';
  protected readonly showCategoryDialog = signal(false);
  protected readonly categoryDialogError = signal<string | null>(null);
  protected readonly categoryPhoto = signal<File | null>(null);
  protected readonly categoryPhotoPreview = signal<string | null>(null);

  protected readonly categoryForm = this.fb.group({
    name: ['', Validators.required],
    description: [''],
  });

  private lastCategoryId = '';

  private static readonly FIXED_UNIT_OPTIONS = [
    { value: 'pcs', labelKey: 'admin.products.unitPcs' },
    { value: 'pack', labelKey: 'admin.products.unitPack' },
    { value: 'box', labelKey: 'admin.products.unitBox' },
    { value: 'bottle', labelKey: 'admin.products.unitBottle' },
  ];

  private static readonly WEIGHT_UNIT_OPTIONS = [
    { value: 'kg', labelKey: 'admin.products.unitKg' },
    { value: 'l', labelKey: 'admin.products.unitL' },
  ];

  ngOnInit(): void {
    this.categoriesService.list().subscribe({
      next: (categories) => this.categories.set(categories),
      error: () => this.errorMessage.set('admin.products.loadCategoriesError'),
    });
    this.load();

    this.form.get('priceType')!.valueChanges.subscribe((priceType) => {
      // Only nudge the default for a brand-new product - never silently
      // rewrite an existing product's unit just because the form re-emits.
      if (this.editingId()) {
        return;
      }
      this.form.get('unit')!.setValue(priceType === 'perWeight' ? 'kg' : 'pcs');
    });

    this.form.get('categoryId')!.valueChanges.subscribe((current) => {
      if (current === this.CREATE_CATEGORY_VALUE) {
        this.form.get('categoryId')!.setValue(this.lastCategoryId, { emitEvent: false });
        this.openCategoryDialog();
        return;
      }
      this.lastCategoryId = current ?? '';
    });
  }

  protected unitOptions(): { value: string; labelKey: string }[] {
    const isWeight = this.form.get('priceType')?.value === 'perWeight';
    const options = isWeight ? ProductsComponent.WEIGHT_UNIT_OPTIONS : ProductsComponent.FIXED_UNIT_OPTIONS;
    const current = this.form.get('unit')?.value;
    if (current && !options.some((option) => option.value === current)) {
      // A legacy/custom unit value already saved on this product - keep it
      // selectable instead of silently hiding it behind a blank select.
      return [...options, { value: current, labelKey: '' }];
    }
    return options;
  }

  load(): void {
    this.isLoading.set(true);
    this.productsService.list().subscribe({
      next: (products) => {
        this.products.set(products);
        this.isLoading.set(false);
      },
      error: () => {
        this.errorMessage.set('admin.products.loadError');
        this.isLoading.set(false);
      },
    });
  }

  categoryName(product: Product): string {
    const category = product.categoryId;
    if (!category) {
      return '—';
    }
    return typeof category === 'string' ? category : category.name;
  }

  startCreate(): void {
    this.editingId.set(null);
    this.form.reset({
      name: '',
      categoryId: '',
      priceType: 'fixed',
      price: 0,
      unit: 'pcs',
      stockQty: 0,
      visualDescription: '',
      active: true,
    });
    this.selectedPhoto.set(null);
    this.photoPreview.set(null);
  }

  startEdit(product: Product): void {
    this.editingId.set(product._id);
    const categoryId = !product.categoryId
      ? ''
      : typeof product.categoryId === 'string'
        ? product.categoryId
        : product.categoryId._id;
    this.form.setValue({
      name: product.name,
      categoryId,
      priceType: product.priceType,
      price: product.price,
      unit: product.unit,
      stockQty: product.stockQty,
      visualDescription: product.visualDescription ?? '',
      active: product.active,
    });
    this.selectedPhoto.set(null);
    this.photoPreview.set(product.photoUrl ?? null);
  }

  cancelEdit(): void {
    this.editingId.set(null);
    this.startCreate();
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
    const raw = this.form.getRawValue();
    const payload = {
      name: raw.name!,
      categoryId: raw.categoryId || null,
      priceType: raw.priceType!,
      price: raw.price!,
      unit: raw.unit || undefined,
      stockQty: raw.stockQty ?? undefined,
      visualDescription: raw.visualDescription || undefined,
      active: raw.active ?? undefined,
    };
    this.errorMessage.set(null);

    const editingId = this.editingId();
    const request = editingId
      ? this.productsService.update(editingId, payload)
      : this.productsService.create(payload);

    request.subscribe({
      next: (product) => this.afterSave(product._id),
      error: () => this.errorMessage.set('admin.products.saveError'),
    });
  }

  private afterSave(productId: string): void {
    const photo = this.selectedPhoto();
    if (!photo) {
      this.cancelEdit();
      this.load();
      return;
    }
    this.productsService.uploadPhoto(productId, photo).subscribe({
      next: () => {
        this.cancelEdit();
        this.load();
      },
      error: () => {
        this.errorMessage.set('admin.products.photoError');
        this.cancelEdit();
        this.load();
      },
    });
  }

  exportCsv(): void {
    const headers = [
      'Name',
      'Category',
      'Price type',
      'Price',
      'Unit',
      'Stock',
      'Active',
    ];
    const rows = this.products().map((product) => [
      product.name,
      this.categoryName(product),
      product.priceType,
      product.price,
      product.unit,
      product.stockQty,
      product.active ? 'yes' : 'no',
    ]);
    downloadCsv('products.csv', headers, rows);
  }

  remove(product: Product): void {
    const confirmMessage = this.translate.instant('admin.products.confirmDelete', {
      name: product.name,
    });
    if (!confirm(confirmMessage)) {
      return;
    }
    this.productsService.remove(product._id).subscribe({
      next: () => this.load(),
      error: () => this.errorMessage.set('admin.products.deleteError'),
    });
  }

  protected openCategoryDialog(): void {
    this.categoryForm.reset({ name: '', description: '' });
    this.categoryPhoto.set(null);
    this.categoryPhotoPreview.set(null);
    this.categoryDialogError.set(null);
    this.showCategoryDialog.set(true);
  }

  protected cancelCategoryDialog(): void {
    this.showCategoryDialog.set(false);
  }

  protected onCategoryPhotoSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) {
      return;
    }
    this.categoryPhoto.set(file);
    const reader = new FileReader();
    reader.onload = () => this.categoryPhotoPreview.set(reader.result as string);
    reader.readAsDataURL(file);
  }

  protected submitCategoryDialog(): void {
    if (this.categoryForm.invalid) {
      return;
    }
    const { name, description } = this.categoryForm.getRawValue();
    this.categoryDialogError.set(null);
    this.categoriesService.create({ name: name!, description: description || undefined }).subscribe({
      next: (category) => this.afterCategoryCreated(category),
      error: () => this.categoryDialogError.set('admin.products.categoryDialogSaveError'),
    });
  }

  private afterCategoryCreated(category: Category): void {
    const photo = this.categoryPhoto();
    if (!photo) {
      this.applyNewCategory(category);
      return;
    }
    this.categoriesService.uploadPhoto(category._id, photo).subscribe({
      next: (updated) => this.applyNewCategory(updated),
      error: () => this.applyNewCategory(category),
    });
  }

  private applyNewCategory(category: Category): void {
    this.categories.update((list) =>
      [...list, category].sort((a, b) => a.name.localeCompare(b.name)),
    );
    this.form.get('categoryId')!.setValue(category._id);
    this.showCategoryDialog.set(false);
  }
}
