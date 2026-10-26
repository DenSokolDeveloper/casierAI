import { Component, OnInit, ViewChild, inject, signal } from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { SelectionModel } from '@angular/cdk/collections';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatTableModule, MatTableDataSource } from '@angular/material/table';
import { MatSort, MatSortModule, Sort } from '@angular/material/sort';
import { MatPaginator, MatPaginatorIntl, MatPaginatorModule } from '@angular/material/paginator';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { DatePipe } from '@angular/common';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { ProductsService } from '../../../core/services/products.service';
import { CategoriesService } from '../../../core/services/categories.service';
import { Category, PriceType, Product } from '../../../core/models/catalog.models';
import { downloadCsv } from '../../../core/utils/csv.util';
import { UnitLabelPipe } from '../../../core/pipes/unit-label.pipe';
import { TranslatedPaginatorIntl } from '../../../core/services/translated-paginator-intl.service';

@Component({
  selector: 'app-admin-products',
  imports: [
    FormsModule,
    ReactiveFormsModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule,
    MatCheckboxModule,
    MatSlideToggleModule,
    MatTableModule,
    MatSortModule,
    MatPaginatorModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
    DatePipe,
    TranslatePipe,
    UnitLabelPipe,
  ],
  providers: [{ provide: MatPaginatorIntl, useClass: TranslatedPaginatorIntl }],
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
  protected readonly showDialog = signal(false);
  protected readonly searchTerm = signal('');

  protected readonly displayedColumns = [
    'select',
    'photo',
    'name',
    'code',
    'category',
    'price',
    'stock',
    'createdAt',
    'active',
    'actions',
  ];
  protected readonly dataSource = new MatTableDataSource<Product>([]);
  protected readonly selection = new SelectionModel<string>(true, []);

  // A plain method, not computed(): the underlying SelectionModel and
  // MatTableDataSource are not signals, so computed() would never see a
  // dependency change and the result would cache stale forever. A method
  // call is re-evaluated on every change-detection pass instead.
  protected allSelected(): boolean {
    const visible = this.dataSource.filteredData;
    return visible.length > 0 && visible.every((product) => this.selection.isSelected(product._id));
  }

  protected readonly form = this.fb.group({
    name: ['', Validators.required],
    code: [''],
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

  @ViewChild(MatPaginator) set paginator(value: MatPaginator) {
    this.dataSource.paginator = value ?? null;
  }

  @ViewChild(MatSort) set sort(value: MatSort) {
    this.dataSource.sort = value ?? null;
  }

  constructor() {
    this.dataSource.filterPredicate = (product, filter) => {
      const name = product.name.toLowerCase();
      const code = (product.code ?? '').toLowerCase();
      return name.includes(filter) || code.includes(filter);
    };
    this.dataSource.sortingDataAccessor = (product, sortHeaderId) => {
      switch (sortHeaderId) {
        case 'category':
          return this.categoryName(product).toLowerCase();
        case 'name':
        case 'code':
          return (sortHeaderId === 'name' ? product.name : product.code ?? '').toLowerCase();
        case 'price':
          return product.price;
        case 'stock':
          return product.stockQty;
        case 'createdAt':
          return product.createdAt;
        default:
          return '';
      }
    };
  }

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

  protected onSearchChange(term: string): void {
    this.searchTerm.set(term);
    this.dataSource.filter = term.trim().toLowerCase();
    if (this.dataSource.paginator) {
      this.dataSource.paginator.firstPage();
    }
  }

  protected sortData(sort: Sort): void {
    void sort;
    if (this.dataSource.paginator) {
      this.dataSource.paginator.firstPage();
    }
  }

  load(): void {
    this.isLoading.set(true);
    this.productsService.list().subscribe({
      next: (products) => {
        this.products.set(products);
        this.dataSource.data = products;
        this.selection.clear();
        this.isLoading.set(false);
      },
      error: () => {
        this.errorMessage.set('admin.products.loadError');
        this.isLoading.set(false);
      },
    });
  }

  protected toggleAll(): void {
    if (this.allSelected()) {
      this.dataSource.filteredData.forEach((product) => this.selection.deselect(product._id));
    } else {
      this.dataSource.filteredData.forEach((product) => this.selection.select(product._id));
    }
  }

  protected toggleOne(productId: string): void {
    this.selection.toggle(productId);
  }

  protected deleteSelected(): void {
    const ids = this.selection.selected;
    if (ids.length === 0) {
      return;
    }
    const confirmMessage = this.translate.instant('admin.products.confirmDeleteSelected', {
      count: ids.length,
    });
    if (!confirm(confirmMessage)) {
      return;
    }
    this.errorMessage.set(null);
    let remaining = ids.length;
    let hadError = false;
    ids.forEach((id) => {
      this.productsService.remove(id).subscribe({
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
      this.errorMessage.set('admin.products.deleteError');
    }
    this.load();
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
      code: '',
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
    this.errorMessage.set(null);
    this.showDialog.set(true);
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
      code: product.code ?? '',
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
    this.errorMessage.set(null);
    this.showDialog.set(true);
  }

  cancelEdit(): void {
    this.editingId.set(null);
    this.showDialog.set(false);
    this.startCreateFormOnly();
  }

  private startCreateFormOnly(): void {
    this.form.reset({
      name: '',
      code: '',
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
      code: raw.code || undefined,
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
      'Code',
      'Category',
      'Price type',
      'Price',
      'Unit',
      'Stock',
      'Active',
    ];
    const rows = this.products().map((product) => [
      product.name,
      product.code ?? '',
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
