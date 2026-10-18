import { Category } from './catalog.models';

export interface DashboardSummary {
  todayTotal: number;
  todayCount: number;
  last7DaysTotal: number;
  last7DaysCount: number;
  lowStockCount: number;
}

export interface SalesByDayPoint {
  date: string;
  total: number;
  count: number;
}

export interface TopProduct {
  productId: string;
  name: string;
  qty: number;
  revenue: number;
}

export interface LowStockProduct {
  _id: string;
  name: string;
  categoryId: Category | string;
  stockQty: number;
  unit: string;
}
