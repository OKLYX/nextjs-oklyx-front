'use client';

import { useState } from 'react';
import { Spinner } from '@/presentation/components/Spinner';
import { Button } from '@/presentation/components/ui/Button';
import { ConfirmDialog } from '@/presentation/components/ui/ConfirmDialog';
import type { OrderUseCase } from '@/application/usecases/OrderUseCase';
import type { CancelReasonOption, OrderCancelResult } from '@/application/dto/OrderDTOs';
import { extractErrorMessage } from '@/infrastructure/utils/errorMessage';

/**
 * [주문 취소] of one LotteON order line — the seller cancel (FEATURE_2611_23 / D25 · R53).
 *
 * **Purpose**: the seller cancels the **whole line** on LotteON (no quantity field). Input = one of the five
 * reasons (LotteON's own names, from the order detail's server list) + an optional reason text (up to 200).
 * **File**: src/app/dashboard/orders/components/LotteonSellerCancelForm.tsx
 *
 * ⚠️ The line does not change here — the next sync reads the LotteON cancel and shows it as cancelled (R26).
 * ⚠️ Irreversible → a two-step confirm. The 11st buyer-consent and seller-score lines are not carried over (R53).
 * ❌ Do not use it for Coupang or 11st lines — they keep their own cancel forms.
 *
 * @example
 * <LotteonSellerCancelForm orderItemId={order.id} quantity={order.orderCount} purchasableQty={order.purchasableQty}
 *   reasons={lotteonChoices?.cancelReasons ?? []} reasonsFailed={lotteonChoicesFailed} orderUseCase={orderUseCase}
 *   onSent={() => setReservationChanged(true)} />
 */
interface LotteonSellerCancelFormProps {
  orderItemId: number;
  /** The whole line quantity (order count) shown in the confirm. */
  quantity: number;
  /** Sent as the request line quantity (the line's remaining quantity); LotteON cancels the whole line. */
  purchasableQty: number;
  reasons: CancelReasonOption[];
  reasonsFailed: boolean;
  orderUseCase: OrderUseCase;
  /** Called after LotteON accepted, so the parent refetches the order list on close. */
  onSent: () => void;
}

const MAX_REASON_LENGTH = 200;
const SENT_MESSAGE = '롯데ON 에 취소를 보냈습니다. 다음 동기화 뒤 취소로 표시됩니다.';

export function LotteonSellerCancelForm({
  orderItemId,
  quantity,
  purchasableQty,
  reasons,
  reasonsFailed,
  orderUseCase,
  onSent,
}: LotteonSellerCancelFormProps) {
  const [reasonCode, setReasonCode] = useState('');
  const [reasonText, setReasonText] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [result, setResult] = useState<OrderCancelResult | null>(null);
  const [error, setError] = useState('');

  const isSent = result != null && result.cancelled.length > 0;
  const isReady = reasonCode !== '' && purchasableQty >= 1 && !isSending && !isSent;

  const send = async () => {
    try {
      setIsSending(true);
      setError('');
      // An empty text goes as an empty text — the server stores it as null (R53).
      const response = await orderUseCase.cancelLotteonLine(orderItemId, purchasableQty, reasonCode, reasonText.trim());
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
        placeholder="사유 글 (선택, 200자까지)"
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
      {/* LotteON's own code and wording, as given (D25). */}
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
        message={<p>이 주문 줄 전체({quantity}개)를 롯데ON 에서 취소합니다. 되돌릴 수 없습니다.</p>}
        confirmText="주문 취소"
        isDangerous
        onConfirm={() => { setConfirmOpen(false); void send(); }}
        onCancel={() => setConfirmOpen(false)}
      />
    </div>
  );
}
