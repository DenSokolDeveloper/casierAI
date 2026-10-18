import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { forkJoin } from 'rxjs';
import { MatCardModule } from '@angular/material/card';
import { MatTableModule } from '@angular/material/table';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { TranslatePipe } from '@ngx-translate/core';
import { DashboardService } from '../../../core/services/dashboard.service';
import {
  DashboardSummary,
  LowStockProduct,
  SalesByDayPoint,
  TopProduct,
} from '../../../core/models/dashboard.models';

@Component({
  selector: 'app-admin-dashboard',
  imports: [
    DecimalPipe,
    MatCardModule,
    MatTableModule,
    MatIconModule,
    MatProgressSpinnerModule,
    TranslatePipe,
  ],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss',
})
export class DashboardComponent implements OnInit {
  private readonly dashboardService = inject(DashboardService);

  protected readonly summary = signal<DashboardSummary | null>(null);
  protected readonly salesByDay = signal<SalesByDayPoint[]>([]);
  protected readonly topProducts = signal<TopProduct[]>([]);
  protected readonly lowStock = signal<LowStockProduct[]>([]);
  protected readonly isLoading = signal(true);
  protected readonly errorMessage = signal<string | null>(null);

  protected readonly maxSalesTotal = computed(() =>
    Math.max(1, ...this.salesByDay().map((point) => point.total)),
  );

  protected readonly topProductColumns = ['name', 'qty', 'revenue'];
  protected readonly lowStockColumns = ['name', 'category', 'stockQty'];

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.isLoading.set(true);
    this.errorMessage.set(null);

    forkJoin({
      summary: this.dashboardService.getSummary(),
      salesByDay: this.dashboardService.getSalesByDay(7),
      topProducts: this.dashboardService.getTopProducts(7, 5),
      lowStock: this.dashboardService.getLowStock(),
    }).subscribe({
      next: (result) => {
        this.summary.set(result.summary);
        this.salesByDay.set(result.salesByDay);
        this.topProducts.set(result.topProducts);
        this.lowStock.set(result.lowStock);
        this.isLoading.set(false);
      },
      error: () => {
        this.isLoading.set(false);
        this.errorMessage.set('admin.dashboard.loadError');
      },
    });
  }

  protected categoryName(product: LowStockProduct): string {
    const category = product.categoryId;
    return typeof category === 'string' ? category : category.name;
  }

  protected formatDay(dateKey: string): string {
    const [, month, day] = dateKey.split('-');
    return `${day}.${month}`;
  }
}
