import {
  MarketplaceAccountRepository,
  CreateMarketplaceAccountRequest,
} from '@/domain/repositories/MarketplaceAccountRepository';
import { MarketplaceAccount } from '@/domain/entities/MarketplaceAccountEntity';

export class MarketplaceAccountUseCase {
  constructor(private repository: MarketplaceAccountRepository) {}

  async getBySeller(sellerId: number): Promise<MarketplaceAccount[]> {
    return this.repository.getBySeller(sellerId);
  }

  async create(data: CreateMarketplaceAccountRequest): Promise<MarketplaceAccount> {
    return this.repository.create(data);
  }

  async delete(id: number): Promise<void> {
    return this.repository.delete(id);
  }
}
