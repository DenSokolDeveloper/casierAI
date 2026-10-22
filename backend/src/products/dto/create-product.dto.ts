import {
  IsBoolean,
  IsIn,
  IsMongoId,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import type { PriceType } from '../product.schema';

export class CreateProductDto {
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  code?: string;

  @IsOptional()
  @IsMongoId()
  categoryId?: string | null;

  @IsIn(['fixed', 'perWeight'])
  priceType: PriceType;

  @IsNumber()
  @Min(0)
  price: number;

  @IsOptional()
  @IsString()
  unit?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  stockQty?: number;

  @IsOptional()
  @IsString()
  visualDescription?: string;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
