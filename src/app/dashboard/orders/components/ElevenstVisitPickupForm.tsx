'use client';

import { useState } from 'react';
import { Spinner } from '@/presentation/components/Spinner';
import { Button } from '@/presentation/components/ui/Button';
import { ConfirmDialog } from '@/presentation/components/ui/ConfirmDialog';
import type { OrderUseCase } from '@/application/usecases/OrderUseCase';
import { extractErrorMessage } from '@/infrastructure/utils/errorMessage';

/**
 * [방문수령 완료] of an 11st visit-pickup order — 7052 (FEATURE_2610_17 / D66).
 *
 * **Purpose**: shown instead of the invoice form when the buyer picks the goods up in person. Sends the code the
 * buyer gave (trimmed only, no format check); 11st marks it shipped and delivered at once.
 * **File**: src/app/dashboard/orders/components/ElevenstVisitPickupForm.tsx
 *
 * ⚠️ Irreversible → two-step confirm 「구매자가 상품을 받아 갔으면 완료하세요. 되돌릴 수 없습니다.」.
 * ⚠️ A wrong code comes back as 11st's own wording (−1001 / −1002).
 *
 * @example
 * <ElevenstVisitPickupForm orderItemId={order.id} orderUseCase={orderUseCase}
 *   onDone={() => setReservationChanged(true)} />
 */
interface ElevenstVisitPickupFormProps {
  orderItemId: number;
  orderUseCase: OrderUseCase;
  /** Called after 11st accepted, so the parent refetches the order list on close. */
  onDone: () => void;
}

const DONE_MESSAGE = '방문수령 완료를 보냈습니다.';

export function ElevenstVisitPickupForm({ orderItemId, orderUseCase, onDone }: ElevenstVisitPickupFormProps) {
  const [certCode, setCertCode] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isDone, setIsDone] = useState(false);
  const [error, setError] = useState('');

  const send = async () => {
    try {
      setIsSending(true);
      setError('');
      await orderUseCase.completeElevenstVisitPickup(orderItemId, certCode.trim());
      setIsDone(true);
      onDone();
    } catch (err) {
      setError(extractErrorMessage(err, '방문수령 완료에 실패했습니다. 다시 시도해주세요.'));
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="mt-4 flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <input
          type="text"
          maxLength={50}
          placeholder="방문수령 인증번호"
          value={certCode}
          onChange={(e) => { setCertCode(e.target.value); setError(''); }}
          disabled={isSending || isDone}
          className="w-56 px-3 py-2 border border-gray-300 rounded-lg text-sm disabled:bg-gray-100"
        />
        <Button variant="primary" disabled={isSending || isDone || certCode.trim() === ''}
          onClick={() => setConfirmOpen(true)}>
          {isSending ? <Spinner label="전송 중..." /> : '방문수령 완료'}
        </Button>
      </div>
      {isDone && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-green-800 text-sm">{DONE_MESSAGE}</div>
      )}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-800 text-sm">{error}</div>
      )}
      <ConfirmDialog
        isOpen={confirmOpen}
        nested
        title="방문수령 완료"
        message="구매자가 상품을 받아 갔으면 완료하세요. 되돌릴 수 없습니다."
        confirmText="방문수령 완료"
        isDangerous
        onConfirm={() => { setConfirmOpen(false); void send(); }}
        onCancel={() => setConfirmOpen(false)}
      />
    </div>
  );
}
