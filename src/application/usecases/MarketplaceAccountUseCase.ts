import {
  MarketplaceAccountRepository,
  CreateMarketplaceAccountRequest,
  UpdateMarketplaceAccountRequest,
} from '@/domain/repositories/MarketplaceAccountRepository';
import { MarketplaceAccount } from '@/domain/entities/MarketplaceAccountEntity';
import { OptionCheckSuffixRequest } from '@/domain/entities/OptionCheckSuffix';

export class MarketplaceAccountUseCase {
  constructor(private repository: MarketplaceAccountRepository) {}

  async getBySeller(sellerId: number): Promise<MarketplaceAccount[]> {
    return this.repository.getBySeller(sellerId);
  }

  async create(data: CreateMarketplaceAccountRequest): Promise<MarketplaceAccount> {
    return this.repository.create(data);
  }

  async update(id: number, data: UpdateMarketplaceAccountRequest): Promise<MarketplaceAccount> {
    return this.repository.update(id, data);
  }

  async updateRegistrationNameSuffix(id: number, data: OptionCheckSuffixRequest): Promise<void> {
    return this.repository.updateRegistrationNameSuffix(id, data);
  }

  async delete(id: number): Promise<void> {
    return this.repository.delete(id);
  }
}
