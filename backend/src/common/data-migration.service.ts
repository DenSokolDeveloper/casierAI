import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, UserDocument } from '../users/user.schema';
import { Product, ProductDocument } from '../products/product.schema';
import { Category, CategoryDocument } from '../categories/category.schema';
import { Transaction, TransactionDocument } from '../transactions/transaction.schema';

// Backfills `shopId` on data created before multi-tenancy existed, and
// reconciles indexes (the old single-field unique index on Category.name
// must become a per-shop compound index). Runs once per boot, after
// UsersService has seeded/ensured the first owner (onApplicationBootstrap
// fires after every module's onModuleInit).
@Injectable()
export class DataMigrationService implements OnApplicationBootstrap {
  private readonly logger = new Logger(DataMigrationService.name);

  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    @InjectModel(Product.name) private readonly productModel: Model<ProductDocument>,
    @InjectModel(Category.name) private readonly categoryModel: Model<CategoryDocument>,
    @InjectModel(Transaction.name) private readonly transactionModel: Model<TransactionDocument>,
  ) {}

  async onApplicationBootstrap() {
    await this.categoryModel.syncIndexes();

    const ownersMissingShopId = await this.userModel
      .find({ role: 'owner', shopId: { $exists: false } })
      .exec();
    for (const owner of ownersMissingShopId) {
      owner.shopId = owner._id;
      await owner.save();
      this.logger.warn(`Backfilled shopId for pre-existing owner ${owner.email}`);
    }

    const fallbackOwner = await this.userModel
      .findOne({ role: 'owner' })
      .sort({ createdAt: 1 })
      .exec();
    if (!fallbackOwner) {
      return;
    }

    // Cashiers created before multi-tenancy also need a shopId - assign
    // them to the earliest owner, the only sensible owner pre-migration.
    await this.userModel
      .updateMany({ shopId: { $exists: false } }, { $set: { shopId: fallbackOwner._id } })
      .exec();

    const [products, categories, transactions] = await Promise.all([
      this.productModel
        .updateMany({ shopId: { $exists: false } }, { $set: { shopId: fallbackOwner._id } })
        .exec(),
      this.categoryModel
        .updateMany({ shopId: { $exists: false } }, { $set: { shopId: fallbackOwner._id } })
        .exec(),
      this.transactionModel
        .updateMany({ shopId: { $exists: false } }, { $set: { shopId: fallbackOwner._id } })
        .exec(),
    ]);

    if (products.modifiedCount || categories.modifiedCount || transactions.modifiedCount) {
      this.logger.warn(
        `Backfilled shopId on pre-existing data: products=${products.modifiedCount}, ` +
          `categories=${categories.modifiedCount}, transactions=${transactions.modifiedCount} ` +
          `(assigned to ${fallbackOwner.email})`,
      );
    }
  }
}
