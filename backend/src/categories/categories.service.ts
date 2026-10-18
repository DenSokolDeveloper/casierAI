import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Category, CategoryDocument } from './category.schema';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';

@Injectable()
export class CategoriesService {
  constructor(
    @InjectModel(Category.name) private categoryModel: Model<CategoryDocument>,
  ) {}

  create(dto: CreateCategoryDto, shopId: Types.ObjectId) {
    return this.categoryModel.create({ ...dto, shopId });
  }

  findAll(shopId: Types.ObjectId) {
    return this.categoryModel.find({ shopId }).sort({ name: 1 }).exec();
  }

  async findOne(id: string, shopId: Types.ObjectId) {
    const category = await this.categoryModel.findOne({ _id: id, shopId }).exec();
    if (!category) {
      throw new NotFoundException(`Category ${id} not found`);
    }
    return category;
  }

  async update(id: string, dto: UpdateCategoryDto, shopId: Types.ObjectId) {
    const category = await this.categoryModel
      .findOneAndUpdate({ _id: id, shopId }, dto, { new: true })
      .exec();
    if (!category) {
      throw new NotFoundException(`Category ${id} not found`);
    }
    return category;
  }

  async remove(id: string, shopId: Types.ObjectId) {
    const category = await this.categoryModel.findOneAndDelete({ _id: id, shopId }).exec();
    if (!category) {
      throw new NotFoundException(`Category ${id} not found`);
    }
    return category;
  }

  async setPhoto(id: string, photoUrl: string | null, shopId: Types.ObjectId) {
    const update = photoUrl ? { $set: { photoUrl } } : { $unset: { photoUrl: 1 } };
    const category = await this.categoryModel
      .findOneAndUpdate({ _id: id, shopId }, update, { new: true })
      .exec();
    if (!category) {
      throw new NotFoundException(`Category ${id} not found`);
    }
    return category;
  }
}
