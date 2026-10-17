import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsMongoId,
  IsNumber,
  Min,
  ValidateNested,
} from 'class-validator';

export class CreateTransactionItemDto {
  @IsMongoId()
  productId: string;

  // Piece count for priceType 'fixed', kilograms for priceType 'perWeight'.
  @IsNumber()
  @Min(0.001)
  qty: number;
}

export class CreateTransactionDto {
  @ValidateNested({ each: true })
  @Type(() => CreateTransactionItemDto)
  @ArrayMinSize(1)
  items: CreateTransactionItemDto[];
}
