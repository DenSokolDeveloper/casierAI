import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';
import { User, UserDocument } from './user.schema';
import { CreateUserDto } from './dto/create-user.dto';

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
    const password = configuredPassword ?? randomBytes(9).toString('base64url');

    await this.create({
      email,
      password,
      name: 'Owner',
      role: 'owner',
    });

    if (!configuredPassword) {
      this.logger.warn(
        `No users found — created initial owner account. email=${email} password=${password} (set OWNER_EMAIL/OWNER_PASSWORD env vars to control this)`,
      );
    } else {
      this.logger.log(`Created initial owner account: ${email}`);
    }
  }

  async create(dto: CreateUserDto) {
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
    });
  }

  findAll() {
    return this.userModel.find().select('-passwordHash').exec();
  }

  findByEmail(email: string) {
    return this.userModel.findOne({ email: email.toLowerCase().trim() }).exec();
  }

  async findOne(id: string) {
    const user = await this.userModel.findById(id).select('-passwordHash').exec();
    if (!user) {
      throw new NotFoundException(`User ${id} not found`);
    }
    return user;
  }

  async remove(id: string) {
    const user = await this.userModel.findByIdAndDelete(id).exec();
    if (!user) {
      throw new NotFoundException(`User ${id} not found`);
    }
    return user;
  }
}
