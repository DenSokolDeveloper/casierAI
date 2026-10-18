import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Transaction, TransactionDocument } from '../transactions/transaction.schema';
import { Product, ProductDocument } from '../products/product.schema';

const LOW_STOCK_THRESHOLD = 5;

// All day boundaries are computed in UTC so they line up with Mongo's
// $dateToString (which groups in UTC by default) regardless of the
// server's local timezone.
function startOfUTCDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function daysAgo(days: number): Date {
  const result = startOfUTCDay(new Date());
  result.setUTCDate(result.getUTCDate() - days);
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

  async getSummary(shopId: Types.ObjectId) {
    const todayStart = daysAgo(0);
    const last7Start = daysAgo(6);

    const [todayAgg, last7Agg, lowStockCount] = await Promise.all([
      this.transactionModel.aggregate([
        { $match: { shopId, createdAt: { $gte: todayStart } } },
        { $group: { _id: null, total: { $sum: '$total' }, count: { $sum: 1 } } },
      ]),
      this.transactionModel.aggregate([
        { $match: { shopId, createdAt: { $gte: last7Start } } },
        { $group: { _id: null, total: { $sum: '$total' }, count: { $sum: 1 } } },
      ]),
      this.productModel.countDocuments({
        shopId,
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

  async getSalesByDay(days: number, shopId: Types.ObjectId) {
    const start = daysAgo(days - 1);

    const rows = await this.transactionModel.aggregate([
      { $match: { shopId, createdAt: { $gte: start } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: 'UTC' } },
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

  async getTopProducts(days: number, limit: number, shopId: Types.ObjectId) {
    const start = daysAgo(days - 1);

    return this.transactionModel.aggregate([
      { $match: { shopId, createdAt: { $gte: start } } },
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

  getLowStock(shopId: Types.ObjectId) {
    return this.productModel
      .find({ shopId, active: true, stockQty: { $lt: LOW_STOCK_THRESHOLD } })
      .populate('categoryId')
      .sort({ stockQty: 1 })
      .exec();
  }
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
