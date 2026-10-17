import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { Product } from '../products/product.schema';
import { Transaction } from './transaction.schema';

export type StockMovementDocument = HydratedDocument<StockMovement>;

@Schema({ timestamps: true })
export class StockMovement {
  @Prop({ type: Types.ObjectId, ref: Product.name, required: true })
  productId: Types.ObjectId;

  // Negative for a sale/write-off, positive for a restock.
  @Prop({ required: true })
  delta: number;

  @Prop({ type: Types.ObjectId, ref: Transaction.name })
  transactionId?: Types.ObjectId;
}

export const StockMovementSchema = SchemaFactory.createForClass(StockMovement);
