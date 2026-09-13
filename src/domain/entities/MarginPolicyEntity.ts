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
  // 최소 마진 기준 (FEATURE_2609_39 / PLAN D4). 둘 다 null 허용 = 그 조건 미사용.
  // 하나라도 밑돌면 판매가 관리 화면에서 「대응 필요」로 표시된다.
  minMarginAmount: number | null;
  // 0~1 소수. 0.109 = 10.9%
  minMarginRate: number | null;
}

export interface MarginPolicyRequest {
  sellerId: number;
  platform: string;
  marginRate: number;
  // 0~0.5 decimal. null/omit = 생성 시 할인 없음 / 수정 시 기존값 유지.
  displayDiscountRate?: number | null;
  // 🔴 displayDiscountRate 와 달리 null 은 「그대로 둔다」가 아니라 **삭제**다 — 백엔드가 그대로 써넣는다.
  // 빈칸으로 저장하면 그 조건을 끄는 것이 의도이므로 undefined 가 아니라 null 을 보낸다.
  minMarginAmount?: number | null;
  minMarginRate?: number | null;
}
