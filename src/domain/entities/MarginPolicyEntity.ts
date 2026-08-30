// MarginPolicy (마진 프리셋, seller × platform) domain types.
// marginRate is a 0~1 decimal (net profit rate) — UI shows it as a percentage.

export interface MarginPolicyResponse {
  id: number;
  sellerId: number;
  sellerName: string;
  platform: string;
  marginRate: number;
  // 표시 할인율 (0~0.5 decimal). originalPrice 역산용 (73). null = 할인 없음.
  displayDiscountRate: number | null;
}

export interface MarginPolicyRequest {
  sellerId: number;
  platform: string;
  marginRate: number;
  // 0~0.5 decimal. null/omit = 생성 시 할인 없음 / 수정 시 기존값 유지.
  displayDiscountRate?: number | null;
}
