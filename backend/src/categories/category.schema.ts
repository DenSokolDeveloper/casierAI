import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type CategoryDocument = HydratedDocument<Category>;

@Schema({ timestamps: true })
export class Category {
  @Prop({ type: Types.ObjectId, required: true })
  shopId: Types.ObjectId;

  @Prop({ required: true, trim: true })
  name: string;

  @Prop()
  description?: string;

  @Prop()
  photoUrl?: string;

  @Prop({ default: true })
  active: boolean;
}

export const CategorySchema = SchemaFactory.createForClass(Category);
CategorySchema.index({ shopId: 1, name: 1 }, { unique: true });
