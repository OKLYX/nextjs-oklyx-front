'use client';

import type { OutboundUnexpanded } from '@/domain/entities/StockEntity';
import { unexpandedReasonLabel } from '@/domain/entities/StockEntity';

interface OutboundUnexpandedSectionProps {
  items: OutboundUnexpanded[];
}

/**
 * 전개 불가 주문 라인 (FEATURE_2609_28 / PLAN D13).
 *
 * 🔴 접거나 숨기지 않는다. 이 섹션이 조용한 재고 오차를 막는 유일한 장치다 —
 * 여기 있는 라인은 무엇을 빼야 할지 모르는 상태라 서버도 확인을 거부한다(확인 버튼 없음).
 */
export function OutboundUnexpandedSection({ items }: OutboundUnexpandedSectionProps) {
  if (items.length === 0) return null;

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 space-y-2">
      <h2 className="text-sm font-semibold text-amber-900">⚠ 전개 불가 {items.length}건</h2>
      <p className="text-xs text-amber-800">
        구성 물품을 알 수 없어 출고를 기록할 수 없습니다. 옵션 연결을 고친 뒤 다시 조회하세요.
      </p>
      <ul className="space-y-1">
        {items.map((item) => (
          <li key={item.orderLineId} className="text-sm text-amber-900">
            <span className="font-medium">{item.externalOrderId}</span>{' '}
            <span>{item.itemName ?? '—'}</span>{' '}
            <span className="text-amber-700">
              — {unexpandedReasonLabel(item.reason)} ({item.reason})
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
