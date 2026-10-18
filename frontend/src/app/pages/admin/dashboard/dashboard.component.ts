import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { forkJoin } from 'rxjs';
import { DashboardService } from '../../../core/services/dashboard.service';
import {
  DashboardSummary,
  LowStockProduct,
  SalesByDayPoint,
  TopProduct,
} from '../../../core/models/dashboard.models';

@Component({
  selector: 'app-admin-dashboard',
  imports: [DecimalPipe],
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
        this.errorMessage.set('Не удалось загрузить дешборд');
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
