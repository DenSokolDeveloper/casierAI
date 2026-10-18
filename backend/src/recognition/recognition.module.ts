import { Module } from '@nestjs/common';
import { ProductsModule } from '../products/products.module';
import { RecognitionService } from './recognition.service';
import { RecognitionController } from './recognition.controller';

@Module({
  imports: [ProductsModule],
  controllers: [RecognitionController],
  providers: [RecognitionService],
})
export class RecognitionModule {}
