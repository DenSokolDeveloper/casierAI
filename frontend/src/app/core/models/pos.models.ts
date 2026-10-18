import { PriceType } from './catalog.models';

export interface RecognitionCandidate {
  productId: string;
  confidence: number;
  name: string;
  price: number;
  priceType: PriceType;
  unit: string;
}

export interface CartItem {
  productId: string;
  name: string;
  priceType: PriceType;
  unitPrice: number;
  unit: string;
  qty: number;
  lineTotal: number;
}

export interface TransactionItemPayload {
  productId: string;
  qty: number;
}

export interface TransactionResponse {
  _id: string;
  total: number;
  createdAt: string;
}
