import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type UserRole = 'owner' | 'cashier';

export type UserDocument = HydratedDocument<User>;

@Schema({ timestamps: true })
export class User {
  @Prop({ required: true, unique: true, lowercase: true, trim: true })
  email: string;

  @Prop({ required: true })
  passwordHash: string;

  @Prop({ required: true })
  name: string;

  @Prop({ required: true, enum: ['owner', 'cashier'], default: 'cashier' })
  role: UserRole;

  // Tenant identifier: equal to the owning owner's own _id. Every User,
  // Product, Category and Transaction carries this so one shop's data
  // never shows up in another shop's queries.
  @Prop({ type: Types.ObjectId, required: true })
  shopId: Types.ObjectId;

  // Only meaningful on an owner's own record - set at registration.
  @Prop()
  shopName?: string;

  @Prop({ default: true })
  active: boolean;
}

export const UserSchema = SchemaFactory.createForClass(User);
