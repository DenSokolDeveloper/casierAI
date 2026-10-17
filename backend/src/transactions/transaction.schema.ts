import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { Product } from '../products/product.schema';
import { User } from '../users/user.schema';

export type TransactionDocument = HydratedDocument<Transaction>;

@Schema({ _id: false })
export class TransactionItem {
  @Prop({ type: Types.ObjectId, ref: Product.name, required: true })
  productId: Types.ObjectId;

  @Prop({ required: true })
  name: string;

  @Prop({ required: true })
  unit: string;

  @Prop({ required: true })
  qty: number;

  @Prop({ required: true })
  unitPrice: number;

  @Prop({ required: true })
  lineTotal: number;
}

export const TransactionItemSchema = SchemaFactory.createForClass(TransactionItem);

@Schema({ timestamps: true })
export class Transaction {
  @Prop({ type: [TransactionItemSchema], required: true })
  items: TransactionItem[];

  @Prop({ required: true })
  total: number;

  @Prop({ type: Types.ObjectId, ref: User.name, required: true })
  cashierId: Types.ObjectId;
}

export const TransactionSchema = SchemaFactory.createForClass(Transaction);
