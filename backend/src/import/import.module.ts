import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ImportController } from './import.controller';
import { ImportService } from './import.service';
import { Product, ProductSchema } from '../products/product.schema';
import { Category, CategorySchema } from '../categories/category.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Product.name, schema: ProductSchema },
      { name: Category.name, schema: CategorySchema },
    ]),
  ],
  controllers: [ImportController],
  providers: [ImportService],
})
export class ImportModule {}
