/**
 * Where this product is used (FEATURE_2609_69 / A).
 *
 * One to one with the backend `ProductUsageResponse`.
 *
 * 🔴 The two branches (`masterProducts` · `listingOptions`) are **links that block deletion**. A plain delete never
 * moves them; only the product merge moves them to the kept product (FEATURE_2611_09 / D1).
 * 🔴 **They are unlinked in one place, the master product screen** (the cell component copies are gone since
 * 2609_71) — `listingOptions` is the **reach** of this product through its masters; when it is not empty,
 * `masterProducts` is never empty either.
 * 🔴 The screen does not draw this list — the sales channels come from `masterProducts[].channels` (2026-09-23).
 * It stays only as the source of the delete blockers (`deletable` · `blockers`).
 * 🔴 `history` is an informational count and never blocks deletion — otherwise a product that was ever bought,
 * moved or shipped could never be deleted.
 * 🔴 `blockers` are noun phrases built by the server. The front **does not change a single character** (it only
 * appends the closing clause).
 */
export interface ProductUsageOptionQty {
  optionId: number;
  optionName: string;
  quantity: number | null;
}

/** 마스터가 올라가 있는 판매 채널(셀) 한 줄. */
export interface ProductUsageChannel {
  listingId: number;
  listingName: string | null;
  marketplaceAccountId: number | null;
  accountAlias: string | null;
  platform: string;
  status: string | null;
}

export interface ProductUsageMasterRef {
  id: number;
  name: string;
  /** 마스터 구성품의 수량 벡터. 독립된 연결이 아니라 마스터 아래 참고 값이다. */
  optionQuantities: ProductUsageOptionQty[];
  /**
   * 이 마스터에 붙어 있는 판매 채널 **전부**.
   *
   * 🔴 `listingOptions` 와 다르다 — 그쪽은 옵션 FK 를 타고 내려온 것이라 FK 가 비어 있는 셀
   * (쿠팡 ID 로 편입했거나 FK 승격 전에 만들어진 셀)이 통째로 빠진다. 화면이 묻는 것은
   * "이 물품이 어디서 팔리나" 이므로 **이 목록**을 그린다(2026-09-23).
   */
  channels: ProductUsageChannel[];
}

export interface ProductUsageListingOption {
  /** 채널 셀 옵션(`ProductListingOption`) id — 셀(listing) id 가 아니다. */
  id: number;
  name: string;
  /**
   * 이 옵션이 속한 판매 상품(셀) id. 🔴 화면이 판매 상품 상세로 바로 가는 근거다 —
   * 이 값이 없던 시절에는 목록으로만 보낼 수 있었다(2026-09-23).
   */
  listingId: number | null;
  /** 판매 상품 이름. 옵션명만으로는 어느 상품인지 알 수 없어 함께 보여준다. */
  listingName: string | null;
  /** 이 옵션이 매달린 마스터 상품 id — 화면이 판매 채널을 마스터 아래로 넣는 근거다(2026-09-23). */
  masterProductId: number | null;
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
