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
    categoryId: ['', Validators.required],
    priceType: ['fixed' as PriceType, Validators.required],
    price: [0, [Validators.required, Validators.min(0)]],
    unit: ['pcs'],
    stockQty: [0, [Validators.min(0)]],
    visualDescription: [''],
    active: [true],
  });

  ngOnInit(): void {
    this.categoriesService.list().subscribe({
      next: (categories) => this.categories.set(categories),
      error: () => this.errorMessage.set('admin.products.loadCategoriesError'),
    });
    this.load();
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
    return typeof category === 'string' ? category : category.name;
  }

  startCreate(): void {
    this.editingId.set(null);
    this.form.reset({
      name: '',
      categoryId: this.categories()[0]?._id ?? '',
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
    const categoryId =
      typeof product.categoryId === 'string' ? product.categoryId : product.categoryId._id;
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
      categoryId: raw.categoryId!,
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
}
