import type { BoxKind } from '@/domain/entities/PackageEntity';

/**
 * 송장 스캔 포장 화면이 쓰는 타입 (FEATURE_2609_40 / PLAN D9 ~ D17 · D31 · D32).
 *
 * 백엔드 `com.pms.dto.response.PackingScanResponse` · `PendingParcelView` ·
 * `BarcodeLookupResponse` · `ParcelCompleteResponse` 와 1:1 이다.
 */

/** 실물 박스 상태. `PENDING` 만 담을 수 있다 */
export type ParcelStatus = 'PENDING' | 'PACKED' | 'UNUSED';

/** 스캔한 박스 자체 */
export interface PackingParcelView {
  id: number;
  invoiceNumber: string;
  carrierName: string | null;
  parcelSeq: number | null;
  /** 같은 배송 묶음의 박스 수(= 발급된 송장 장수). 박스 개수의 상한이다 (D17) */
  totalParcels: number;
  status: ParcelStatus;
}

/**
 * 화면 상단에 주문을 확인시켜 주는 최소 정보.
 *
 * 🔴 이름 두 개를 그대로 받고 **어느 쪽을 보일지는 화면이 정한다**(2609_54/D5): 수취인 ?? 주문자.
 * 마스킹하지 않는다 — 작업자가 실물 송장의 받는 사람과 대조하는 값이다. 연락처·주소는 오지 않는다.
 */
export interface PackingOrderView {
  externalOrderId: string;
  sellerName: string | null;
  /** 주문자 이름 */
  ordererName: string | null;
  /** 수취인 이름 */
  receiverName: string | null;
}

/**
 * 이 박스에 담아야 할 것 1건 = (주문 라인 × 물품).
 *
 * 🔴 `barcodeId` 가 이 화면의 핵심이다 (D11): 맞는 스캔은 **서버를 부르지 않고** 이 값으로 화면에서
 * 맞춘다. 비어 있는 물품은 화면 매칭이 불가능해 `lookupBarcode` 경로로 넘어간다.
 */
export interface RemainingItem {
  orderLineId: number;
  itemName: string;
  productId: number;
  productName: string;
  barcodeId: string | null;
  remainingQty: number;
  /** 물품 사진. 없으면 `null` → 화면이 회색 자리(아이콘)를 그린다 (2609_54/D2) */
  imageUrl: string | null;
}

/** 전개하지 못한 주문 라인. 하나라도 있으면 이 박스는 완료할 수 없다 */
export interface PackingUnexpanded {
  orderLineId: number;
  externalOrderId: string;
  itemName: string;
  /** `UNMAPPED_OPTION` | `NO_MASTER_OPTION` | `EMPTY_BOM` */
  reason: string;
}

/**
 * 지금 담긴 조합으로 추천된 상자 1개 (D22 ~ D25).
 *
 * `imageUrl` 이 없으면 화면은 치수 비율 도형(`BoxShape`)을 그린다 (D26).
 */
export interface BoxCandidate {
  packageId: number;
  type: string;
  boxKind: BoxKind;
  cost: number;
  widthCm: number;
  lengthCm: number;
  heightCm: number;
  imageUrl: string | null;
  useCount: number;
  lastUsedAt: string | null;
}

/** 송장 스캔 결과 */
export interface PackingScanResponse {
  parcel: PackingParcelView;
  order: PackingOrderView;
  remaining: RemainingItem[];
  /** 스캔 시점에는 비어 있다 — 담기 시작하면 화면이 `boxCandidates` 로 다시 묻는다 (D23) */
  boxCandidates: BoxCandidate[];
  unexpanded: PackingUnexpanded[];
  /**
   * 작업 대상인 박스가 이것 하나뿐인가 (D13 · D31).
   * 참이면 [이 박스 완료]는 남은 물품 **전량**을 요구한다.
   */
  isLastParcel: boolean;
}

/** 작업 대상 박스 1건 — 서버가 이미 「PENDING + 잔량 > 0」 으로 걸러서 준다 (D31) */
export interface PendingParcel {
  parcelId: number;
  invoiceNumber: string;
  carrierName: string | null;
  parcelSeq: number | null;
  totalParcels: number;
  externalOrderId: string;
  sellerName: string | null;
  remainingQty: number;
  orderedAt: string | null;
}

/**
 * 못 맞춘 바코드를 서버에 물어본 결과 (오류 경로 전용).
 *
 * - `found = false` → 「등록되지 않은 바코드」
 * - `found = true, inThisParcel = false` → 「없는 물품입니다」 (D12 거부)
 * - `found = true, inThisParcel = true` → 화면 매칭만 실패했다 (담기 허용)
 */
export interface BarcodeLookupResult {
  found: boolean;
  productId: number | null;
  productName: string | null;
  inThisParcel: boolean;
}

/** [이 박스 완료] 결과. 이미 완료된 박스에 다시 보내면 저장돼 있던 값이 그대로 온다 (D15) */
export interface PackingCompleteResult {
  parcelId: number;
  status: ParcelStatus;
  packedQty: number;
  expectedBoxCost: number | null;
  actualBoxCost: number | null;
  expectedDeliveryCost: number | null;
}

/** 「사용하지 않은 박스」로 닫은 결과 (D32) */
export interface PackingCloseResult {
  parcelId: number;
  status: ParcelStatus;
}

/** 상자 후보를 물을 때 보내는 조합 1건 — 키는 물품 × 수량뿐이다 (D22) */
export interface BoxCandidateItem {
  productId: number;
  quantity: number;
}

/** 박스에 담은 것 1건. `orderLineId` 는 합포장 대비로 필수다 (D2) */
export interface PackedItemRequest {
  orderLineId: number;
  productId: number;
  quantity: number;
}

/** [이 박스 완료] 요청 — 담은 내용을 완료 때 한 번에 보낸다 (D14) */
export interface ParcelCompleteRequest {
  boxPackageId: number;
  items: PackedItemRequest[];
  /** 출고 기록일(YYYY-MM-DD). 생략하면 서버가 오늘로 남긴다 */
  movedOn?: string;
}
