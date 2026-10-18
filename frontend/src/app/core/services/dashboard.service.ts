import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  DashboardSummary,
  LowStockProduct,
  SalesByDayPoint,
  TopProduct,
} from '../models/dashboard.models';

@Injectable({ providedIn: 'root' })
export class DashboardService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiBaseUrl}/dashboard`;

  getSummary(): Observable<DashboardSummary> {
    return this.http.get<DashboardSummary>(`${this.baseUrl}/summary`);
  }

  getSalesByDay(days = 7): Observable<SalesByDayPoint[]> {
    return this.http.get<SalesByDayPoint[]>(`${this.baseUrl}/sales-by-day`, {
      params: { days },
    });
  }

  getTopProducts(days = 7, limit = 5): Observable<TopProduct[]> {
    return this.http.get<TopProduct[]>(`${this.baseUrl}/top-products`, {
      params: { days, limit },
    });
  }

  getLowStock(): Observable<LowStockProduct[]> {
    return this.http.get<LowStockProduct[]>(`${this.baseUrl}/low-stock`);
  }
}
