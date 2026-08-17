// MarginPolicy (마진 프리셋, seller × platform) domain types.
// marginRate is a 0~1 decimal (net profit rate) — UI shows it as a percentage.

export interface MarginPolicyResponse {
  id: number;
  sellerId: number;
  sellerName: string;
  platform: string;
  marginRate: number;
}

export interface MarginPolicyRequest {
  sellerId: number;
  platform: string;
  marginRate: number;
}
