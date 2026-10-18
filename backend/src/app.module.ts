import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ProductsModule } from './products/products.module';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { CategoriesModule } from './categories/categories.module';
import { TransactionsModule } from './transactions/transactions.module';
import { RecognitionModule } from './recognition/recognition.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { ImportModule } from './import/import.module';
import { User, UserSchema } from './users/user.schema';
import { Product, ProductSchema } from './products/product.schema';
import { Category, CategorySchema } from './categories/category.schema';
import { Transaction, TransactionSchema } from './transactions/transaction.schema';
import { DataMigrationService } from './common/data-migration.service';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        uri: config.get<string>('MONGO_URI', 'mongodb://localhost:27017/casierai'),
      }),
    }),
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: Product.name, schema: ProductSchema },
      { name: Category.name, schema: CategorySchema },
      { name: Transaction.name, schema: TransactionSchema },
    ]),
    ProductsModule,
    UsersModule,
    AuthModule,
    CategoriesModule,
    TransactionsModule,
    RecognitionModule,
    DashboardModule,
    ImportModule,
  ],
  controllers: [AppController],
  providers: [AppService, DataMigrationService],
})
export class AppModule {}
