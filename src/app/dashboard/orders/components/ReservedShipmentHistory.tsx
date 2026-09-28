'use client';

import { useEffect, useState } from 'react';
import type { ShippingLabelUseCase } from '@/application/usecases/ShippingLabelUseCase';
import type { ReservedShipmentRow } from '@/application/dto/ShippingLabelDTOs';
import { ReservedShipmentRows } from './ReservedShipmentRows';

interface ReservedShipmentHistoryProps {
  useCase: ShippingLabelUseCase;
  externalOrderId: string;
  /** 행 작업이 성공하면 부른다 — 부모가 닫힐 때 목록을 다시 불러오게 표시한다. */
  onChanged: () => void;
}

/**
 * 주문 상세 「예약 발송 기록」 (FEATURE_2609_75 / D30).
 *
 * **용도**: 이 주문의 예정 시각·실행 시각·결과(기간 제한 없음) + 행 작업([시각 변경]·[다시 시도]·[예약 취소]).
 * 표는 `ReservedShipmentRows` 를 그대로 쓴다. [송장 수정]은 여기서 그리지 않는다(`carrierOptions={[]}`) —
 * 주문 상세의 송장 수정 자리는 「송장」(`StoredInvoiceEditor`) 하나다(D18).
 * **파일**: src/app/dashboard/orders/components/ReservedShipmentHistory.tsx
 * ⚠️ 기록이 없거나 불러오지 못하면 아무것도 그리지 않는다(예약을 쓰지 않는 주문이 대부분이다).
 * ⚠️ ADMIN·쿠팡 주문일 때만 부모가 렌더한다.
 */
export function ReservedShipmentHistory({ useCase, externalOrderId, onChanged }: ReservedShipmentHistoryProps) {
  const [rows, setRows] = useState<ReservedShipmentRow[]>([]);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const list = await useCase.getReservedShipmentsByOrder(externalOrderId);
        if (alive) setRows(list);
      } catch {
        if (alive) setRows([]);
      }
    })();
    return () => { alive = false; };
  }, [useCase, externalOrderId, tick]);

  if (rows.length === 0) return null;

  return (
    <div className="mt-6 border-t border-gray-200 pt-6">
      <h4 className="text-sm font-semibold text-gray-900 mb-2">예약 발송 기록</h4>
      <ReservedShipmentRows
        rows={rows}
        useCase={useCase}
        carrierOptions={[]}
        onChanged={() => {
          setTick((t) => t + 1);
          onChanged();
        }}
      />
    </div>
  );
}
