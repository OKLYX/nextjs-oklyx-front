import type { SellerCard } from '@/domain/entities/SellerCardEntity';
import type { CreateSellerCardRequest, UpdateSellerCardRequest } from '@/application/dto/SellerCardDTOs';

// Visible cards of every seller (seller id, then card id). Delete = hide on the server (FEATURE_2610_18 D91).
export interface SellerCardRepository {
  getVisible(): Promise<SellerCard[]>;
  create(request: CreateSellerCardRequest): Promise<SellerCard>;
  update(cardId: number, request: UpdateSellerCardRequest): Promise<SellerCard>;
  hide(cardId: number): Promise<void>;
}
