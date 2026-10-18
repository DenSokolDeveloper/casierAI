import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Connection, Model, Types } from 'mongoose';
import { Product, ProductDocument } from '../products/product.schema';
import { StockMovement, StockMovementDocument } from './stock-movement.schema';
import {
  Transaction,
  TransactionDocument,
  TransactionItem,
} from './transaction.schema';
import { CreateTransactionDto } from './dto/create-transaction.dto';

const round2 = (value: number) => Math.round(value * 100) / 100;

@Injectable()
export class TransactionsService {
  constructor(
    @InjectModel(Transaction.name)
    private readonly transactionModel: Model<TransactionDocument>,
    @InjectModel(StockMovement.name)
    private readonly stockMovementModel: Model<StockMovementDocument>,
    @InjectModel(Product.name)
    private readonly productModel: Model<ProductDocument>,
    @InjectConnection() private readonly connection: Connection,
  ) {}

  async create(dto: CreateTransactionDto, cashierId: string, shopId: Types.ObjectId) {
    if (dto.items.length === 0) {
      throw new BadRequestException('Transaction must contain at least one item');
    }

    const session = await this.connection.startSession();
    try {
      let createdTransaction!: TransactionDocument;

      await session.withTransaction(async () => {
        const lineItems: TransactionItem[] = [];
        let total = 0;

        for (const item of dto.items) {
          const product = await this.productModel
            .findOne({ _id: item.productId, shopId })
            .session(session)
            .exec();
          if (!product || !product.active) {
            throw new NotFoundException(`Product ${item.productId} not found`);
          }

          const lineTotal = round2(product.price * item.qty);
          lineItems.push({
            productId: product._id,
            name: product.name,
            unit: product.unit,
            qty: item.qty,
            unitPrice: product.price,
            lineTotal,
          });
          total += lineTotal;
        }

        const [transaction] = await this.transactionModel.create(
          [{ items: lineItems, total: round2(total), cashierId, shopId }],
          { session },
        );

        for (const item of lineItems) {
          await this.productModel
            .updateOne(
              { _id: item.productId, shopId },
              { $inc: { stockQty: -item.qty } },
              { session },
            )
            .exec();

          await this.stockMovementModel.create(
            [
              {
                shopId,
                productId: item.productId,
                delta: -item.qty,
                transactionId: transaction._id,
              },
            ],
            { session },
          );
        }

        createdTransaction = transaction;
      });

      return createdTransaction;
    } finally {
      await session.endSession();
    }
  }

  findAll(shopId: Types.ObjectId) {
    return this.transactionModel
      .find({ shopId })
      .populate('cashierId', 'name email')
      .sort({ createdAt: -1 })
      .exec();
  }

  async findOne(id: string, shopId: Types.ObjectId) {
    const transaction = await this.transactionModel
      .findOne({ _id: id, shopId })
      .populate('cashierId', 'name email')
      .exec();
    if (!transaction) {
      throw new NotFoundException(`Transaction ${id} not found`);
    }
    return transaction;
  }
}
