'use client';

import { useEffect, useMemo, useState } from 'react';
import { StockLotUseCase } from '@/application/usecases/StockLotUseCase';
import { StockLotRepositoryImpl } from '@/infrastructure/repositories/StockLotRepositoryImpl';
import {
  NO_SOURCE_MESSAGE,
  RECEIPT_SHARE_DATE_MESSAGE,
  SOURCE_FIXED_MESSAGE,
  formatWonOrUnknown,
  goToIntakeLabel,
  movedMessage,
  unitPriceText,
  type StockDailyRow,
} from '@/domain/entities/StockLotEntity';
import { toast } from '@/infrastructure/stores/toastStore';
import { extractErrorMessage } from '@/infrastructure/utils/errorMessage';
import { Button } from '@/presentation/components/ui/Button';
import { Modal } from '@/presentation/components/ui/Modal';
import { DateEditHistory } from './DateEditHistory';

/**
 * The 「날짜 바꾸기」 window of 「일별 입출고 내역」 (FEATURE_2611_21 D9 · D17 · D20 · D21 · D24) — a row without a row
 * popup (order outbound · return · disposal · adjust − · undecided intake).
 *
 * - Read only: 「주문번호」 (order outbound) · 「상품」 · 「수량」 · 「단가」 · 「금액」. 「새 날짜」 starts at the screen
 *   day; [저장] with the same day closes the window without a request.
 * - An undecided row with a share on a receipt with its photo: the field is off with `RECEIPT_SHARE_DATE_MESSAGE` (D13).
 * - An outgoing row: with a lot → 「○월 ○일 입고로 이동」 (`onGoToIntake`), plus `SOURCE_FIXED_MESSAGE` when that lot has no
 *   value to fix · without a lot → `NO_SOURCE_MESSAGE` (D20).
 * - The row's day corrections below (D24).
 */

const FORM_ID = 'date-move-form';
const LABEL_CLASS = 'block text-sm font-medium text-gray-700 mb-1';

interface DateMoveModalProps {
  /** The row; null = closed. A new object on every click resets the field. */
  row: StockDailyRow | null;
  /** The screen day — the row's day now. */
  date: string;
  onClose: () => void;
  onSaved: () => void | Promise<void>;
  /** 「○월 ○일 입고로 이동」 (D19): the lot and its day. */
  onGoToIntake: (movementId: number, day: string) => void;
}

export function DateMoveModal({ row, date, onClose, onSaved, onGoToIntake }: DateMoveModalProps) {
  const lotUseCase = useMemo(() => new StockLotUseCase(new StockLotRepositoryImpl()), []);
  const [movedOn, setMovedOn] = useState(date);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Every opening starts from the screen day. Inline async IIFE defers setState past the sync effect body
  // (set-state-in-effect lint).
  useEffect(() => {
    if (!row) return;
    void (async () => {
      setMovedOn(date);
      setError('');
    })();
  }, [row, date]);

  if (!row) return null;

  const locked =
    row.undecidedLeft !== null && row.shares.some((share) => share.receiptKind === 'RECEIPT');
  const sourceMovementId = row.sourceMovementId;
  const sourceMovedOn = row.sourceMovedOn;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (movedOn === date) {
      onClose();
      return;
    }
    setError('');
    setIsSubmitting(true);
    try {
      await lotUseCase.moveDate({ movementId: row.movementId, newMovedOn: movedOn });
      toast.success(movedMessage(movedOn));
      await onSaved();
    } catch (err) {
      setError(extractErrorMessage(err, '저장하지 못했습니다.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen
      onClose={onClose}
      title="날짜 바꾸기"
      disableClose={isSubmitting}
      // The day lives in component state — tell the modal directly.
      isDirty={movedOn !== date}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
            취소
          </Button>
          <Button type="submit" form={FORM_ID} isLoading={isSubmitting} loadingText="저장 중...">
            저장
          </Button>
        </>
      }
    >
      <form id={FORM_ID} onSubmit={(e) => void submit(e)} className="space-y-4">
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
            {error}
          </div>
        )}

        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
          {row.orderNumber !== null && (
            <>
              <dt className="text-gray-500">주문번호</dt>
              <dd className="text-gray-900">{row.orderNumber}</dd>
            </>
          )}
          <dt className="text-gray-500">상품</dt>
          <dd className="text-gray-900">{row.productName}</dd>
          <dt className="text-gray-500">수량</dt>
          <dd className="text-gray-900">{row.quantity}</dd>
          <dt className="text-gray-500">단가</dt>
          <dd className="text-gray-900">{unitPriceText(row.unitPrices)}</dd>
          <dt className="text-gray-500">금액</dt>
          <dd className="text-gray-900">{formatWonOrUnknown(row.amount)}</dd>
        </dl>

        <div>
          <label className={LABEL_CLASS}>새 날짜</label>
          <input
            type="date"
            value={movedOn}
            onChange={(e) => {
              if (e.target.value) setMovedOn(e.target.value);
            }}
            disabled={isSubmitting || locked}
            className="px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          {locked && <p className="text-xs text-gray-500 mt-1">{RECEIPT_SHARE_DATE_MESSAGE}</p>}
        </div>

        {row.quantity < 0 && (
          <div className="space-y-1">
            {sourceMovementId !== null && sourceMovedOn !== null ? (
              <>
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={isSubmitting}
                  onClick={() => onGoToIntake(sourceMovementId, sourceMovedOn)}
                >
                  {goToIntakeLabel(sourceMovedOn)}
                </Button>
                {!row.sourcePriceEditable && (
                  <p className="text-xs text-gray-500">{SOURCE_FIXED_MESSAGE}</p>
                )}
              </>
            ) : (
              <p className="text-xs text-gray-500">{NO_SOURCE_MESSAGE}</p>
            )}
          </div>
        )}

        <DateEditHistory edits={row.dateEdits} />
      </form>
    </Modal>
  );
}
