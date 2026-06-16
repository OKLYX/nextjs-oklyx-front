export interface MarketplaceAccount {
  id: number;
  sellerId: number;
  platform: string;
  accountAlias: string | null;
  vendorId: string;
  accessKey: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}
