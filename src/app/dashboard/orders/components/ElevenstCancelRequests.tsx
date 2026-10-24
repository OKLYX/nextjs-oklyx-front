'use client';

import { useEffect, useState } from 'react';
import { Spinner } from '@/presentation/components/Spinner';
import { Button } from '@/presentation/components/ui/Button';
import { ConfirmDialog } from '@/presentation/components/ui/ConfirmDialog';
import type { OrderUseCase } from '@/application/usecases/OrderUseCase';
import type { CancelReasonOption, ElevenstCancelRequest } from '@/application/dto/OrderDTOs';
import type { CarrierOption } from '@/application/dto/ShippingLabelDTOs';
import { extractErrorMessage } from '@/infrastructure/utils/errorMessage';
import { formatKstWallClock } from '@/infrastructure/utils/kstWallClock';

/**
 * 「취소 요청」 of one 11st order line (FEATURE_2610_17 / D19 · D37 · D38 · D40 · D41 · D62).
 *
 * **Purpose**: lists the buyer's open cancel requests (quantity · reason · request time) and, for ADMIN, offers
 * [취소 승인] (1640, two-step confirm D37), [취소 거부] (1641 — carrier · invoice · date sent, D38) and, where the
 * server says `faultRejectable`, [책임사유 오류로 거부] (1745 — refuse reason · reason text + the same delivery
 * fields, two-step confirm, D62).
 * **File**: src/app/dashboard/orders/components/ElevenstCancelRequests.tsx
 *
 * ⚠️ Renders nothing when there is no open request — most orders have none.
 * ⚠️ The reason text is the server's 「사유 이름 — 사유 글」 (D41); never map codes here.
 * ❌ Do not show it for Coupang orders — Coupang cancel requests are not handled here (D19).
 *
 * @example
 * <ElevenstCancelRequests orderItemId={order.id} isAdmin={isAdmin} orderUseCase={orderUseCase}
 *   carrierOptions={carrierOptions} faultRejectReasons={elevenstChoices?.faultRejectReasons ?? []}
 *   onChanged={() => setReservationChanged(true)} />
 */
interface ElevenstCancelRequestsProps {
  orderItemId: number;
  isAdmin: boolean;
  orderUseCase: OrderUseCase;
  /** The 11st carrier list the order detail already loaded — not loaded again here. */
  carrierOptions: CarrierOption[];
  /** The [책임사유 오류로 거부] reasons the order detail already loaded (D62). */
  faultRejectReasons: CancelReasonOption[];
  /** Called after an approve / reject succeeded so the parent refetches the order list on close. */
  onChanged: () => void;
}

/** Today as 'yyyy-MM-dd' in KST — the sv-SE locale prints exactly that shape. */
function kstToday(): string {
  return new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' });
}

export function ElevenstCancelRequests({
  orderItemId,
  isAdmin,
  orderUseCase,
  carrierOptions,
  faultRejectReasons,
  onChanged,
}: ElevenstCancelRequestsProps) {
  const [requests, setRequests] = useState<ElevenstCancelRequest[]>([]);
  const [loadFailed, setLoadFailed] = useState(false);
  const [reloadTick, setReloadTick] = useState(0);
  const [approveTarget, setApproveTarget] = useState<ElevenstCancelRequest | null>(null);
  const [rejectTargetId, setRejectTargetId] = useState<number | null>(null);
  // D62: which request's [책임사유 오류로 거부] form is open, and its own two inputs.
  const [faultTargetId, setFaultTargetId] = useState<number | null>(null);
  const [refuseCode, setRefuseCode] = useState('');
  const [refuseText, setRefuseText] = useState('');
  const [faultConfirmOpen, setFaultConfirmOpen] = useState(false);
  const [carrierCode, setCarrierCode] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [sendDate, setSendDate] = useState(kstToday());
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const loaded = await orderUseCase.getElevenstCancelRequests(orderItemId);
        if (alive) {
          setRequests(loaded);
          setLoadFailed(false);
        }
      } catch {
        if (alive) setLoadFailed(true);
      }
    })();
    return () => { alive = false; };
  }, [orderItemId, orderUseCase, reloadTick]);

  if (requests.length === 0 && !loadFailed) return null;

  const afterSuccess = () => {
    setRejectTargetId(null);
    setFaultTargetId(null);
    setRefuseCode('');
    setRefuseText('');
    setCarrierCode('');
    setInvoiceNumber('');
    setReloadTick((tick) => tick + 1);
    onChanged();
  };

  const handleApprove = async () => {
    if (approveTarget == null) return;
    const target = approveTarget;
    setApproveTarget(null);
    try {
      setIsSending(true);
      setError('');
      await orderUseCase.approveElevenstCancel(target.id);
      afterSuccess();
    } catch (err) {
      setError(extractErrorMessage(err, '취소 승인에 실패했습니다. 다시 시도해주세요.'));
    } finally {
      setIsSending(false);
    }
  };

  const handleReject = async (requestId: number) => {
    try {
      setIsSending(true);
      setError('');
      await orderUseCase.rejectElevenstCancel(requestId, {
        deliveryCompanyCode: carrierCode,
        invoiceNumber: invoiceNumber.trim(),
        sendDate,
      });
      afterSuccess();
    } catch (err) {
      setError(extractErrorMessage(err, '취소 거부에 실패했습니다. 다시 시도해주세요.'));
    } finally {
      setIsSending(false);
    }
  };

  const handleRejectFault = async () => {
    if (faultTargetId == null) return;
    const requestId = faultTargetId;
    setFaultConfirmOpen(false);
    try {
      setIsSending(true);
      setError('');
      await orderUseCase.rejectElevenstCancelFault(requestId, {
        refuseCode,
        reasonText: refuseText.trim(),
        deliveryCompanyCode: carrierCode,
        invoiceNumber: invoiceNumber.trim(),
        sendDate,
      });
      afterSuccess();
    } catch (err) {
      setError(extractErrorMessage(err, '취소 거부에 실패했습니다. 다시 시도해주세요.'));
    } finally {
      setIsSending(false);
    }
  };

  const openForm = (kind: 'reject' | 'fault', requestId: number) => {
    if (kind === 'reject') {
      setFaultTargetId(null);
      setRejectTargetId(rejectTargetId === requestId ? null : requestId);
    } else {
      setRejectTargetId(null);
      setFaultTargetId(faultTargetId === requestId ? null : requestId);
    }
  };

  const deliveryInputs = (
    <>
      <select
        value={carrierCode}
        onChange={(e) => setCarrierCode(e.target.value)}
        disabled={isSending}
        className="px-3 py-2 border border-gray-300 rounded-lg text-sm disabled:bg-gray-100"
      >
        <option value="">택배사 선택</option>
        {carrierOptions.map((option) => (
          <option key={option.deliveryCompanyCode} value={option.deliveryCompanyCode}>
            {option.carrierName}
          </option>
        ))}
      </select>
      <input
        type="text"
        maxLength={50}
        placeholder="송장번호"
        value={invoiceNumber}
        onChange={(e) => setInvoiceNumber(e.target.value)}
        disabled={isSending}
        className="w-56 px-3 py-2 border border-gray-300 rounded-lg text-sm disabled:bg-gray-100"
      />
      <input
        type="date"
        value={sendDate}
        onChange={(e) => setSendDate(e.target.value)}
        disabled={isSending}
        className="px-3 py-2 border border-gray-300 rounded-lg text-sm disabled:bg-gray-100"
      />
    </>
  );
  const isDeliveryFilled = carrierCode !== '' && invoiceNumber.trim() !== '' && sendDate !== '';
  const refuseTextLength = refuseText.trim().length;

  return (
    <div className="mt-6 border-t border-gray-200 pt-6">
      <h4 className="text-sm font-semibold text-gray-900">취소 요청</h4>
      {loadFailed && <p className="mt-2 text-sm text-gray-500">취소 요청을 불러오지 못했습니다.</p>}
      <ul className="mt-2 divide-y divide-gray-200">
        {requests.map((request) => (
          <li key={request.id} className="py-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-sm text-gray-900">
                <p>{request.quantity}개 · {request.reason}</p>
                <p className="text-xs text-gray-500">
                  {request.requestedAt ? formatKstWallClock(request.requestedAt) : '-'}
                </p>
              </div>
              {isAdmin && (
                <div className="flex items-center gap-2 max-md:flex-wrap">
                  <Button variant="danger" size="sm" disabled={isSending} onClick={() => setApproveTarget(request)}>
                    취소 승인
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={isSending}
                    onClick={() => openForm('reject', request.id)}
                  >
                    취소 거부
                  </Button>
                  {request.faultRejectable && (
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={isSending}
                      onClick={() => openForm('fault', request.id)}
                    >
                      책임사유 오류로 거부
                    </Button>
                  )}
                </div>
              )}
            </div>
            {isAdmin && rejectTargetId === request.id && (
              <div className="mt-3 flex flex-wrap items-center gap-3">
                {deliveryInputs}
                <Button
                  variant="danger"
                  disabled={isSending || !isDeliveryFilled}
                  onClick={() => void handleReject(request.id)}
                >
                  {isSending ? <Spinner label="전송 중..." /> : '취소 거부'}
                </Button>
              </div>
            )}
            {isAdmin && faultTargetId === request.id && (
              <div className="mt-3 flex flex-col gap-3">
                <select
                  value={refuseCode}
                  onChange={(e) => setRefuseCode(e.target.value)}
                  disabled={isSending}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm disabled:bg-gray-100"
                >
                  <option value="" disabled>거부 사유</option>
                  {faultRejectReasons.map((reason) => (
                    <option key={reason.code} value={reason.code}>{reason.label}</option>
                  ))}
                </select>
                <textarea
                  value={refuseText}
                  maxLength={200}
                  onChange={(e) => setRefuseText(e.target.value)}
                  disabled={isSending}
                  placeholder="사유 글 (1~200자)"
                  rows={3}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm disabled:bg-gray-100"
                />
                <div className="flex flex-wrap items-center gap-3">
                  {deliveryInputs}
                  <Button
                    variant="danger"
                    disabled={isSending || refuseCode === '' || refuseTextLength < 1 || refuseTextLength > 200
                      || !isDeliveryFilled}
                    onClick={() => setFaultConfirmOpen(true)}
                  >
                    {isSending ? <Spinner label="전송 중..." /> : '책임사유 오류로 거부'}
                  </Button>
                </div>
              </div>
            )}
          </li>
        ))}
      </ul>
      {error && (
        <div className="mt-2 bg-red-50 border border-red-200 rounded-lg p-3 text-red-800 text-sm">{error}</div>
      )}
      <ConfirmDialog
        isOpen={approveTarget != null}
        nested
        title="취소 승인"
        message={`이 주문 줄의 취소 요청 ${approveTarget?.quantity ?? 0}개를 승인합니다. 11번가에서 바로 취소 · 환불되며 되돌릴 수 없습니다.`}
        confirmText="취소 승인"
        isDangerous
        onConfirm={() => void handleApprove()}
        onCancel={() => setApproveTarget(null)}
      />
      <ConfirmDialog
        isOpen={faultConfirmOpen}
        nested
        title="책임사유 오류로 거부"
        message="이 취소 요청을 거부합니다. 구매자에게 사유가 전달되며 되돌릴 수 없습니다."
        confirmText="책임사유 오류로 거부"
        isDangerous
        onConfirm={() => void handleRejectFault()}
        onCancel={() => setFaultConfirmOpen(false)}
      />
    </div>
  );
}
