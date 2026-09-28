/**
 * 구매처 = 업체 공용 구매처 목록의 한 줄 (FEATURE_2609_76 / D2).
 * File: src/domain/entities/PurchasePlace.ts
 *
 * 물품은 구매처를 **이름이 아니라 id** 로 가진다(D3) — 이름을 바꾸면 모든 물품에 바뀐 이름이 보인다.
 * 목록 조회(`GET /api/admin/purchase-places`)는 모든 사용자, 추가·이름 변경·삭제는 관리자만(D14).
 */
export interface PurchasePlace {
  id: number;
  name: string;
  /** 목록 순서(만든 순서). 순서 바꾸기 기능은 없다. */
  sortOrder: number;
  /** 이 구매처를 쓰는 (삭제되지 않은) 물품 수. 0 이 아니면 삭제할 수 없다(D9). */
  productCount: number;
}

/** 물품 응답에 실리는 구매처 — id 와 **현재** 이름(D3). */
export interface PurchasePlaceRef {
  id: number;
  name: string;
}
