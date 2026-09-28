import type { PurchasePlaceRef } from '@/domain/entities/PurchasePlace';

/**
 * 개수 단위 고정 목록 (FEATURE_2609_76 / D12) — 순서가 곧 선택지 순서다.
 * 🔴 백엔드 `ProductServiceImpl.VALID_COUNT_UNITS` · 모바일 `kCountUnits` 와 글자·순서까지 같다.
 * ❌ 무게·부피 단위(`netContentUnit`, KG·G·L·ML)와 섞지 않는다(D7).
 */
export const COUNT_UNITS = ['개', '장', '매', '봉', '팩', '롤', '입'] as const;

export interface Product {
  id: number;
  productName: string;
  brand: string;
  price: number;
  /**
   * 구매처(목록 순서, 현재 이름) — FEATURE_2609_76 / D3.
   * ⚠️ optional: 사진 올리기·지우기 응답(`ProductResponse.of`)에는 없다. 없으면 `[]` 로 읽는다.
   */
  purchasePlaces?: PurchasePlaceRef[];
  active: boolean;
  createdDate: string;
  modifiedDate?: string;
  barcodeId?: string;
  netContentUnit?: string;
  packageHeight?: string;
  packageLength?: string;
  packageWidth?: string;
  netContent?: string;
  /** 개수(1 이상 정수) + 개수 단위(`COUNT_UNITS`). 둘 다 있거나 둘 다 없다(D6). */
  countQuantity?: number | null;
  countUnit?: string | null;
  description?: string;
  name?: string;
  imageUrl?: string;
  /**
   * 이 물품이 연결된 판매채널(채널 셀) 수 — 「연결 현황」과 같은 정의.
   *
   * ⚠️ optional: 백엔드가 아직 이 필드를 안 내려주는 환경에서는 `undefined` 다.
   * 🔴 `undefined` 를 0 으로 읽지 말 것 — 모르는 것(`-`)과 없는 것(`0`)은 다르다.
   */
  channelCount?: number;
}

/**
 * 구매처 이름을 한 줄로 — 목록 순서, `", "` 로 잇는다. 없으면 빈 문자열.
 * 🔴 물품 구매처를 글자로 보이는 곳(목록 표 · 상세 · 마스터 구성품 팝업)은 전부 이 함수를 쓴다.
 */
export function purchasePlaceNames(product: Pick<Product, 'purchasePlaces'>): string {
  return (product.purchasePlaces ?? []).map((place) => place.name).join(', ');
}
