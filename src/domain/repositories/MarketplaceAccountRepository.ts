import { MarketplaceAccount } from '@/domain/entities/MarketplaceAccountEntity';
import { OptionCheckSuffixRequest } from '@/domain/entities/OptionCheckSuffix';

// FEATURE_2610_13 / D5: vendorId · accessKey · secretKey are Coupang fields; apiKey is the 11st key.
export interface CreateMarketplaceAccountRequest {
  sellerId: number;
  platform: string;
  accountAlias?: string;
  vendorId?: string;
  vendorUserId?: string;
  accessKey?: string;
  secretKey?: string;
  apiKey?: string;
  isActive?: boolean;
  // Channel template assignment. Omit = tenant-default fallback (create).
  thumbnailTemplateId?: number;
  detailTemplateId?: number;
}

// secretKey and apiKey are optional — omit/blank keeps the existing key on the backend.
export interface UpdateMarketplaceAccountRequest {
  sellerId: number;
  platform: string;
  accountAlias?: string;
  vendorId?: string;
  vendorUserId?: string;
  accessKey?: string;
  secretKey?: string;
  apiKey?: string;
  isActive?: boolean;
  // Channel template assignment. Omit = keep existing (backend does not support
  // clearing an override back to default — assign/replace only).
  thumbnailTemplateId?: number;
  detailTemplateId?: number;
}

export interface MarketplaceAccountRepository {
  getBySeller(sellerId: number): Promise<MarketplaceAccount[]>;
  getAll(): Promise<MarketplaceAccount[]>;
  create(data: CreateMarketplaceAccountRequest): Promise<MarketplaceAccount>;
  update(id: number, data: UpdateMarketplaceAccountRequest): Promise<MarketplaceAccount>;
  updateRegistrationNameSuffix(id: number, data: OptionCheckSuffixRequest): Promise<void>;
  delete(id: number): Promise<void>;
}
