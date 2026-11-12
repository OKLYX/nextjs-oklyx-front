'use client';

import { useState } from 'react';
import { Spinner } from '@/presentation/components/Spinner';
import { Button } from '@/presentation/components/ui/Button';
import type { OrderUseCase } from '@/application/usecases/OrderUseCase';
import type { CancelReasonOption } from '@/application/dto/OrderDTOs';
import { extractErrorMessage } from '@/infrastructure/utils/errorMessage';

/**
 * [발송 약정일 안내] of one LotteON order (FEATURE_2611_23 / D26 · R55).
 *
 * **Purpose**: tells LotteON a new promised shipping date with one of the delay reasons (LotteON's own names, from
 * the order detail's server list) and, for the making delay, one of its detail reasons. The server sends it for
 * every paid / preparing line of the same order.
 * **File**: src/app/dashboard/orders/components/LotteonDeliveryAppointmentForm.tsx
 *
 * ⚠️ The screen does not limit the date range — LotteON answers with its own wording (R25).
 * ⚠️ Sending again is not blocked here.
 * ❌ No code→label constant — only the making-delay code below, which decides whether the detail reason is needed.
 * ❌ The two 11st notice lines (penalty · e-mail and SMS) are not carried over (R55).
 *
 * @example
 * <LotteonDeliveryAppointmentForm orderItemId={order.id} reasons={lotteonChoices?.appointmentReasons ?? []}
 *   detailReasons={lotteonChoices?.appointmentDetailReasons ?? []} reasonsFailed={lotteonChoicesFailed}
 *   orderUseCase={orderUseCase} />
 */
interface LotteonDeliveryAppointmentFormProps {
  orderItemId: number;
  reasons: CancelReasonOption[];
  detailReasons: CancelReasonOption[];
  reasonsFailed: boolean;
  orderUseCase: OrderUseCase;
}

/** The making-delay reason code — the only one that needs a detail reason (§3-4 contract value). */
const LOTTEON_MAKING_DELAY_CODE = 'PD_DL';
const SENT_MESSAGE = '발송 약정일 안내를 보냈습니다.';

export function LotteonDeliveryAppointmentForm({
  orderItemId,
  reasons,
  detailReasons,
  reasonsFailed,
  orderUseCase,
}: LotteonDeliveryAppointmentFormProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [appointmentDate, setAppointmentDate] = useState('');
  const [reasonCode, setReasonCode] = useState('');
  const [detailCode, setDetailCode] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isSent, setIsSent] = useState(false);
  const [error, setError] = useState('');

  const needsDetail = reasonCode === LOTTEON_MAKING_DELAY_CODE;
  const isReady = appointmentDate !== '' && reasonCode !== '' && (!needsDetail || detailCode !== '') && !isSending;

  const send = async () => {
    try {
      setIsSending(true);
      setError('');
      setIsSent(false);
      await orderUseCase.sendLotteonDeliveryAppointment(orderItemId, {
        appointmentDate,
        reasonCode,
        detailCode: needsDetail ? detailCode : null,
      });
      setIsSent(true);
    } catch (err) {
      setError(extractErrorMessage(err, '발송 약정일 안내에 실패했습니다. 다시 시도해주세요.'));
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="mt-6 border-t border-gray-200 pt-6">
      <Button variant="secondary" onClick={() => setIsOpen((open) => !open)} disabled={isSending}>
        발송 약정일 안내
      </Button>
      {isOpen && (
        <div className="mt-4 flex flex-col gap-3">
          <input
            type="date"
            value={appointmentDate}
            onChange={(e) => { setAppointmentDate(e.target.value); setError(''); }}
            disabled={isSending}
            className="w-48 px-3 py-2 border border-gray-300 rounded-lg text-sm disabled:bg-gray-100"
          />
          <select
            value={reasonCode}
            onChange={(e) => { setReasonCode(e.target.value); setError(''); }}
            disabled={isSending}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm disabled:bg-gray-100"
          >
            <option value="" disabled>지연 사유를 선택하세요</option>
            {reasons.map((reason) => (
              <option key={reason.code} value={reason.code}>{reason.label}</option>
            ))}
          </select>
          {needsDetail && (
            <select
              value={detailCode}
              onChange={(e) => { setDetailCode(e.target.value); setError(''); }}
              disabled={isSending}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm disabled:bg-gray-100"
            >
              <option value="" disabled>상세 사유를 선택하세요</option>
              {detailReasons.map((reason) => (
                <option key={reason.code} value={reason.code}>{reason.label}</option>
              ))}
            </select>
          )}
          {reasonsFailed && <p className="text-sm text-gray-500">사유 목록을 불러오지 못했습니다.</p>}
          <div>
            <Button variant="primary" disabled={!isReady} onClick={() => void send()}>
              {isSending ? <Spinner label="전송 중..." /> : '보내기'}
            </Button>
          </div>
          {isSent && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-green-800 text-sm">{SENT_MESSAGE}</div>
          )}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-800 text-sm">{error}</div>
          )}
        </div>
      )}
    </div>
  );
}
