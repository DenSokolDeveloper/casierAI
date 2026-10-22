import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';
import { Category } from '../categories/category.schema';

export type PriceType = 'fixed' | 'perWeight';

export type ProductDocument = HydratedDocument<Product>;

@Schema({ timestamps: true })
export class Product {
  @Prop({ type: Types.ObjectId, required: true })
  shopId: Types.ObjectId;

  @Prop({ required: true })
  name: string;

  // Internal product code, e.g. printed on a price sheet - shown to the
  // cashier to key into a separate payment/scale terminal.
  @Prop()
  code?: string;

  @Prop({ type: Types.ObjectId, ref: Category.name })
  categoryId?: Types.ObjectId;

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

  // Reference photo as a JPEG data URI, for the admin UI only (not sent to the AI).
  @Prop()
  photoUrl?: string;

  @Prop({ default: true })
  active: boolean;
}

export const ProductSchema = SchemaFactory.createForClass(Product);
