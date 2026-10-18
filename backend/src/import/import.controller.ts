import {
  BadRequestException,
  Body,
  Controller,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { ImportService } from './import.service';
import { CommitImportDto } from './dto/commit-import.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { CurrentUser } from '../auth/current-user.decorator';
import type { AuthenticatedUser } from '../auth/jwt.strategy';

const MAX_IMPORT_FILE_BYTES = 10 * 1024 * 1024;

@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('owner')
@Controller('import')
export class ImportController {
  constructor(private readonly importService: ImportService) {}

  @Post('preview')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: MAX_IMPORT_FILE_BYTES },
    }),
  )
  async preview(
    @CurrentUser() user: AuthenticatedUser,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException('Missing "file" field');
    }
    return this.importService.preview(file.buffer, user.shopId);
  }

  @Post('commit')
  commit(@Body() dto: CommitImportDto, @CurrentUser() user: AuthenticatedUser) {
    return this.importService.commit(dto.rows, user.shopId);
  }
}
