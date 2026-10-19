import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Product, ProductDocument } from './product.schema';
import { Category, CategoryDocument } from '../categories/category.schema';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';

@Injectable()
export class ProductsService {
  constructor(
    @InjectModel(Product.name) private productModel: Model<ProductDocument>,
    @InjectModel(Category.name) private categoryModel: Model<CategoryDocument>,
  ) {}

  private async assertCategoryInShop(categoryId: string, shopId: Types.ObjectId) {
    const exists = await this.categoryModel.exists({ _id: categoryId, shopId });
    if (!exists) {
      throw new BadRequestException(`Category ${categoryId} not found`);
    }
  }

  async create(dto: CreateProductDto, shopId: Types.ObjectId) {
    const { categoryId, ...rest } = dto;
    if (categoryId) {
      await this.assertCategoryInShop(categoryId, shopId);
    }
    return this.productModel.create({ ...rest, categoryId: categoryId ?? undefined, shopId });
  }

  findAll(shopId: Types.ObjectId) {
    return this.productModel
      .find({ shopId })
      .populate('categoryId')
      .sort({ name: 1 })
      .exec();
  }

  async findOne(id: string, shopId: Types.ObjectId) {
    const product = await this.productModel.findOne({ _id: id, shopId }).populate('categoryId').exec();
    if (!product) {
      throw new NotFoundException(`Product ${id} not found`);
    }
    return product;
  }

  async update(id: string, dto: UpdateProductDto, shopId: Types.ObjectId) {
    const { categoryId, ...rest } = dto;
    if (categoryId) {
      await this.assertCategoryInShop(categoryId, shopId);
    }

    const setFields: Record<string, unknown> = { ...rest };
    const unsetFields: Record<string, 1> = {};
    if (categoryId === null) {
      unsetFields.categoryId = 1;
    } else if (categoryId !== undefined) {
      setFields.categoryId = categoryId;
    }

    const update: Record<string, unknown> = { $set: setFields };
    if (Object.keys(unsetFields).length > 0) {
      update.$unset = unsetFields;
    }

    const product = await this.productModel
      .findOneAndUpdate({ _id: id, shopId }, update, { new: true })
      .exec();
    if (!product) {
      throw new NotFoundException(`Product ${id} not found`);
    }
    return product;
  }

  async remove(id: string, shopId: Types.ObjectId) {
    const product = await this.productModel.findOneAndDelete({ _id: id, shopId }).exec();
    if (!product) {
      throw new NotFoundException(`Product ${id} not found`);
    }
    return product;
  }

  async adjustStock(id: string, delta: number, shopId: Types.ObjectId) {
    const product = await this.productModel
      .findOneAndUpdate({ _id: id, shopId }, { $inc: { stockQty: delta } }, { new: true })
      .exec();
    if (!product) {
      throw new NotFoundException(`Product ${id} not found`);
    }
    return product;
  }

  async setPhoto(id: string, photoUrl: string | null, shopId: Types.ObjectId) {
    const update = photoUrl ? { $set: { photoUrl } } : { $unset: { photoUrl: 1 } };
    const product = await this.productModel
      .findOneAndUpdate({ _id: id, shopId }, update, { new: true })
      .populate('categoryId')
      .exec();
    if (!product) {
      throw new NotFoundException(`Product ${id} not found`);
    }
    return product;
  }
}
