'use client';

import { useEffect, useMemo, useState } from 'react';
import { StockLotUseCase } from '@/application/usecases/StockLotUseCase';
import { StockLotRepositoryImpl } from '@/infrastructure/repositories/StockLotRepositoryImpl';
import {
  FILL_BUTTON_LABEL,
  NO_FILL_LOT_MESSAGE,
  fillLotLabel,
  type FillLot,
  type StockDailyRow,
} from '@/domain/entities/StockLotEntity';
import { extractErrorMessage } from '@/infrastructure/utils/errorMessage';
import { Button } from '@/presentation/components/ui/Button';
import { Modal } from '@/presentation/components/ui/Modal';

/**
 * [입고로 채우기] of 「일별 입출고 내역」 (FEATURE_2611_22 D3 ② · D15 · D27): an order outbound row without a lot.
 *
 * - 「입고」 = the lots of that product with a piece left (`fillLotLabel`, day then record order), the first one picked;
 *   none → `NO_FILL_LOT_MESSAGE` and only [닫기].
 * - 「개수」 starts at the smaller of the row's empty pieces and the picked lot's pieces, and again on every lot pick.
 * - [채우기] → `onSaved`; a refusal (count over the lot or the row — D15) stays with the server text.
 */

const FORM_ID = 'row-fill-form';
const LABEL_CLASS = 'block text-sm font-medium text-gray-700 mb-1';

interface RowFillModalProps {
  /** The row; null = closed. */
  row: StockDailyRow | null;
  onClose: () => void;
  onSaved: () => void | Promise<void>;
}

export function RowFillModal({ row, onClose, onSaved }: RowFillModalProps) {
  const lotUseCase = useMemo(() => new StockLotUseCase(new StockLotRepositoryImpl()), []);
  const [lots, setLots] = useState<FillLot[] | null>(null);
  const [lotId, setLotId] = useState('');
  const [quantity, setQuantity] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Every opening loads the lots again. Inline async IIFE defers setState past the sync effect body
  // (set-state-in-effect lint).
  useEffect(() => {
    if (!row) return;
    void (async () => {
      setLots(null);
      setError('');
      try {
        const loaded = await lotUseCase.fillLots(row.movementId);
        setLots(loaded);
        setLotId(loaded.length > 0 ? String(loaded[0].lotId) : '');
        setQuantity(loaded.length > 0 ? String(Math.min(-row.quantity, loaded[0].quantity)) : '');
      } catch (err) {
        setLots([]);
        setError(extractErrorMessage(err, '입고를 불러오지 못했습니다.'));
      }
    })();
  }, [row, lotUseCase]);

  if (!row) return null;

  const pickLot = (value: string) => {
    setLotId(value);
    const picked = lots?.find((lot) => String(lot.lotId) === value);
    if (picked) setQuantity(String(Math.min(-row.quantity, picked.quantity)));
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setIsSubmitting(true);
    try {
      await lotUseCase.fill({
        fills: [{ lotId: Number(lotId), lines: [{ movementId: row.movementId, quantity: Number(quantity) }] }],
      });
      await onSaved();
    } catch (err) {
      setError(extractErrorMessage(err, '채우지 못했습니다.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const hasLots = lots !== null && lots.length > 0;

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={FILL_BUTTON_LABEL}
      disableClose={isSubmitting}
      footer={
        hasLots ? (
          <>
            <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
              취소
            </Button>
            <Button type="submit" form={FORM_ID} isLoading={isSubmitting} loadingText="저장 중...">
              채우기
            </Button>
          </>
        ) : (
          <Button variant="secondary" onClick={onClose}>
            닫기
          </Button>
        )
      }
    >
      <form id={FORM_ID} onSubmit={(e) => void submit(e)} className="space-y-4">
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">{error}</div>
        )}
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
          <dt className="text-gray-500">주문번호</dt>
          <dd className="text-gray-900">{row.orderNumber ?? '-'}</dd>
          <dt className="text-gray-500">상품</dt>
          <dd className="text-gray-900">{row.productName}</dd>
          <dt className="text-gray-500">빈 개수</dt>
          <dd className="text-gray-900">{-row.quantity}</dd>
        </dl>
        {lots !== null && lots.length === 0 && !error && (
          <p className="text-sm text-gray-500">{NO_FILL_LOT_MESSAGE}</p>
        )}
        {hasLots && (
          <>
            <div>
              <label className={LABEL_CLASS}>입고</label>
              <select
                value={lotId}
                onChange={(e) => pickLot(e.target.value)}
                disabled={isSubmitting}
                className="px-2 py-1 border border-gray-300 rounded text-sm bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                {lots.map((lot) => (
                  <option key={lot.lotId} value={lot.lotId}>
                    {fillLotLabel(lot.movedOn, lot.sellerName, lot.quantity)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={LABEL_CLASS}>개수</label>
              <input
                type="number"
                min={1}
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                disabled={isSubmitting}
                className="w-24 px-2 py-1 border border-gray-300 rounded text-sm text-right focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </>
        )}
      </form>
    </Modal>
  );
}
