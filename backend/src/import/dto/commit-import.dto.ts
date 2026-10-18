import { Type } from 'class-transformer';
import { ArrayMinSize, IsIn, IsNumber, IsOptional, IsString, Min, ValidateNested } from 'class-validator';
import type { PriceType } from '../../products/product.schema';

export class CommitImportRowDto {
  @IsString()
  name: string;

  @IsString()
  categoryName: string;

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
}

export class CommitImportDto {
  @ValidateNested({ each: true })
  @Type(() => CommitImportRowDto)
  @ArrayMinSize(1)
  rows: CommitImportRowDto[];
}
