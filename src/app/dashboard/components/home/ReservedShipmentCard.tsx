'use client';

import { useCallback, useMemo } from 'react';
import { DASHBOARD_CARD_SPECS } from '@/config/dashboardGrid';
import { ShippingLabelUseCase } from '@/application/usecases/ShippingLabelUseCase';
import { ShippingLabelRepositoryImpl } from '@/infrastructure/repositories/ShippingLabelRepositoryImpl';
import type { ReservedItemResult } from '@/application/dto/ShippingLabelDTOs';
import { CardBody, DashboardCardFrame } from './DashboardCardFrame';
import { useCardData } from './useCardData';

interface ReservedShipmentCardProps {
  editing: boolean;
  onRemove: () => void;
}

const spec = DASHBOARD_CARD_SPECS.RESERVED_SHIPMENTS;

/** The four counts and the row results each one adds up (D29). */
const BUCKETS: { label: string; results: ReservedItemResult[] }[] = [
  { label: '예약됨', results: ['PENDING'] },
  { label: '실행완료', results: ['SUCCEEDED', 'EXTERNAL'] },
  { label: '실패', results: ['FAILED'] },
  { label: '중지/취소', results: ['CANCELLED', 'RELEASED'] },
];

/**
 * C8 「예약 발송」 (FEATURE_2610_29 D27 · D29) — the rows of the reserved shipment list (one row = one order box, open
 * rows + rows finished in the last 7 days, the same list as the shipment screen), counted by result. A failure count
 * above 0 is drawn in the failure colour.
 */
export function ReservedShipmentCard({ editing, onRemove }: ReservedShipmentCardProps) {
  const useCase = useMemo(() => new ShippingLabelUseCase(new ShippingLabelRepositoryImpl()), []);
  const load = useCallback(async () => {
    const rows = await useCase.getReservedShipments();
    return BUCKETS.map((bucket) => ({
      label: bucket.label,
      count: rows.filter((row) => bucket.results.includes(row.result)).length,
    }));
  }, [useCase]);
  const data = useCardData(load);

  return (
    <DashboardCardFrame title={spec.title} href={spec.href} editing={editing} onRemove={onRemove}>
      <CardBody data={data}>
        {(counts) => (
          <div className="grid grid-cols-4 gap-2">
            {counts.map((entry) => (
              <div key={entry.label} className="min-w-0">
                <p className="truncate text-xs text-gray-500">{entry.label}</p>
                <p
                  className={`text-xl font-bold ${
                    entry.label === '실패' && entry.count > 0 ? 'text-red-600' : 'text-gray-900'
                  }`}
                >
                  {entry.count.toLocaleString('ko-KR')}
                </p>
              </div>
            ))}
          </div>
        )}
      </CardBody>
    </DashboardCardFrame>
  );
}
