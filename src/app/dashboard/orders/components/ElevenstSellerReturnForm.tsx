'use client';

import { useEffect, useState } from 'react';
import { Spinner } from '@/presentation/components/Spinner';
import { Button } from '@/presentation/components/ui/Button';
import { ConfirmDialog } from '@/presentation/components/ui/ConfirmDialog';
import type { OrderUseCase } from '@/application/usecases/OrderUseCase';
import type { CancelReasonOption, ElevenstSellerReturnPayload } from '@/application/dto/OrderDTOs';
import type { CarrierOption } from '@/application/dto/ShippingLabelDTOs';
import { extractErrorMessage } from '@/infrastructure/utils/errorMessage';

/**
 * [판매자가 대신 반품 신청] of one shipped 11st order line (FEATURE_2610_17 / D35 · D36 · D39 ⑤ — API 1653).
 *
 * **Purpose**: the seller files the return for the buyer (after the buyer agreed). The whole line quantity is
 * returned. Reason codes come from the server (13 original names); the reason text is 1~200 characters.
 * **File**: src/app/dashboard/orders/components/ElevenstSellerReturnForm.tsx
 *
 * ⚠️ Carrier and invoice go together or not at all — one of them alone blocks [신청] with
 * 「택배사와 송장번호를 함께 넣어 주세요.」 (D39 ⑤).
 * ⚠️ 「신청하면서 바로 반품완료」 asks once more before sending (D36) — it refunds at once on 11st.
 * ❌ No claim number comes back — do not try to open the claim screen; it shows up after the next sync.
 *
 * @example
 * <ElevenstSellerReturnForm orderItemId={order.id} quantity={order.orderCount}
 *   orderUseCase={orderUseCase} carrierOptions={carrierOptions} />
 */
interface ElevenstSellerReturnFormProps {
  orderItemId: number;
  /** The whole line quantity (order count) — the notice says it all goes back. */
  quantity: number;
  orderUseCase: OrderUseCase;
  /** The 11st carrier list the order detail already loaded. */
  carrierOptions: CarrierOption[];
}

const MAX_REASON_LENGTH = 200;
const TOGETHER_MESSAGE = '택배사와 송장번호를 함께 넣어 주세요.';
const SENT_MESSAGE = '반품 신청을 보냈습니다. 반품/교환 화면에는 다음 동기화 뒤 나타납니다.';
const COMPLETE_NOW_CONFIRM = '반품완료로 처리하면 11번가에서 바로 환불되며 되돌릴 수 없습니다. 계속할까요?';

export function ElevenstSellerReturnForm({
  orderItemId,
  quantity,
  orderUseCase,
  carrierOptions,
}: ElevenstSellerReturnFormProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [reasons, setReasons] = useState<CancelReasonOption[]>([]);
  const [reasonsFailed, setReasonsFailed] = useState(false);
  const [reasonCode, setReasonCode] = useState('');
  const [reasonText, setReasonText] = useState('');
  const [feeMethod, setFeeMethod] = useState<'03' | '04' | ''>('');
  const [carrierCode, setCarrierCode] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [completeNow, setCompleteNow] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isSent, setIsSent] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    let alive = true;
    void (async () => {
      try {
        const loaded = await orderUseCase.getElevenstReturnReasons();
        if (alive) {
          setReasons(loaded);
          setReasonsFailed(false);
        }
      } catch {
        if (alive) setReasonsFailed(true);
      }
    })();
    return () => { alive = false; };
  }, [isOpen, orderUseCase]);

  const trimmedText = reasonText.trim();
  const hasCarrier = carrierCode !== '';
  const hasInvoice = invoiceNumber.trim() !== '';
  const isReady = reasonCode !== '' && trimmedText.length >= 1 && trimmedText.length <= MAX_REASON_LENGTH
    && feeMethod !== '' && !isSending && !isSent;

  const send = async () => {
    if (feeMethod === '') return;
    const payload: ElevenstSellerReturnPayload = {
      reasonCode,
      reasonText: trimmedText,
      shippingFeeMethod: feeMethod,
      completeNow,
      ...(hasCarrier ? { deliveryCompanyCode: carrierCode, invoiceNumber: invoiceNumber.trim() } : {}),
    };
    try {
      setIsSending(true);
      setError('');
      await orderUseCase.requestElevenstReturn(orderItemId, payload);
      setIsSent(true);
    } catch (err) {
      setError(extractErrorMessage(err, '반품 신청에 실패했습니다. 다시 시도해주세요.'));
    } finally {
      setIsSending(false);
    }
  };

  const handleSubmit = () => {
    if (hasCarrier !== hasInvoice) {
      setError(TOGETHER_MESSAGE);
      return;
    }
    if (completeNow) {
      setConfirmOpen(true);
      return;
    }
    void send();
  };

  return (
    <div className="mt-6 border-t border-gray-200 pt-6">
      <Button variant="secondary" onClick={() => setIsOpen((open) => !open)} disabled={isSending}>
        판매자가 대신 반품 신청
      </Button>
      {isOpen && (
        <div className="mt-4 flex flex-col gap-3">
          <p className="text-sm text-gray-700">
            구매자의 동의를 받은 뒤 신청하세요. 이 주문 줄의 전체 수량({quantity}개)이 반품됩니다.
          </p>
          <select
            value={reasonCode}
            onChange={(e) => setReasonCode(e.target.value)}
            disabled={isSending || isSent}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm disabled:bg-gray-100"
          >
            <option value="" disabled>반품 사유</option>
            {reasons.map((reason) => (
              <option key={reason.code} value={reason.code}>{reason.label}</option>
            ))}
          </select>
          {reasonsFailed && <p className="text-sm text-gray-500">사유 목록을 불러오지 못했습니다.</p>}
          <textarea
            value={reasonText}
            maxLength={MAX_REASON_LENGTH}
            onChange={(e) => setReasonText(e.target.value)}
            disabled={isSending || isSent}
            placeholder="사유 글 (1~200자)"
            rows={3}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm disabled:bg-gray-100"
          />
          <div className="flex flex-wrap items-center gap-4 text-sm text-gray-800">
            <span>반품 배송비 전달</span>
            <label className="flex items-center gap-2">
              <input type="radio" name="feeMethod" checked={feeMethod === '03'} onChange={() => setFeeMethod('03')}
                disabled={isSending || isSent} />
              박스에 동봉
            </label>
            <label className="flex items-center gap-2">
              <input type="radio" name="feeMethod" checked={feeMethod === '04'} onChange={() => setFeeMethod('04')}
                disabled={isSending || isSent} />
              판매자에게 직접 송금
            </label>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <select
              value={carrierCode}
              onChange={(e) => { setCarrierCode(e.target.value); setError(''); }}
              disabled={isSending || isSent}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm disabled:bg-gray-100"
            >
              <option value="">회수 택배사</option>
              {carrierOptions.map((option) => (
                <option key={option.deliveryCompanyCode} value={option.deliveryCompanyCode}>
                  {option.carrierName}
                </option>
              ))}
            </select>
            <input
              type="text"
              maxLength={50}
              placeholder="회수 송장번호"
              value={invoiceNumber}
              onChange={(e) => { setInvoiceNumber(e.target.value); setError(''); }}
              disabled={isSending || isSent}
              className="w-56 px-3 py-2 border border-gray-300 rounded-lg text-sm disabled:bg-gray-100"
            />
          </div>
          <div className="flex flex-wrap items-center gap-4 text-sm text-gray-800">
            <label className="flex items-center gap-2">
              <input type="radio" name="claimProcess" checked={!completeNow} onChange={() => setCompleteNow(false)}
                disabled={isSending || isSent} />
              신청만
            </label>
            <label className="flex items-center gap-2">
              <input type="radio" name="claimProcess" checked={completeNow} onChange={() => setCompleteNow(true)}
                disabled={isSending || isSent} />
              신청하면서 바로 반품완료
            </label>
          </div>
          <div>
            <Button variant="danger" disabled={!isReady} onClick={handleSubmit}>
              {isSending ? <Spinner label="전송 중..." /> : '신청'}
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
      <ConfirmDialog
        isOpen={confirmOpen}
        nested
        title="바로 반품완료"
        message={COMPLETE_NOW_CONFIRM}
        confirmText="신청"
        isDangerous
        onConfirm={() => { setConfirmOpen(false); void send(); }}
        onCancel={() => setConfirmOpen(false)}
      />
    </div>
  );
}
