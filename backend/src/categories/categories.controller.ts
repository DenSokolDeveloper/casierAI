import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { CategoriesService } from './categories.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthenticatedUser } from '../auth/jwt.strategy';
import {
  ALLOWED_IMAGE_MIME_TYPES,
  MAX_IMAGE_UPLOAD_BYTES,
  resizeToJpegDataUri,
} from '../common/image.util';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('categories')
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Roles('owner')
  @Post()
  create(@Body() dto: CreateCategoryDto, @CurrentUser() user: AuthenticatedUser) {
    return this.categoriesService.create(dto, user.shopId);
  }

  @Get()
  findAll(@CurrentUser() user: AuthenticatedUser) {
    return this.categoriesService.findAll(user.shopId);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.categoriesService.findOne(id, user.shopId);
  }

  @Roles('owner')
  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateCategoryDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.categoriesService.update(id, dto, user.shopId);
  }

  @Roles('owner')
  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.categoriesService.remove(id, user.shopId);
  }

  @Roles('owner')
  @Post(':id/photo')
  @UseInterceptors(
    FileInterceptor('photo', {
      storage: memoryStorage(),
      limits: { fileSize: MAX_IMAGE_UPLOAD_BYTES },
    }),
  )
  async uploadPhoto(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException('Missing "photo" file field');
    }
    if (!ALLOWED_IMAGE_MIME_TYPES.includes(file.mimetype as never)) {
      throw new BadRequestException(
        `Unsupported image type "${file.mimetype}". Allowed: ${ALLOWED_IMAGE_MIME_TYPES.join(', ')}`,
      );
    }
    const photoUrl = await resizeToJpegDataUri(file.buffer);
    return this.categoriesService.setPhoto(id, photoUrl, user.shopId);
  }

  @Roles('owner')
  @Delete(':id/photo')
  removePhoto(@Param('id') id: string, @CurrentUser() user: AuthenticatedUser) {
    return this.categoriesService.setPhoto(id, null, user.shopId);
  }
}
