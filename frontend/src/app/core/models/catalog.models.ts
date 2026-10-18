export interface Category {
  _id: string;
  name: string;
  description?: string;
  photoUrl?: string;
  active: boolean;
}

export interface CreateCategoryPayload {
  name: string;
  description?: string;
}

export type UpdateCategoryPayload = Partial<CreateCategoryPayload>;

export type PriceType = 'fixed' | 'perWeight';

export interface Product {
  _id: string;
  name: string;
  categoryId: Category | string;
  priceType: PriceType;
  price: number;
  unit: string;
  stockQty: number;
  visualDescription?: string;
  photoUrl?: string;
  active: boolean;
}

export interface CreateProductPayload {
  name: string;
  categoryId: string;
  priceType: PriceType;
  price: number;
  unit?: string;
  stockQty?: number;
  visualDescription?: string;
  active?: boolean;
}

export type UpdateProductPayload = Partial<CreateProductPayload>;
