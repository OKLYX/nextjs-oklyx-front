'use client';

import { useEffect, useState } from 'react';
import { Spinner } from '@/presentation/components/Spinner';
import { Button } from '@/presentation/components/ui/Button';
import { ConfirmDialog } from '@/presentation/components/ui/ConfirmDialog';
import type { OrderUseCase } from '@/application/usecases/OrderUseCase';
import type { CancelReasonOption, LotteonCancelRequest } from '@/application/dto/OrderDTOs';
import { extractErrorMessage } from '@/infrastructure/utils/errorMessage';
import { formatKstWallClock } from '@/infrastructure/utils/kstWallClock';

/**
 * 「취소 요청」 of one LotteON order line (FEATURE_2611_23 / D24 · D71 · R54).
 *
 * **Purpose**: lists the buyer's open cancel requests (quantity · reason · request time) and, for ADMIN, offers
 * [취소 승인] (two-step confirm) and [취소 거부] (one of the server's reject reasons + an optional reason text,
 * sent without a two-step confirm).
 * **File**: src/app/dashboard/orders/components/LotteonCancelRequests.tsx
 *
 * ⚠️ Renders nothing when there is no open request and the load did not fail — most orders have none.
 * ⚠️ The reason text is the server's 「사유 이름 — 사유 글」 (D71); never map codes here.
 * ⚠️ The reject reasons come from the order detail (server list, D58) — no code→label constant here.
 * ❌ Do not show it for Coupang or 11st orders — 11st has its own `ElevenstCancelRequests`.
 *
 * @example
 * <LotteonCancelRequests orderItemId={order.id} isAdmin={isAdmin} orderUseCase={orderUseCase}
 *   rejectReasons={lotteonChoices?.cancelRejectReasons ?? []} onChanged={() => setReservationChanged(true)} />
 */
interface LotteonCancelRequestsProps {
  orderItemId: number;
  isAdmin: boolean;
  orderUseCase: OrderUseCase;
  /** The [취소 거부] reasons the order detail already loaded (D24). */
  rejectReasons: CancelReasonOption[];
  /** Called after an approve / reject succeeded so the parent refetches the order list on close. */
  onChanged: () => void;
}

const MAX_REASON_LENGTH = 200;

export function LotteonCancelRequests({
  orderItemId,
  isAdmin,
  orderUseCase,
  rejectReasons,
  onChanged,
}: LotteonCancelRequestsProps) {
  const [requests, setRequests] = useState<LotteonCancelRequest[]>([]);
  const [loadFailed, setLoadFailed] = useState(false);
  const [reloadTick, setReloadTick] = useState(0);
  const [approveTarget, setApproveTarget] = useState<LotteonCancelRequest | null>(null);
  const [rejectTargetId, setRejectTargetId] = useState<number | null>(null);
  const [reasonCode, setReasonCode] = useState('');
  const [reasonText, setReasonText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const loaded = await orderUseCase.getLotteonCancelRequests(orderItemId);
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
    setReasonCode('');
    setReasonText('');
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
      await orderUseCase.approveLotteonCancel(target.id);
      afterSuccess();
    } catch (err) {
      setError(extractErrorMessage(err, '취소 승인에 실패했습니다. 다시 시도해주세요.'));
    } finally {
      setIsSending(false);
    }
  };

  // R54: no two-step confirm; an empty text goes as an empty text (the server stores it as null).
  const handleReject = async (requestId: number) => {
    try {
      setIsSending(true);
      setError('');
      await orderUseCase.rejectLotteonCancel(requestId, { reasonCode, reasonText: reasonText.trim() });
      afterSuccess();
    } catch (err) {
      setError(extractErrorMessage(err, '취소 거부에 실패했습니다. 다시 시도해주세요.'));
    } finally {
      setIsSending(false);
    }
  };

  const toggleReject = (requestId: number) => {
    setRejectTargetId(rejectTargetId === requestId ? null : requestId);
  };

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
                  <Button variant="secondary" size="sm" disabled={isSending} onClick={() => toggleReject(request.id)}>
                    취소 거부
                  </Button>
                </div>
              )}
            </div>
            {isAdmin && rejectTargetId === request.id && (
              <div className="mt-3 flex flex-col gap-3">
                <select
                  value={reasonCode}
                  onChange={(e) => setReasonCode(e.target.value)}
                  disabled={isSending}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm disabled:bg-gray-100"
                >
                  <option value="" disabled>거부 사유를 선택하세요</option>
                  {rejectReasons.map((reason) => (
                    <option key={reason.code} value={reason.code}>{reason.label}</option>
                  ))}
                </select>
                <textarea
                  value={reasonText}
                  maxLength={MAX_REASON_LENGTH}
                  onChange={(e) => setReasonText(e.target.value)}
                  disabled={isSending}
                  placeholder="사유 글 (선택, 200자까지)"
                  rows={3}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm disabled:bg-gray-100"
                />
                <div>
                  <Button
                    variant="danger"
                    disabled={isSending || reasonCode === ''}
                    onClick={() => void handleReject(request.id)}
                  >
                    {isSending ? <Spinner label="전송 중..." /> : '취소 거부'}
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
        message={`이 주문 줄의 취소 요청 ${approveTarget?.quantity ?? 0}개를 승인합니다. 롯데ON 에서 바로 취소 · 환불되며 되돌릴 수 없습니다.`}
        confirmText="취소 승인"
        isDangerous
        onConfirm={() => void handleApprove()}
        onCancel={() => setApproveTarget(null)}
      />
    </div>
  );
}
