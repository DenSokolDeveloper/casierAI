import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import * as bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';
import { User, UserDocument } from './user.schema';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { RegisterDto } from '../auth/dto/register.dto';

const SALT_ROUNDS = 10;

@Injectable()
export class UsersService implements OnModuleInit {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    private readonly config: ConfigService,
  ) {}

  async onModuleInit() {
    await this.seedOwnerIfNeeded();
  }

  private async seedOwnerIfNeeded() {
    const existingCount = await this.userModel.estimatedDocumentCount();
    if (existingCount > 0) {
      return;
    }

    const email = this.config.get<string>('OWNER_EMAIL', 'owner@casierai.local');
    const configuredPassword = this.config.get<string>('OWNER_PASSWORD');
    const password = configuredPassword ? configuredPassword : randomBytes(9).toString('base64url');

    await this.createShopOwner({
      shopName: 'KassaLens',
      email,
      password,
      name: 'Owner',
    });

    if (!configuredPassword) {
      this.logger.warn(
        `No users found — created initial owner account. email=${email} password=${password} (set OWNER_EMAIL/OWNER_PASSWORD env vars to control this)`,
      );
    } else {
      this.logger.log(`Created initial owner account: ${email}`);
    }
  }

  // Self-registration: creates a brand-new, independent shop with this
  // person as its owner. shopId is the new user's own _id.
  async createShopOwner(dto: RegisterDto) {
    const existing = await this.userModel.findOne({ email: dto.email }).exec();
    if (existing) {
      throw new ConflictException(`User with email ${dto.email} already exists`);
    }
    const passwordHash = await bcrypt.hash(dto.password, SALT_ROUNDS);
    const _id = new Types.ObjectId();
    return this.userModel.create({
      _id,
      email: dto.email,
      passwordHash,
      name: dto.name,
      role: 'owner',
      shopId: _id,
      shopName: dto.shopName,
    });
  }

  // Adds a teammate (cashier or co-owner) to the caller's existing shop.
  async create(dto: CreateUserDto, shopId: Types.ObjectId) {
    const existing = await this.userModel.findOne({ email: dto.email }).exec();
    if (existing) {
      throw new ConflictException(`User with email ${dto.email} already exists`);
    }
    const passwordHash = await bcrypt.hash(dto.password, SALT_ROUNDS);
    return this.userModel.create({
      email: dto.email,
      passwordHash,
      name: dto.name,
      role: dto.role,
      shopId,
    });
  }

  findAll(shopId: Types.ObjectId) {
    return this.userModel.find({ shopId }).select('-passwordHash').exec();
  }

  findByEmail(email: string) {
    return this.userModel.findOne({ email: email.toLowerCase().trim() }).exec();
  }

  async findOne(id: string, shopId: Types.ObjectId) {
    const user = await this.userModel.findOne({ _id: id, shopId }).select('-passwordHash').exec();
    if (!user) {
      throw new NotFoundException(`User ${id} not found`);
    }
    return user;
  }

  async update(id: string, dto: UpdateUserDto, shopId: Types.ObjectId) {
    if (dto.email) {
      const existing = await this.userModel
        .findOne({ email: dto.email, _id: { $ne: id } })
        .exec();
      if (existing) {
        throw new ConflictException(`User with email ${dto.email} already exists`);
      }
    }

    const update: Record<string, unknown> = {};
    if (dto.name !== undefined) {
      update.name = dto.name;
    }
    if (dto.email !== undefined) {
      update.email = dto.email;
    }
    if (dto.role !== undefined) {
      update.role = dto.role;
    }
    if (dto.password) {
      update.passwordHash = await bcrypt.hash(dto.password, SALT_ROUNDS);
    }

    const user = await this.userModel
      .findOneAndUpdate({ _id: id, shopId }, { $set: update }, { new: true })
      .select('-passwordHash')
      .exec();
    if (!user) {
      throw new NotFoundException(`User ${id} not found`);
    }
    return user;
  }

  async remove(id: string, shopId: Types.ObjectId) {
    const user = await this.userModel.findOneAndDelete({ _id: id, shopId }).exec();
    if (!user) {
      throw new NotFoundException(`User ${id} not found`);
    }
    return user;
  }
}
