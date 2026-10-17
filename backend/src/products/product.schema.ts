import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { Category } from '../categories/category.schema';

export type PriceType = 'fixed' | 'perWeight';

export type ProductDocument = HydratedDocument<Product>;

@Schema({ timestamps: true })
export class Product {
  @Prop({ required: true })
  name: string;

  @Prop({ type: Types.ObjectId, ref: Category.name, required: true })
  categoryId: Types.ObjectId;

  @Prop({ required: true, enum: ['fixed', 'perWeight'], default: 'fixed' })
  priceType: PriceType;

  @Prop({ required: true })
  price: number;

  @Prop({ default: 'pcs' })
  unit: string;

  @Prop({ default: 0 })
  stockQty: number;

  @Prop()
  visualDescription?: string;

  @Prop({ default: true })
  active: boolean;
}

export const ProductSchema = SchemaFactory.createForClass(Product);
