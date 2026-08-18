export interface MarketplaceAccount {
  id: number;
  sellerId: number;
  platform: string;
  accountAlias: string | null;
  vendorId: string;
  accessKey: string;
  isActive: boolean;
  // Channel template assignment (id only; display name resolved via a separate
  // template-list lookup). null = use the tenant default template.
  thumbnailTemplateId: number | null;
  detailTemplateId: number | null;
  createdAt: string;
  updatedAt: string;
}

// Minimal shape for a template-assignment dropdown option. Both ThumbnailTemplate
// and DetailTemplateResponse satisfy it structurally, so one type drives both
// dropdowns and the id -> name lookup in the channel details modal.
export interface TemplateOption {
  id: number;
  name: string;
  isDefault: boolean;
}
