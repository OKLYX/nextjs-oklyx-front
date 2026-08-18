import { MarketplaceAccount } from '@/domain/entities/MarketplaceAccountEntity';

export interface CreateMarketplaceAccountRequest {
  sellerId: number;
  platform: string;
  accountAlias?: string;
  vendorId: string;
  accessKey: string;
  secretKey: string;
  isActive?: boolean;
  // Channel template assignment. Omit = tenant-default fallback (create).
  thumbnailTemplateId?: number;
  detailTemplateId?: number;
}

// secretKey is optional — omit/blank keeps the existing key on the backend.
export interface UpdateMarketplaceAccountRequest {
  sellerId: number;
  platform: string;
  accountAlias?: string;
  vendorId: string;
  accessKey: string;
  secretKey?: string;
  isActive?: boolean;
  // Channel template assignment. Omit = keep existing (backend does not support
  // clearing an override back to default — assign/replace only).
  thumbnailTemplateId?: number;
  detailTemplateId?: number;
}

export interface MarketplaceAccountRepository {
  getBySeller(sellerId: number): Promise<MarketplaceAccount[]>;
  create(data: CreateMarketplaceAccountRequest): Promise<MarketplaceAccount>;
  update(id: number, data: UpdateMarketplaceAccountRequest): Promise<MarketplaceAccount>;
  delete(id: number): Promise<void>;
}
