import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Transaction, TransactionDocument } from '../transactions/transaction.schema';
import { Product, ProductDocument } from '../products/product.schema';

const LOW_STOCK_THRESHOLD = 5;

function startOfDay(date: Date): Date {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
}

function daysAgo(days: number): Date {
  const result = startOfDay(new Date());
  result.setDate(result.getDate() - days);
  return result;
}

function dateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

@Injectable()
export class DashboardService {
  constructor(
    @InjectModel(Transaction.name)
    private readonly transactionModel: Model<TransactionDocument>,
    @InjectModel(Product.name) private readonly productModel: Model<ProductDocument>,
  ) {}

  async getSummary() {
    const todayStart = startOfDay(new Date());
    const last7Start = daysAgo(6);

    const [todayAgg, last7Agg, lowStockCount] = await Promise.all([
      this.transactionModel.aggregate([
        { $match: { createdAt: { $gte: todayStart } } },
        { $group: { _id: null, total: { $sum: '$total' }, count: { $sum: 1 } } },
      ]),
      this.transactionModel.aggregate([
        { $match: { createdAt: { $gte: last7Start } } },
        { $group: { _id: null, total: { $sum: '$total' }, count: { $sum: 1 } } },
      ]),
      this.productModel.countDocuments({
        active: true,
        stockQty: { $lt: LOW_STOCK_THRESHOLD },
      }),
    ]);

    return {
      todayTotal: round2(todayAgg[0]?.total ?? 0),
      todayCount: todayAgg[0]?.count ?? 0,
      last7DaysTotal: round2(last7Agg[0]?.total ?? 0),
      last7DaysCount: last7Agg[0]?.count ?? 0,
      lowStockCount,
    };
  }

  async getSalesByDay(days: number) {
    const start = daysAgo(days - 1);

    const rows = await this.transactionModel.aggregate([
      { $match: { createdAt: { $gte: start } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          total: { $sum: '$total' },
          count: { $sum: 1 },
        },
      },
    ]);

    const byDate = new Map(rows.map((row) => [row._id as string, row]));
    const series: Array<{ date: string; total: number; count: number }> = [];
    for (let i = days - 1; i >= 0; i -= 1) {
      const date = daysAgo(i);
      const key = dateKey(date);
      const row = byDate.get(key);
      series.push({ date: key, total: round2(row?.total ?? 0), count: row?.count ?? 0 });
    }
    return series;
  }

  async getTopProducts(days: number, limit: number) {
    const start = daysAgo(days - 1);

    return this.transactionModel.aggregate([
      { $match: { createdAt: { $gte: start } } },
      { $unwind: '$items' },
      {
        $group: {
          _id: '$items.productId',
          name: { $first: '$items.name' },
          qty: { $sum: '$items.qty' },
          revenue: { $sum: '$items.lineTotal' },
        },
      },
      { $sort: { revenue: -1 } },
      { $limit: limit },
      {
        $project: {
          _id: 0,
          productId: '$_id',
          name: 1,
          qty: 1,
          revenue: { $round: ['$revenue', 2] },
        },
      },
    ]);
  }

  getLowStock() {
    return this.productModel
      .find({ active: true, stockQty: { $lt: LOW_STOCK_THRESHOLD } })
      .populate('categoryId')
      .sort({ stockQty: 1 })
      .exec();
  }
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
