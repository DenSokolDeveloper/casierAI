import {
  BadRequestException,
  Controller,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RecognitionService, SupportedImageMimeType } from './recognition.service';

const ALLOWED_MIME_TYPES: SupportedImageMimeType[] = [
  'image/jpeg',
  'image/png',
  'image/webp',
];
const MAX_FILE_SIZE_BYTES = 8 * 1024 * 1024;

@UseGuards(JwtAuthGuard)
@Controller('recognize')
export class RecognitionController {
  constructor(private readonly recognitionService: RecognitionService) {}

  @Post()
  @UseInterceptors(
    FileInterceptor('photo', {
      storage: memoryStorage(),
      limits: { fileSize: MAX_FILE_SIZE_BYTES },
    }),
  )
  async recognize(@UploadedFile() file?: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('Missing "photo" file field');
    }
    if (!ALLOWED_MIME_TYPES.includes(file.mimetype as SupportedImageMimeType)) {
      throw new BadRequestException(
        `Unsupported image type "${file.mimetype}". Allowed: ${ALLOWED_MIME_TYPES.join(', ')}`,
      );
    }

    return this.recognitionService.recognize(
      file.buffer,
      file.mimetype as SupportedImageMimeType,
    );
  }
}
