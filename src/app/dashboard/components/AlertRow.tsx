'use client';

import { formatMarketRelativeTime } from '@/domain/entities/DateTimeFormat';
import type { AlertFeedItem } from '@/domain/entities/AlertEntity';
import { ROUTES } from '@/config/routes';

/**
 * 처리해야 할 일 1행 (FEATURE_2609_51).
 *
 * **용도**: 상단 종 말풍선(`AlertBell`)과 알림 센터 페이지가 **공유**하는 알림 행.
 * **파일**: src/app/dashboard/components/AlertRow.tsx
 *
 * **모양**
 * ```
 * [새 주문] 상품명 · 상품 3개
 * 쿠팡 · 판매자명 · 3시간 전
 * 사유·본문 앞부분 (2줄에서 자름)
 * ```
 *
 * **사용 예제**
 * ```tsx
 * <AlertRow item={item} onNavigate={(picked) => router.push(alertHref(picked))} />
 * ```
 *
 * 🔴 알림을 그리는 자리는 이것 하나다 — 말풍선·알림 센터에 같은 행을 두 번 만들지 말 것.
 * 🔴 시각은 `formatMarketRelativeTime` 으로만 그린다. `formatRelativeTime`(서버 낙인 UTC 전용)을
 *    쓰면 마켓 KST 값이 9시간 어긋난다(PLAN D8).
 * ⚠️ 확인·읽음 버튼·체크박스를 만들지 말 것(D2). 일이 처리되면 목록에서 저절로 빠진다.
 * ❌ 화면 문구에 `미처리`·`미확인` 을 쓰지 말 것 — `처리해야 할 일` 로 통일한다(D4).
 */

/** 칩 라벨 — CLAIM 은 반품/교환을 나눠 적는다(사용자가 보는 이름이 다르다). */
function chipOf(item: AlertFeedItem): { label: string; className: string } {
  if (item.alertType === 'ORDER') return { label: '새 주문', className: 'bg-blue-100 text-blue-700' };
  if (item.alertType === 'INQUIRY') return { label: '문의', className: 'bg-green-100 text-green-700' };
  return {
    label: item.claimType === 'EXCHANGE' ? '교환' : '반품',
    className: 'bg-orange-100 text-orange-700',
  };
}

/**
 * 알림 → 이동 목적지 (PLAN D9). 🔴 목적지 규칙은 이 함수 하나에만 둔다.
 *
 * - 문의: 이미 있는 상세 페이지
 * - 반품/교환: 전용 상세 페이지가 없다 → 쿼리로 컨테이너가 모달을 연다
 * - 새 주문: 출고관리의 기존 주문번호 칩 검색을 URL 로 채운다
 */
export function alertHref(item: AlertFeedItem): string {
  switch (item.alertType) {
    case 'INQUIRY':
      return `${ROUTES.ORDERS_INQUIRIES}/${item.refId}`;
    case 'CLAIM':
      return `${ROUTES.ORDERS_CLAIMS}?claimId=${item.refId}&type=${item.claimType ?? 'RETURN'}`;
    case 'ORDER':
      return `${ROUTES.ORDERS_SHIPMENT}?orderNo=${encodeURIComponent(item.externalOrderId ?? '')}`;
  }
}

export interface AlertRowProps {
  item: AlertFeedItem;
  /** 행 전체가 클릭 영역이다. 이동은 부모가 한다(말풍선은 이동 후 닫아야 하므로). */
  onNavigate: (item: AlertFeedItem) => void;
}

export function AlertRow({ item, onNavigate }: AlertRowProps) {
  const chip = chipOf(item);
  // `상품 1개` 는 소음이라 2개 이상일 때만 붙인다 — 이 줄이 메뉴 배지(상품 수)와 알림 수(주문 수)가
  // 왜 다른지를 화면에서 설명한다(D7).
  const countLabel = item.itemCount != null && item.itemCount > 1 ? `상품 ${item.itemCount}개` : null;
  const meta = [item.platform, item.sellerName, formatMarketRelativeTime(item.occurredAt)]
    .filter(Boolean)
    .join(' · ');

  return (
    <button
      type="button"
      onClick={() => onNavigate(item)}
      className="w-full px-4 py-3 text-left border-b border-gray-100 last:border-b-0 hover:bg-gray-50 transition-colors"
    >
      <div className="flex items-center gap-2 min-w-0">
        <span className={`shrink-0 rounded px-1.5 py-0.5 text-xs font-semibold ${chip.className}`}>
          {chip.label}
        </span>
        <span className="flex-1 truncate text-sm font-medium text-gray-900">
          {item.itemName ?? '상품명 없음'}
          {countLabel && <span className="ml-2 text-xs font-normal text-gray-500">{countLabel}</span>}
        </span>
      </div>
      <div className="mt-1 text-xs text-gray-500">{meta}</div>
      {item.detail && (
        <div className="mt-1 text-xs text-gray-600 line-clamp-2">{item.detail}</div>
      )}
    </button>
  );
}
