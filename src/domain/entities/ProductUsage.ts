/**
 * 이 물품이 어디에 쓰이는지 (FEATURE_2609_69 / A).
 *
 * 백엔드 `ProductUsageResponse` 와 1:1 이다.
 *
 * 🔴 두 갈래(`masterProducts` · `listingOptions`)는 **삭제를 막는 연결**이고 자동으로 옮겨지지 않는다.
 * 사람이 마스터 상품 화면 · 셀 화면에서 직접 끊어야 한다.
 * 🔴 `history` 는 참고 건수일 뿐 삭제를 막지 않는다 — 막으면 한 번이라도 사고 움직이고 보낸 물품은
 * 영영 지울 수 없다.
 * 🔴 `blockers` 는 서버가 만든 명사구다. 프론트가 **한 글자도 고치지 않는다**(꼬리 문구만 붙인다).
 */
export interface ProductUsageOptionQty {
  optionId: number;
  optionName: string;
  quantity: number | null;
}

export interface ProductUsageMasterRef {
  id: number;
  name: string;
  /** 마스터 구성품의 수량 벡터. 독립된 연결이 아니라 마스터 아래 참고 값이다. */
  optionQuantities: ProductUsageOptionQty[];
}

export interface ProductUsageListingOption {
  /** 채널 셀 옵션(`ProductListingOption`) id — 셀(listing) id 가 아니다. */
  id: number;
  name: string;
  marketplaceAccountId: number | null;
  accountAlias: string | null;
  platform: string;
  quantity: number | null;
  status: string | null;
}

export interface ProductUsageHistoryCounts {
  stockMovements: number;
  purchaseRecords: number;
  shipmentItems: number;
  images: number;
  shoppingListItems: number;
  priceChangeLogs: number;
}

export interface ProductUsage {
  productId: number;
  masterProducts: ProductUsageMasterRef[];
  listingOptions: ProductUsageListingOption[];
  history: ProductUsageHistoryCounts;
  deletable: boolean;
  blockers: string[];
}

/** 삭제가 막힌 사유 한 문장. 🔴 `blockers` 원문 + 이 꼬리만 프론트가 만든다. */
export function deleteBlockedReason(blockers: string[]): string {
  return `${blockers.join(' · ')}에 연결되어 있어 삭제할 수 없습니다`;
}
