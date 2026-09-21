/**
 * 마켓 상품을 **보기 위한** 값들(FEATURE_2609_67 — 물품 등록 참고 패널).
 *
 * 백엔드 `GET /api/admin/channel-products` 는 아무 판정도 하지 않는 읽기 전용 창구다(PLAN/D4) —
 * 이미 우리 셀로 연결된 상품도 그대로 내려온다. 마스터 생성 미리보기
 * (`MasterFromChannelPreview`)와 값의 뜻은 겹치지만 그쪽은 연결 여부를 400 으로 막으므로
 * 서로 재사용하지 않는다.
 */

/** 이름 검색 후보 한 건. 🔴 사진이 없다 — 사진은 단건 조회로만 온다. */
export interface ChannelProductSummary {
  platformProductId: string;
  productName: string | null;
  brand: string | null;
  status: string;
  createdAt: string | null;
}

export interface ChannelProductSearch {
  items: ChannelProductSummary[];
  /** null 이면 마지막 페이지 — [더 보기] 를 감춘다. */
  nextToken: string | null;
}

export interface ChannelProductOption {
  itemName: string | null;
  salePrice: number | null;
  stockQuantity: number | null;
  /** 마켓에 저장된 카테고리 속성(이름 → 값). 🔴 단위가 붙은 값("1.5kg")과 떨어진 값("6"·"320")이 섞여 온다. */
  attributes: Record<string, string>;
}

export interface ChannelProductDetail {
  platformProductId: string;
  productName: string | null;
  brand: string | null;
  status: string;
  categoryCode: string | null;
  noticeGroup: string | null;
  notices: Record<string, string>;
  /** 🔴 마켓 가공본(문구·테두리). 제품 사진으로 쓰기 전에 사람이 봐야 한다. */
  thumbnailImages: string[];
  /** 원본에 가까운 사진. */
  detailImages: string[];
  options: ChannelProductOption[];
}
