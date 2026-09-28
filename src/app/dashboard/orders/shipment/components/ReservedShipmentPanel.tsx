'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/presentation/components/ui/Card';
import { StateBlock } from '@/presentation/components/ui/StateBlock';
import type { ShippingLabelUseCase } from '@/application/usecases/ShippingLabelUseCase';
import type { CarrierOption, ReservedShipmentRow } from '@/application/dto/ShippingLabelDTOs';
import { extractErrorMessage } from '@/infrastructure/utils/errorMessage';
import { ReservedShipmentRows } from '../../components/ReservedShipmentRows';

interface ReservedShipmentPanelProps {
  useCase: ShippingLabelUseCase;
  /** 부모가 올리면 다시 불러온다(업로드·예약 취소 뒤). */
  reloadKey: number;
  /** 행 작업이 끝나면 부르는 콜백 — 부모가 주문 목록을 다시 불러온다. */
  onChanged: () => void;
}

/**
 * 출고관리 「예약 발송」 현황 (FEATURE_2609_75 / D15·D16·D18·D30).
 *
 * **용도**: 끝나지 않은 주문 전부 + 끝난 주문 최근 7일(서버 범위). 한 줄 = 주문 1개 — 표와 행 작업은 `ReservedShipmentRows`.
 * **파일**: src/app/dashboard/orders/shipment/components/ReservedShipmentPanel.tsx
 * ⚠️ ADMIN 전용 — 부모가 isAdmin 일 때만 렌더한다. useCase 는 부모 인스턴스를 받는다(새로 만들지 않는다).
 */
export function ReservedShipmentPanel({ useCase, reloadKey, onChanged }: ReservedShipmentPanelProps) {
  const [rows, setRows] = useState<ReservedShipmentRow[]>([]);
  const [carrierOptions, setCarrierOptions] = useState<CarrierOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const list = await useCase.getReservedShipments();
        if (!alive) return;
        setRows(list);
        setLoadError('');
      } catch (err) {
        if (alive) setLoadError(extractErrorMessage(err, '예약 발송을 불러오지 못했습니다.'));
      } finally {
        if (alive) setIsLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [useCase, reloadKey, tick]);

  // [송장 수정] 택배사 목록 — 실패하면 빈 목록(버튼이 숨는다).
  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const options = await useCase.getCarrierOptions('COUPANG');
        if (alive) setCarrierOptions(options);
      } catch {
        if (alive) setCarrierOptions([]);
      }
    })();
    return () => { alive = false; };
  }, [useCase]);

  const completed = rows.filter((row) => row.result === 'SUCCEEDED' || row.result === 'EXTERNAL').length;
  const failed = rows.filter((row) => row.result === 'FAILED').length;

  return (
    <Card title="예약 발송">
      {isLoading ? (
        <StateBlock variant="loading" message="불러오는 중..." />
      ) : loadError ? (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-800 text-sm">{loadError}</div>
      ) : rows.length === 0 ? (
        <p className="text-sm text-gray-500">예약 발송이 없습니다.</p>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-gray-700">
            {rows.length}건 중 {completed}건 완료, 실패 {failed}건
          </p>
          <ReservedShipmentRows
            rows={rows}
            useCase={useCase}
            carrierOptions={carrierOptions}
            onChanged={() => {
              setTick((t) => t + 1);
              onChanged();
            }}
          />
        </div>
      )}
    </Card>
  );
}
