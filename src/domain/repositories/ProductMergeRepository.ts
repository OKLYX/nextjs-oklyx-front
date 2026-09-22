/**
 * 중복 물품 병합 창구 (FEATURE_2609_69 / B).
 *
 * 백엔드 `MergeProductsRequest` / `MergeProductsResponse` 와 1:1 이다.
 *
 * 🔴 **자동 병합이 아니다.** 사람이 고른 값(`fields`)과 사람이 켠 기록(`transfer`)만 남길 물품으로
 * 옮기고, 버릴 물품은 soft delete 된다. 전부 한 트랜잭션이라 실패하면 **아무것도 변하지 않는다**.
 * 🔴 **연결(마스터 구성품 · 판매 옵션 구성품)은 옮기지 않는다.** 버릴 물품에 연결이 남아 있으면
 * 서버가 409 로 거절한다 — 사람이 마스터·셀 화면에서 먼저 끊어야 한다.
 */
export interface MergeTransferOptions {
  purchaseRecords: boolean;
  stockMovements: boolean;
  shipmentItems: boolean;
  images: boolean;
  shoppingListItems: boolean;
  priceChangeLogs: boolean;
  /** 옮긴 내용을 남길 물품 설명 끝에 한 줄로 남긴다 */
  appendMemo: boolean;
}

/**
 * 남길 물품에 덮어쓸 값. 🔴 **null 은 「남길 물품의 값을 그대로 둔다」는 뜻**이다 —
 * 버릴 쪽 값이 저절로 섞여 들어오지 않는다.
 */
export interface MergedProductFields {
  productName: string | null;
  brand: string | null;
  barcodeId: string | null;
  store: string | null;
  price: number | null;
  description: string | null;
  netContent: string | null;
  netContentUnit: string | null;
  packageHeight: string | null;
  packageLength: string | null;
  packageWidth: string | null;
  /**
   * 대표 사진. 🔴 플래그 컬럼이 아니라 **갤러리 맨 앞 한 장**이라는 뜻이다(PLAN D13).
   * 🔴 `transfer.images` 가 꺼진 채 **버릴 쪽** 사진을 지정하면 서버가 400 을 낸다
   * (그 사진은 이관되지 않아 버릴 물품과 함께 묻히기 때문).
   */
  representativeImageId: number | null;
}

export interface MergeProductsRequest {
  /** 살아남는 물품 */
  targetProductId: number;
  /** soft delete 되는 물품 */
  sourceProductId: number;
  fields: MergedProductFields;
  transfer: MergeTransferOptions;
}

export interface MergeProductsResponse {
  targetProductId: number;
  /** 표별 이관 건수 — 키는 `MergeTransferOptions` 의 필드명 */
  moved: Record<string, number>;
  /** 옮기지 못해 버린 건수 (`shoppingListItems` 충돌 · `boxRecipes`) */
  droppedOnConflict: Record<string, number>;
  /** 🔴 병합 전 스냅샷 파일 **이름**. 화면에 쓰지 않는다 */
  snapshotFileName: string | null;
}

export interface ProductMergeRepository {
  merge(request: MergeProductsRequest): Promise<MergeProductsResponse>;
}
