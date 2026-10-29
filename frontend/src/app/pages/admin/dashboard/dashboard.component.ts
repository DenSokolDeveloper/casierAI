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
import { UnitLabelPipe } from '../../../core/pipes/unit-label.pipe';

type PeriodId = 7 | 14 | 30 | 90 | 'month' | 'all';

@Component({
  selector: 'app-admin-dashboard',
  imports: [
    DecimalPipe,
    MatCardModule,
    MatTableModule,
    MatIconModule,
    MatProgressSpinnerModule,
    TranslatePipe,
    UnitLabelPipe,
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

  protected static readonly PERIOD_OPTIONS: PeriodId[] = [7, 14, 30, 90, 'month', 'all'];
  protected readonly periodOptions = DashboardComponent.PERIOD_OPTIONS;
  protected readonly selectedPeriod = signal<PeriodId>(7);

  ngOnInit(): void {
    this.load();
  }

  selectPeriod(period: PeriodId): void {
    if (period === this.selectedPeriod()) {
      return;
    }
    this.selectedPeriod.set(period);
    this.loadPeriod();
  }

  // 'month' resolves to "day-of-month" days back, which lands exactly on
  // the 1st - the existing trailing-window endpoints need no change for
  // it. 'all' has no fixed window, so it passes null (no date filter).
  private resolveDays(period: PeriodId): number | null {
    if (period === 'all') {
      return null;
    }
    if (period === 'month') {
      return new Date().getDate();
    }
    return period;
  }

  protected isNumericPeriod(period: PeriodId): period is 7 | 14 | 30 | 90 {
    return typeof period === 'number';
  }

  protected periodLabelKey(period: PeriodId): string {
    if (period === 'all') {
      return 'admin.dashboard.periodAll';
    }
    if (period === 'month') {
      return 'admin.dashboard.periodMonth';
    }
    return 'admin.dashboard.periodDays';
  }

  protected periodLabelParams(period: PeriodId): { days: number } | Record<string, never> {
    return this.isNumericPeriod(period) ? { days: period } : {};
  }

  protected chartTitleKey(): string {
    const period = this.selectedPeriod();
    if (period === 'all') {
      return 'admin.dashboard.salesChartTitleAll';
    }
    if (period === 'month') {
      return 'admin.dashboard.salesChartTitleMonth';
    }
    return 'admin.dashboard.salesChartTitle';
  }

  protected topProductsTitleKey(): string {
    const period = this.selectedPeriod();
    if (period === 'all') {
      return 'admin.dashboard.topProductsTitleAll';
    }
    if (period === 'month') {
      return 'admin.dashboard.topProductsTitleMonth';
    }
    return 'admin.dashboard.topProductsTitle';
  }

  load(): void {
    this.isLoading.set(true);
    this.errorMessage.set(null);
    const days = this.resolveDays(this.selectedPeriod());

    forkJoin({
      summary: this.dashboardService.getSummary(),
      salesByDay: this.dashboardService.getSalesByDay(days),
      topProducts: this.dashboardService.getTopProducts(days, 5),
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

  private loadPeriod(): void {
    this.isLoading.set(true);
    this.errorMessage.set(null);
    const days = this.resolveDays(this.selectedPeriod());

    forkJoin({
      salesByDay: this.dashboardService.getSalesByDay(days),
      topProducts: this.dashboardService.getTopProducts(days, 5),
    }).subscribe({
      next: (result) => {
        this.salesByDay.set(result.salesByDay);
        this.topProducts.set(result.topProducts);
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
    if (!category) {
      return '—';
    }
    return typeof category === 'string' ? category : category.name;
  }

  protected formatDay(dateKey: string): string {
    const [, month, day] = dateKey.split('-');
    return `${day}.${month}`;
  }
}
