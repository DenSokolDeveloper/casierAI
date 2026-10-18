import {
  AfterViewInit,
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  ViewChild,
  computed,
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
import { MatTooltipModule } from '@angular/material/tooltip';
import { AuthService } from '../../core/services/auth.service';
import { RecognitionService } from '../../core/services/recognition.service';
import { TransactionsService } from '../../core/services/transactions.service';
import { ProductsService } from '../../core/services/products.service';
import { CartItem, RecognitionCandidate } from '../../core/models/pos.models';
import { Product } from '../../core/models/catalog.models';

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
    MatTooltipModule,
  ],
  templateUrl: './pos.component.html',
  styleUrl: './pos.component.scss',
})
export class PosComponent implements OnInit, AfterViewInit, OnDestroy {
  protected readonly authService = inject(AuthService);
  private readonly recognitionService = inject(RecognitionService);
  private readonly transactionsService = inject(TransactionsService);
  private readonly productsService = inject(ProductsService);

  @ViewChild('video') private readonly videoElementRef?: ElementRef<HTMLVideoElement>;
  @ViewChild('canvas') private readonly canvasElementRef?: ElementRef<HTMLCanvasElement>;

  private mediaStream: MediaStream | null = null;

  protected readonly cameraError = signal<string | null>(null);
  protected readonly isCapturing = signal(false);
  protected readonly candidates = signal<RecognitionCandidate[]>([]);
  protected readonly recognizeMessage = signal<string | null>(null);

  protected readonly pendingWeightItem = signal<RecognitionCandidate | Product | null>(null);
  protected weightInputKg = 0;

  protected readonly manualSearchOpen = signal(false);
  protected manualSearchTerm = '';
  protected readonly allProducts = signal<Product[]>([]);
  protected readonly manualResults = computed(() => {
    const term = this.manualSearchTerm.trim().toLowerCase();
    const products = this.allProducts().filter((product) => product.active);
    if (!term) {
      return products.slice(0, 20);
    }
    return products.filter((product) => product.name.toLowerCase().includes(term)).slice(0, 20);
  });

  protected readonly cart = signal<CartItem[]>([]);
  protected readonly total = computed(() =>
    this.cart().reduce((sum, item) => sum + item.lineTotal, 0),
  );

  protected readonly isCheckingOut = signal(false);
  protected readonly checkoutError = signal<string | null>(null);
  protected readonly lastReceiptTotal = signal<number | null>(null);

  ngOnInit(): void {
    this.productsService.list().subscribe({
      next: (products) => this.allProducts.set(products),
      error: () => {
        // Manual fallback search just won't have data; recognition still works.
      },
    });
  }

  ngAfterViewInit(): void {
    void this.startCamera();
  }

  ngOnDestroy(): void {
    this.stopCamera();
  }

  private async startCamera(): Promise<void> {
    if (!navigator.mediaDevices?.getUserMedia) {
      this.cameraError.set('Камера не поддерживается этим браузером');
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
      this.cameraError.set('Нет доступа к камере — используйте загрузку фото ниже');
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
          this.recognizeMessage.set('Товар не распознан — выберите вручную ниже');
        }
      },
      error: () => {
        this.isCapturing.set(false);
        this.recognizeMessage.set('Ошибка распознавания — выберите товар вручную');
      },
    });
  }

  protected selectCandidate(candidate: RecognitionCandidate): void {
    if (candidate.priceType === 'perWeight') {
      this.weightInputKg = 0;
      this.pendingWeightItem.set(candidate);
      return;
    }
    this.addToCart({
      productId: candidate.productId,
      name: candidate.name,
      priceType: candidate.priceType,
      unitPrice: candidate.price,
      unit: candidate.unit,
      qty: 1,
    });
    this.candidates.set([]);
  }

  protected selectManualProduct(product: Product): void {
    if (product.priceType === 'perWeight') {
      this.weightInputKg = 0;
      this.pendingWeightItem.set(product);
      return;
    }
    this.addToCart({
      productId: product._id,
      name: product.name,
      priceType: product.priceType,
      unitPrice: product.price,
      unit: product.unit,
      qty: 1,
    });
  }

  protected confirmWeight(): void {
    const item = this.pendingWeightItem();
    if (!item || this.weightInputKg <= 0) {
      return;
    }
    const isCandidate = 'confidence' in item;
    this.addToCart({
      productId: isCandidate ? item.productId : item._id,
      name: item.name,
      priceType: 'perWeight',
      unitPrice: item.price,
      unit: isCandidate ? item.unit : item.unit,
      qty: this.weightInputKg,
    });
    this.pendingWeightItem.set(null);
    this.candidates.set([]);
  }

  protected cancelWeight(): void {
    this.pendingWeightItem.set(null);
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
    this.manualSearchOpen.update((open) => !open);
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
        this.checkoutError.set('Не удалось провести продажу. Попробуйте снова.');
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
