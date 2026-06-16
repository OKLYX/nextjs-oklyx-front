import { MarketplaceAccount } from '@/domain/entities/MarketplaceAccountEntity';

export interface CreateMarketplaceAccountRequest {
  sellerId: number;
  platform: string;
  accountAlias?: string;
  vendorId: string;
  accessKey: string;
  secretKey: string;
  isActive?: boolean;
}

export interface MarketplaceAccountRepository {
  getBySeller(sellerId: number): Promise<MarketplaceAccount[]>;
  create(data: CreateMarketplaceAccountRequest): Promise<MarketplaceAccount>;
  delete(id: number): Promise<void>;
}
