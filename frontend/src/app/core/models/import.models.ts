import { PriceType } from './catalog.models';

export interface ImportPreviewRow {
  name: string;
  price: number;
  priceType: PriceType;
  unit: string;
  stockQty: number;
  categoryName: string;
  categoryIsNew: boolean;
}

export interface ImportPreviewResult {
  rows: ImportPreviewRow[];
  errors: string[];
  aiUsed: boolean;
}

export interface ImportCommitResult {
  createdProducts: number;
  createdCategories: number;
}
