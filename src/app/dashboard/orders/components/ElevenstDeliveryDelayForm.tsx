'use client';

import { useState } from 'react';
import { Spinner } from '@/presentation/components/Spinner';
import { Button } from '@/presentation/components/ui/Button';
import type { OrderUseCase } from '@/application/usecases/OrderUseCase';
import type { CancelReasonOption } from '@/application/dto/OrderDTOs';
import { extractErrorMessage } from '@/infrastructure/utils/errorMessage';

/**
 * [발송지연 안내] of one 11st delivery — 6728 (FEATURE_2610_17 / D63).
 *
 * **Purpose**: tells the buyer a new expected shipping date (tomorrow ~ today + 30 days, KST) with one of the five
 * delay reasons (11st's own names) and a detail text. 11st sends it to the buyer by e-mail and SMS.
 * **File**: src/app/dashboard/orders/components/ElevenstDeliveryDelayForm.tsx
 *
 * ⚠️ The detail text is 20~300 bytes in EUC-KR on 11st (−28307). The screen counts bytes the same way — a character
 * outside ASCII counts 2 — and blocks with 「상세 사유는 한글 10~150자로 적어 주세요.」.
 * ⚠️ Sending again to the same delivery is not blocked here — 11st answers with its own wording (D63).
 * ❌ No bulk button on the shipment page (D63).
 *
 * @example
 * <ElevenstDeliveryDelayForm orderItemId={order.id} reasons={elevenstChoices?.delayReasons ?? []}
 *   reasonsFailed={choicesFailed} orderUseCase={orderUseCase} />
 */
interface ElevenstDeliveryDelayFormProps {
  orderItemId: number;
  reasons: CancelReasonOption[];
  reasonsFailed: boolean;
  orderUseCase: OrderUseCase;
}

const MIN_BYTES = 20;
const MAX_BYTES = 300;
const MAX_DAYS = 30;
const BYTES_MESSAGE = '상세 사유는 한글 10~150자로 적어 주세요.';
const SENT_MESSAGE = '발송지연 안내를 보냈습니다.';

/** EUC-KR byte length as 11st counts it: ASCII 1 byte, anything else 2 bytes. */
function eucKrBytes(text: string): number {
  let bytes = 0;
  for (const ch of text) bytes += ch.charCodeAt(0) < 0x80 ? 1 : 2;
  return bytes;
}

/** Today + `days` as 'yyyy-MM-dd' in KST — the sv-SE locale prints exactly that shape. */
function kstDatePlus(days: number): string {
  const today = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' });
  const date = new Date(`${today}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function ElevenstDeliveryDelayForm({ orderItemId, reasons, reasonsFailed, orderUseCase }:
  ElevenstDeliveryDelayFormProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [expectedDate, setExpectedDate] = useState('');
  const [reasonCode, setReasonCode] = useState('');
  const [reasonText, setReasonText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isSent, setIsSent] = useState(false);
  const [error, setError] = useState('');

  const minDate = kstDatePlus(1);
  const maxDate = kstDatePlus(MAX_DAYS);
  const trimmedText = reasonText.trim();
  const bytes = eucKrBytes(trimmedText);
  const isBytesInvalid = trimmedText !== '' && (bytes < MIN_BYTES || bytes > MAX_BYTES);
  const isDateValid = expectedDate !== '' && expectedDate >= minDate && expectedDate <= maxDate;
  const isReady = isDateValid && reasonCode !== '' && trimmedText !== '' && !isBytesInvalid && !isSending;

  const send = async () => {
    try {
      setIsSending(true);
      setError('');
      setIsSent(false);
      await orderUseCase.sendElevenstDeliveryDelay(orderItemId, { expectedDate, reasonCode, reasonText: trimmedText });
      setIsSent(true);
    } catch (err) {
      setError(extractErrorMessage(err, '발송지연 안내에 실패했습니다. 다시 시도해주세요.'));
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="mt-6 border-t border-gray-200 pt-6">
      <Button variant="secondary" onClick={() => setIsOpen((open) => !open)} disabled={isSending}>
        발송지연 안내
      </Button>
      {isOpen && (
        <div className="mt-4 flex flex-col gap-3">
          <input
            type="date"
            value={expectedDate}
            min={minDate}
            max={maxDate}
            onChange={(e) => { setExpectedDate(e.target.value); setError(''); }}
            disabled={isSending}
            className="w-48 px-3 py-2 border border-gray-300 rounded-lg text-sm disabled:bg-gray-100"
          />
          <select
            value={reasonCode}
            onChange={(e) => { setReasonCode(e.target.value); setError(''); }}
            disabled={isSending}
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
            onChange={(e) => { setReasonText(e.target.value); setError(''); }}
            disabled={isSending}
            placeholder="상세 사유"
            rows={3}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm disabled:bg-gray-100"
          />
          {isBytesInvalid && <p className="text-sm text-red-600">{BYTES_MESSAGE}</p>}
          <p className="text-sm text-gray-500">
            예상 발송일까지는 지연 불이익이 없지만, 예상 발송일이 지나면 불이익이 생길 수 있습니다.
          </p>
          <p className="text-sm text-gray-500">구매자에게 이메일 · 문자로 안내됩니다.</p>
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
