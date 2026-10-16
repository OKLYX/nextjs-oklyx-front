'use client';

import { useState } from 'react';
import { Spinner } from '@/presentation/components/Spinner';
import { Button } from '@/presentation/components/ui/Button';
import { ConfirmDialog } from '@/presentation/components/ui/ConfirmDialog';
import type { OrderUseCase } from '@/application/usecases/OrderUseCase';
import type { CancelReasonOption, OrderCancelResult } from '@/application/dto/OrderDTOs';
import { extractErrorMessage } from '@/infrastructure/utils/errorMessage';

/**
 * [주문 취소] of one 11st order line — 11st sale refusal 1638 (FEATURE_2610_17 / D61).
 *
 * **Purpose**: the seller cancels the **whole line** on 11st (11st has no quantity field). Input = one of the six
 * reasons (11st's own names, from `GET /api/orders/elevenst-choices`) + the reason text (1~200 characters).
 * **File**: src/app/dashboard/orders/components/ElevenstSaleRefusalForm.tsx
 *
 * ⚠️ The line does not change here — the next sync reads the 11st cancel and shows it as cancelled (D14).
 * ⚠️ Irreversible → the two-step confirm carries the buyer-consent line and, for any reason other than 10
 * 「고객변심」, the seller-score line.
 * ❌ Do not use it for Coupang lines — the Coupang cancel stays the quantity form of the order detail.
 *
 * @example
 * <ElevenstSaleRefusalForm orderItemId={order.id} quantity={order.orderCount} purchasableQty={order.purchasableQty}
 *   reasons={elevenstChoices?.cancelReasons ?? []} reasonsFailed={choicesFailed} orderUseCase={orderUseCase}
 *   onSent={() => setReservationChanged(true)} />
 */
interface ElevenstSaleRefusalFormProps {
  orderItemId: number;
  /** The whole line quantity (order count) shown in the confirm. */
  quantity: number;
  /** Sent as the request line quantity only (the server needs 1 or more); 11st cancels the whole line. */
  purchasableQty: number;
  reasons: CancelReasonOption[];
  reasonsFailed: boolean;
  orderUseCase: OrderUseCase;
  /** Called after 11st accepted, so the parent refetches the order list on close. */
  onSent: () => void;
}

const MAX_REASON_LENGTH = 200;
/** Reason 10 「고객변심」 costs no seller score (D61). */
const CUSTOMER_CHANGE = '10';
const SENT_MESSAGE = '11번가에 취소를 보냈습니다. 다음 동기화 뒤 취소로 표시됩니다.';

export function ElevenstSaleRefusalForm({
  orderItemId,
  quantity,
  purchasableQty,
  reasons,
  reasonsFailed,
  orderUseCase,
  onSent,
}: ElevenstSaleRefusalFormProps) {
  const [reasonCode, setReasonCode] = useState('');
  const [reasonText, setReasonText] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [result, setResult] = useState<OrderCancelResult | null>(null);
  const [error, setError] = useState('');

  const trimmedText = reasonText.trim();
  const isSent = result != null && result.cancelled.length > 0;
  const isReady = reasonCode !== '' && trimmedText.length >= 1 && trimmedText.length <= MAX_REASON_LENGTH
    && !isSending && !isSent && purchasableQty > 0;

  const send = async () => {
    try {
      setIsSending(true);
      setError('');
      const response = await orderUseCase.cancelElevenstLine(orderItemId, purchasableQty, reasonCode, trimmedText);
      setResult(response);
      if (response.cancelled.length > 0) onSent();
    } catch (err) {
      setError(extractErrorMessage(err, '주문 취소에 실패했습니다. 다시 시도해주세요.'));
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="mt-4 flex flex-col gap-3">
      <select
        value={reasonCode}
        onChange={(e) => { setReasonCode(e.target.value); setError(''); }}
        disabled={isSending || isSent}
        className="px-3 py-2 border border-gray-300 rounded-lg text-sm disabled:bg-gray-100"
      >
        <option value="" disabled>사유를 선택하세요</option>
        {reasons.map((reason) => (
          <option key={reason.code} value={reason.code}>{reason.label}</option>
        ))}
      </select>
      {reasonsFailed && <p className="text-sm text-gray-500">사유 목록을 불러오지 못했습니다.</p>}
      <textarea
        value={reasonText}
        maxLength={MAX_REASON_LENGTH}
        onChange={(e) => { setReasonText(e.target.value); setError(''); }}
        disabled={isSending || isSent}
        placeholder="사유 글 (1~200자)"
        rows={3}
        className="px-3 py-2 border border-gray-300 rounded-lg text-sm disabled:bg-gray-100"
      />
      <div>
        <Button variant="danger" disabled={!isReady} onClick={() => setConfirmOpen(true)}>
          {isSending ? <Spinner label="전송 중..." /> : '주문 취소'}
        </Button>
      </div>
      {isSent && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-green-800 text-sm">{SENT_MESSAGE}</div>
      )}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-800 text-sm">{error}</div>
      )}
      {/* 11st's own code and wording, as given (D61). */}
      {result != null && result.failed.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-800 text-sm">
          {result.failed.map((line) => (
            <p key={line.orderItemId}>{line.code}: {line.message}</p>
          ))}
        </div>
      )}
      {result != null && result.skipped.length > 0 && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-gray-700 text-sm">
          {result.skipped.map((line) => (
            <p key={line.orderItemId}>{line.reason}</p>
          ))}
        </div>
      )}
      <ConfirmDialog
        isOpen={confirmOpen}
        nested
        title="주문 취소"
        message={
          <>
            <p>구매자 동의를 받은 뒤 진행하세요.</p>
            <p>이 주문 줄 전체({quantity}개)를 11번가에서 취소합니다. 되돌릴 수 없습니다.</p>
            {reasonCode !== CUSTOMER_CHANGE && <p>판매자 사유 취소는 11번가 판매자 신용점수가 1점 깎일 수 있습니다.</p>}
          </>
        }
        confirmText="주문 취소"
        isDangerous
        onConfirm={() => { setConfirmOpen(false); void send(); }}
        onCancel={() => setConfirmOpen(false)}
      />
    </div>
  );
}
