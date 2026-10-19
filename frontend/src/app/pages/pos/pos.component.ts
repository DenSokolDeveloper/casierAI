import {
  AfterViewInit,
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  ViewChild,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DecimalPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatListModule } from '@angular/material/list';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { AuthService } from '../../core/services/auth.service';
import { RecognitionService } from '../../core/services/recognition.service';
import { TransactionsService } from '../../core/services/transactions.service';
import { ProductsService } from '../../core/services/products.service';
import { CategoriesService } from '../../core/services/categories.service';
import { PwaInstallService } from '../../core/services/pwa-install.service';
import { CartItem, RecognitionCandidate } from '../../core/models/pos.models';
import { Category, Product } from '../../core/models/catalog.models';
import { LanguageSwitcherComponent } from '../../shared/language-switcher/language-switcher.component';

@Component({
  selector: 'app-pos',
  imports: [
    FormsModule,
    RouterLink,
    DecimalPipe,
    MatToolbarModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatListModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
    MatTooltipModule,
    TranslatePipe,
    LanguageSwitcherComponent,
  ],
  templateUrl: './pos.component.html',
  styleUrl: './pos.component.scss',
})
export class PosComponent implements OnInit, AfterViewInit, OnDestroy {
  protected readonly authService = inject(AuthService);
  private readonly recognitionService = inject(RecognitionService);
  private readonly transactionsService = inject(TransactionsService);
  private readonly productsService = inject(ProductsService);
  private readonly categoriesService = inject(CategoriesService);
  protected readonly pwaInstall = inject(PwaInstallService);
  private readonly snackBar = inject(MatSnackBar);
  private readonly translate = inject(TranslateService);

  @ViewChild('video') private readonly videoElementRef?: ElementRef<HTMLVideoElement>;
  @ViewChild('canvas') private readonly canvasElementRef?: ElementRef<HTMLCanvasElement>;

  private mediaStream: MediaStream | null = null;

  protected readonly cameraError = signal<string | null>(null);
  protected readonly isCapturing = signal(false);
  protected readonly candidates = signal<RecognitionCandidate[]>([]);
  protected readonly recognizeMessage = signal<string | null>(null);

  protected readonly pendingCartItem = signal<RecognitionCandidate | Product | null>(null);
  protected weightDisplayValue: number | null = null;
  protected readonly weightUnitFactor = signal(1);
  protected fixedQty = 1;

  protected readonly showInstallPrompt = signal(false);

  private static readonly KILOGRAM_UNIT_NAMES = [
    'kg',
    'kgs',
    'kilogram',
    'kilograms',
    'кг',
    'кг.',
    'килограмм',
    'килограммы',
    'kilogram',
    'kilogramy',
  ];

  private static readonly LITER_UNIT_NAMES = [
    'l',
    'liter',
    'liters',
    'litre',
    'litres',
    'л',
    'л.',
    'литр',
    'литры',
    'litr',
  ];

  protected readonly manualSearchOpen = signal(false);
  protected readonly manualSearchTerm = signal('');
  protected readonly selectedCategoryId = signal<string | null>(null);
  protected readonly allProducts = signal<Product[]>([]);
  protected readonly allCategories = signal<Category[]>([]);

  protected readonly manualCategories = computed(() => {
    const idsWithProducts = new Set(
      this.allProducts()
        .filter((product) => product.active)
        .map((product) => this.categoryIdOf(product))
        .filter((id): id is string => !!id),
    );
    return this.allCategories()
      .filter((category) => idsWithProducts.has(category._id))
      .sort((a, b) => a.name.localeCompare(b.name));
  });

  protected readonly manualResults = computed(() => {
    const term = this.manualSearchTerm().trim().toLowerCase();
    const products = this.allProducts().filter((product) => product.active);
    if (term) {
      // Typing always searches every product, regardless of category.
      return products.filter((product) => product.name.toLowerCase().includes(term)).slice(0, 30);
    }
    const categoryId = this.selectedCategoryId();
    if (!categoryId) {
      return [];
    }
    return products.filter((product) => this.categoryIdOf(product) === categoryId);
  });

  private categoryIdOf(product: Product): string | null {
    const category = product.categoryId;
    if (!category) {
      return null;
    }
    return typeof category === 'string' ? category : category._id;
  }

  protected readonly cart = signal<CartItem[]>([]);
  protected readonly total = computed(() =>
    this.cart().reduce((sum, item) => sum + item.lineTotal, 0),
  );

  protected readonly isCheckingOut = signal(false);
  protected readonly checkoutError = signal<string | null>(null);
  protected readonly lastReceiptTotal = signal<number | null>(null);

  constructor() {
    effect(() => {
      if (
        this.pwaInstall.canInstall() &&
        !this.pwaInstall.isStandalone() &&
        !this.pwaInstall.isDismissed()
      ) {
        this.showInstallPrompt.set(true);
      }
    });
  }

  ngOnInit(): void {
    this.productsService.list().subscribe({
      next: (products) => this.allProducts.set(products),
      error: () => {
        // Manual fallback search just won't have data; recognition still works.
      },
    });
    this.categoriesService.list().subscribe({
      next: (categories) => this.allCategories.set(categories),
      error: () => {
        // Category browsing just won't be available; search by name still works.
      },
    });
  }

  protected installApp(): void {
    void this.pwaInstall.promptInstall();
    this.showInstallPrompt.set(false);
  }

  protected dismissInstallPrompt(): void {
    this.pwaInstall.dismiss();
    this.showInstallPrompt.set(false);
  }

  ngAfterViewInit(): void {
    void this.startCamera();
  }

  ngOnDestroy(): void {
    this.stopCamera();
  }

  private async startCamera(): Promise<void> {
    if (!navigator.mediaDevices?.getUserMedia) {
      this.cameraError.set('pos.cameraUnsupported');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
        audio: false,
      });
      this.mediaStream = stream;
      this.cameraError.set(null);
      const video = this.videoElementRef?.nativeElement;
      if (video) {
        video.srcObject = stream;
        await video.play().catch(() => undefined);
      }
    } catch {
      this.cameraError.set('pos.cameraError');
    }
  }

  private stopCamera(): void {
    this.mediaStream?.getTracks().forEach((track) => track.stop());
    this.mediaStream = null;
  }

  protected capturePhoto(): void {
    const video = this.videoElementRef?.nativeElement;
    const canvas = this.canvasElementRef?.nativeElement;
    if (!video || !canvas || video.readyState < 2) {
      return;
    }
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const context = canvas.getContext('2d');
    if (!context) {
      return;
    }
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(
      (blob) => {
        if (blob) {
          this.recognize(blob);
        }
      },
      'image/jpeg',
      0.85,
    );
  }

  protected onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) {
      this.recognize(file);
    }
    input.value = '';
  }

  private recognize(photo: Blob): void {
    this.isCapturing.set(true);
    this.recognizeMessage.set(null);
    this.candidates.set([]);

    this.recognitionService.recognize(photo).subscribe({
      next: ({ candidates }) => {
        this.isCapturing.set(false);
        this.candidates.set(candidates);
        if (candidates.length === 0) {
          this.recognizeMessage.set('pos.recognizeNoMatch');
        }
      },
      error: () => {
        this.isCapturing.set(false);
        this.recognizeMessage.set('pos.recognizeError');
      },
    });
  }

  protected selectCandidate(candidate: RecognitionCandidate): void {
    this.openCartDialog(candidate);
  }

  protected selectManualProduct(product: Product): void {
    this.openCartDialog(product);
  }

  private openCartDialog(item: RecognitionCandidate | Product): void {
    this.weightDisplayValue = null;
    this.weightUnitFactor.set(1);
    this.fixedQty = 1;
    this.pendingCartItem.set(item);
  }

  protected confirmCartItem(): void {
    const item = this.pendingCartItem();
    if (!item) {
      return;
    }
    const isWeight = item.priceType === 'perWeight';
    let qty: number;
    if (isWeight) {
      if (!this.weightDisplayValue || this.weightDisplayValue <= 0) {
        return;
      }
      qty = round3(this.weightDisplayValue / this.weightUnitFactor());
    } else {
      if (this.fixedQty <= 0) {
        return;
      }
      qty = this.fixedQty;
    }

    const isCandidate = 'confidence' in item;
    this.addToCart({
      productId: isCandidate ? item.productId : item._id,
      name: item.name,
      priceType: item.priceType,
      unitPrice: item.price,
      unit: item.unit,
      qty,
    });
    this.pendingCartItem.set(null);
    this.candidates.set([]);
    this.showAddedSnackbar(item.name, qty, item.unit, isWeight);
  }

  protected cancelCartItem(): void {
    this.pendingCartItem.set(null);
  }

  protected incrementFixedQty(): void {
    this.fixedQty = Math.min(999, this.fixedQty + 1);
  }

  protected decrementFixedQty(): void {
    this.fixedQty = Math.max(1, this.fixedQty - 1);
  }

  private showAddedSnackbar(name: string, qty: number, unit: string, isWeight: boolean): void {
    const qtyText = isWeight ? `${qty} ${unit}` : `×${qty}`;
    const message = this.translate.instant('pos.addedToCart', { name, qty: qtyText });
    this.snackBar.open(message, undefined, { duration: 2000 });
  }

  protected hasSubUnit(unit: string): boolean {
    return this.isKilogramUnit(unit) || this.isLiterUnit(unit);
  }

  protected subUnitLabelKey(unit: string): string {
    return this.isKilogramUnit(unit) ? 'pos.gram' : 'pos.milliliter';
  }

  protected setWeightUnitFactor(factor: number): void {
    const current = this.weightUnitFactor();
    if (current === factor) {
      return;
    }
    if (this.weightDisplayValue !== null) {
      const baseQty = this.weightDisplayValue / current;
      this.weightDisplayValue = round3(baseQty * factor);
    }
    this.weightUnitFactor.set(factor);
  }

  private isKilogramUnit(unit: string): boolean {
    return PosComponent.KILOGRAM_UNIT_NAMES.includes(unit.trim().toLowerCase());
  }

  private isLiterUnit(unit: string): boolean {
    return PosComponent.LITER_UNIT_NAMES.includes(unit.trim().toLowerCase());
  }

  private addToCart(entry: {
    productId: string;
    name: string;
    priceType: CartItem['priceType'];
    unitPrice: number;
    unit: string;
    qty: number;
  }): void {
    this.cart.update((items) => {
      if (entry.priceType === 'fixed') {
        const existingIndex = items.findIndex((item) => item.productId === entry.productId);
        if (existingIndex !== -1) {
          const updated = [...items];
          const existing = updated[existingIndex];
          const qty = existing.qty + entry.qty;
          updated[existingIndex] = { ...existing, qty, lineTotal: round2(qty * existing.unitPrice) };
          return updated;
        }
      }
      return [
        ...items,
        {
          productId: entry.productId,
          name: entry.name,
          priceType: entry.priceType,
          unitPrice: entry.unitPrice,
          unit: entry.unit,
          qty: entry.qty,
          lineTotal: round2(entry.qty * entry.unitPrice),
        },
      ];
    });
  }

  protected changeQty(index: number, delta: number): void {
    this.cart.update((items) => {
      const updated = [...items];
      const item = updated[index];
      const qty = Math.max(0, round2(item.qty + delta));
      if (qty === 0) {
        updated.splice(index, 1);
        return updated;
      }
      updated[index] = { ...item, qty, lineTotal: round2(qty * item.unitPrice) };
      return updated;
    });
  }

  protected removeItem(index: number): void {
    this.cart.update((items) => items.filter((_, i) => i !== index));
  }

  protected toggleManualSearch(): void {
    const next = !this.manualSearchOpen();
    this.manualSearchOpen.set(next);
    if (!next) {
      this.manualSearchTerm.set('');
      this.selectedCategoryId.set(null);
    }
  }

  protected selectManualCategory(categoryId: string): void {
    this.selectedCategoryId.set(categoryId);
  }

  protected backToCategories(): void {
    this.selectedCategoryId.set(null);
  }

  protected checkout(): void {
    if (this.cart().length === 0 || this.isCheckingOut()) {
      return;
    }
    this.isCheckingOut.set(true);
    this.checkoutError.set(null);

    const items = this.cart().map((item) => ({ productId: item.productId, qty: item.qty }));
    this.transactionsService.create(items).subscribe({
      next: (transaction) => {
        this.isCheckingOut.set(false);
        this.lastReceiptTotal.set(transaction.total);
        this.cart.set([]);
        this.candidates.set([]);
      },
      error: () => {
        this.isCheckingOut.set(false);
        this.checkoutError.set('pos.checkoutError');
      },
    });
  }

  protected dismissReceipt(): void {
    this.lastReceiptTotal.set(null);
  }
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function round3(value: number): number {
  return Math.round(value * 1000) / 1000;
}
