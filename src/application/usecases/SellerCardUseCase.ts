import type { SellerCardRepository } from '@/domain/repositories/SellerCardRepository';
import type { SellerCard } from '@/domain/entities/SellerCardEntity';
import type { CreateSellerCardRequest, UpdateSellerCardRequest } from '@/application/dto/SellerCardDTOs';

export class SellerCardUseCase {
  constructor(private repository: SellerCardRepository) {}

  async getVisible(): Promise<SellerCard[]> {
    return this.repository.getVisible();
  }

  async create(request: CreateSellerCardRequest): Promise<SellerCard> {
    return this.repository.create(request);
  }

  async update(cardId: number, request: UpdateSellerCardRequest): Promise<SellerCard> {
    return this.repository.update(cardId, request);
  }

  async hide(cardId: number): Promise<void> {
    return this.repository.hide(cardId);
  }
}
