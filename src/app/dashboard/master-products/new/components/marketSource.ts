import type {
  ImportOptionSpec,
  MasterFromChannelPreview,
} from '@/domain/entities/ListingRegistrationEntity';
import type { MasterOptionRequest } from '@/domain/entities/MasterProductEntity';

/**
 * 「마켓 상품으로 시작」 [새 마스터로] 로 3단 페이지를 열 때의 출발 상품(2609_79 / UX D70·D71·D77).
 * File: src/app/dashboard/master-products/new/components/marketSource.ts
 *
 * 주소 `?sellerId=&platform=&platformProductId=` 세 값이 모두 있을 때만 만들어진다. `preview` 는
 * `POST /api/admin/master-products/from-channel/preview` 응답이다(캐시하지 않는다 — 가격·재고는 변한다).
 */
export interface MarketSource {
  sellerId: number;
  platform: string;
  platformProductId: string;
  preview: MasterFromChannelPreview;
}

/** 플랫폼 코드 → 화면 이름. 플랫폼이 늘면 여기 한 줄만 는다(UX D64). */
export const PLATFORM_LABEL: Record<string, string> = { COUPANG: '쿠팡' };

/** 구성상품·카테고리를 바꿀 때 뜨는 확인창 문구(마켓 모드) — 옵션은 남고 구성 수량만 지워진다(UX D71·D32). */
export const MARKET_OPTION_RESET_MESSAGE =
  '구성상품이나 카테고리를 바꾸면 옵션별 구성 수량이 지워집니다(옵션은 마켓 상품 그대로 남습니다). 계속하시겠습니까?';

/** 마스터 저장 뒤 판매상품 붙이기에 실패했을 때 상세 배너 문구의 앞부분(UX D70). 뒤에 서버 사유가 붙는다. */
export const MARKET_ATTACH_FAIL_PREFIX = '마스터는 만들어졌습니다. 마켓 상품을 붙이지 못했습니다: ';

/** 판매상품을 붙이기 전에 저장이 멈췄을 때 기존 배너 문구 뒤에 붙인다(UX D70 — 사용자가 상세에서 다시 붙인다). */
export const MARKET_NOT_ATTACHED_SUFFIX =
  ' 마켓 상품은 붙이지 않았습니다 — 판매채널 줄의 [마켓 상품 추가하기]로 붙이세요.';

/**
 * 마켓 옵션 → 3단 페이지 옵션 초기값(UX D71). 이름 = 마켓 옵션명, 구성 수량은 비워 둔다(사람이 입력).
 * 옵션마다 다른 속성(`attributes`)은 그 옵션의 속성 override 로 채운다(UX D77). 재고는 넣지 않는다(2609_45 D3-1).
 */
export function marketOptionsOf(preview: MasterFromChannelPreview): MasterOptionRequest[] {
  return preview.options.map((o) => ({
    name: o.itemName,
    items: [],
    categoryAttributes: Object.keys(o.attributes).length > 0 ? { ...o.attributes } : undefined,
  }));
}

/**
 * 저장한 마스터 옵션 → 기존 마스터에 붙이기 요청의 옵션 줄(UX D70). 마켓 옵션마다 **같은 이름의** 마스터 옵션
 * 구성 수량을 보낸다 — 서버는 구성 수량 + 이름이 같은 마스터 옵션에 먼저 잇는다(`resolveMasterOption`, UX D80).
 * 그래서 구성 수량이 같은 옵션이 둘이어도 마켓 옵션마다 제 이름의 마스터 옵션에 붙는다.
 */
export function importOptionsOf(
  preview: MasterFromChannelPreview,
  options: MasterOptionRequest[],
): ImportOptionSpec[] {
  return preview.options.map((o) => ({
    vendorItemId: o.platformOptionId,
    itemName: o.itemName,
    masterOptionName: o.itemName,
    components: options.find((opt) => opt.name === o.itemName)?.items ?? [],
  }));
}
