'use client';

import { ClipboardCheck, Clock } from 'lucide-react';
import { INTERNAL_STAGE_LABELS } from '@/domain/entities/OrderEntity';
import type { InternalStage } from '@/domain/entities/OrderEntity';

const STAGE_STYLE: Record<InternalStage, string> = {
  INTERNAL_PREPARING: 'border-blue-200 bg-blue-50 text-blue-700',
  AWAITING_SHIPMENT: 'border-amber-200 bg-amber-50 text-amber-900',
};

/**
 * 내부 단계 배지 — 「내부 상품준비중」·「발송대기중」(FEATURE_2609_75 / D9·D10·D11).
 *
 * **용도**: 주문 목록(주문내역·출고관리 공용 `OrderTable`)과 주문 상세가 같은 모양으로 그린다.
 * **파일**: src/app/dashboard/orders/components/InternalStageBadge.tsx
 * ⚠️ 문구는 `INTERNAL_STAGE_LABELS` 에서만 온다 — 여기서 글자를 새로 쓰지 않는다.
 * ❌ `status`(쿠팡 상태)로 판정하지 않는다. `stage` 가 null 이면 아무것도 그리지 않는다.
 *
 * @example <InternalStageBadge stage={order.internalStage} />
 */
export function InternalStageBadge({ stage }: { stage: InternalStage | null }) {
  if (stage == null) return null;
  const Icon = stage === 'INTERNAL_PREPARING' ? ClipboardCheck : Clock;
  return (
    <span
      className={`ml-2 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium whitespace-nowrap ${STAGE_STYLE[stage]}`}
    >
      <Icon size={12} aria-hidden />
      {INTERNAL_STAGE_LABELS[stage]}
    </span>
  );
}
