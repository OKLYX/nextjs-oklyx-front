/**
 * 알림 배지 카운트 (GET /api/alerts/summary, FEATURE_2609_49 / D9 · FEATURE_2609_51 / D3·D11).
 *
 * 🔴 배지·알림의 **단일 창구**다 — 화면이 자기 목록을 세지 말 것. 범위가 미완결/미답변 **전부**
 * (타입 무관·기간 무관)라 목록 화면의 기본 필터(반품 탭 + 최근 2주)와 다르고,
 * **배지 숫자와 화면 행 수가 일치하지 않는 것이 정상**이다.
 *
 * 🔴 아래 다섯 숫자는 **서로 다른 질문의 답**이라 값이 다르다 — 한쪽을 다른 쪽에 맞추지 말 것.
 */
export interface AlertSummary {
  /** 미완결 클레임 수(DONE·REJECTED·WITHDRAWN·STALE 이 아닌 것). 기간 무관 — 사이드바 `반품/교환` 배지. */
  openClaims: number;
  /** 미답변 고객문의 수. 기간 무관 — 사이드바 `고객문의` 배지. */
  unansweredInquiries: number;
  /** 결제완료 **주문** 수 = `출고관리` 메뉴 배지(D7, 2026-09-16 단위 변경). 🔴 종 배지의 새 주문과
   *  **같은 주문 단위**다. 다만 기간 상한이 없어, 14일이 지난 결제완료 주문이 있으면 여전히 더 크다. */
  paidOrders: number;
  /** 새 주문 알림 건수(주문 단위 · 최근 14일). */
  newOrders: number;
  /** 종 배지 = 지금 처리해야 할 일 건수. 🔴 알림 목록의 **행 수와 같다**(D3). */
  todoCount: number;
}

/** 알림 행의 출처. 🔴 백엔드 `AlertType` 과 같은 값이다 — 임의로 늘리지 말 것. */
export type AlertKind = 'ORDER' | 'CLAIM' | 'INQUIRY';

/** 처리해야 할 일 1건 (GET /api/alerts, 2609_51).
 *  🔴 저장된 알림이 아니라 조회 시점에 모아 만든 파생 값이다 — 일이 끝나면 사라진다.
 *  🔴 확인·읽음 상태는 없다(D2). */
export interface AlertFeedItem {
  alertType: AlertKind;
  refId: number;
  /** ORDER 의 딥링크 키(출고관리 주문번호 검색어). */
  externalOrderId: string | null;
  platform: string;
  sellerName: string | null;
  itemName: string | null;
  /** ORDER 의 상품(라인) 수 — `상품 3개` 로 그린다.
   *  ⚠️ 2026-09-16 이후 메뉴 배지도 **주문 단위**(`paidOrders`)라 단위 차이는 없다. 남은 차이는 기간뿐. */
  itemCount: number | null;
  detail: string | null;
  /** 🔴 마켓이 준 **KST 벽시계**다 — `formatMarketRelativeTime` 으로만 그린다(D8). */
  occurredAt: string;
  claimType: 'RETURN' | 'EXCHANGE' | null;
}

export interface AlertFeedQuery { type?: AlertKind; cursor?: string; size?: number; }

/** 한 장 + 다음 커서. `nextCursor === null` 이면 끝이다.
 *  🔴 커서는 **불투명 문자열**이다 — 만들거나 해석하지 말고 받은 값을 그대로 돌려보낸다. */
export interface AlertFeedPage { items: AlertFeedItem[]; nextCursor: string | null; }
