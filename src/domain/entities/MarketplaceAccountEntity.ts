export interface MarketplaceAccount {
  id: number;
  sellerId: number;
  platform: string;
  accountAlias: string | null;
  // Coupang only — null on an 11st account (FEATURE_2610_13 / D5).
  vendorId: string | null;
  // WING login ID (쿠팡 상품등록 필수). Distinct from vendorId (벤더 코드). null = 미설정.
  vendorUserId: string | null;
  // Coupang only — null on an 11st account (FEATURE_2610_13 / D5).
  accessKey: string | null;
  isActive: boolean;
  // Channel template assignment (id only; display name resolved via a separate
  // template-list lookup). null = use the tenant default template.
  thumbnailTemplateId: number | null;
  detailTemplateId: number | null;
  // "옵션확인" 접미사 채널 override (69). null = 상속(판매자 기본 → 시스템).
  optionCheckSuffixEnabled?: boolean | null;
  optionCheckSuffix?: string | null;
  // FEATURE_2610_13 / D88: 11st only (null elsewhere) — last successful keyed 11st call, and whether 150 days passed.
  elevenstKeyLastUsedAt?: string | null;
  elevenstKeyRenewalNeeded?: boolean | null;
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
