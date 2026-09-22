/**
 * 이 물품이 어디에 쓰이는지 (FEATURE_2609_69 / A).
 *
 * 백엔드 `ProductUsageResponse` 와 1:1 이다.
 *
 * 🔴 두 갈래(`masterProducts` · `listingOptions`)는 **삭제를 막는 연결**이고 자동으로 옮겨지지 않는다.
 * 🔴 **끊는 곳은 마스터 상품 화면 한 군데다**(2609_71 이후 셀 구성품 사본이 사라졌다) — `listingOptions` 는
 * 마스터를 통해 이 물품이 흘러간 **파급 범위**이고, 비어 있지 않으면 `masterProducts` 도 반드시 비어 있지 않다.
 * 🔴 화면은 이 목록을 그리지 않는다 — 판매 채널은 `masterProducts[].channels` 가 준다(2026-09-23).
 * 여기는 삭제를 막는 근거(`deletable`·`blockers`)의 출처로만 남는다.
 * 🔴 `history` 는 참고 건수일 뿐 삭제를 막지 않는다 — 막으면 한 번이라도 사고 움직이고 보낸 물품은
 * 영영 지울 수 없다.
 * 🔴 `blockers` 는 서버가 만든 명사구다. 프론트가 **한 글자도 고치지 않는다**(꼬리 문구만 붙인다).
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
