'use client';

import { useRef, useState } from 'react';
import axios from 'axios';
import { X, Upload } from 'lucide-react';
import { Spinner } from '@/presentation/components/Spinner';
import { getOrderStatusLabel } from '@/domain/entities/OrderEntity';
import type { ShippingLabelUseCase } from '@/application/usecases/ShippingLabelUseCase';
import type { ShipmentConfirmResult } from '@/application/dto/ShippingLabelDTOs';

/**
 * 발송처리(운송장 업로드) 모달 — 택배사 결과 xlsx를 올려 쿠팡 송장업로드를 배치 전송
 *
 * 택배사가 운송장번호를 채운 결과 xlsx를 업로드 → 서버가 주문번호로 order_item을 전개해
 * 계정별 쿠팡 송장업로드(INSTRUCT→배송지시)를 실행하고, 성공/미매칭/실패/제외 요약을 돌려준다.
 * 이미 배송지시 이상으로 넘어간 주문은 서버가 전송에서 제외하고 `skipped`로 돌려준다(실패 아님).
 *
 * ⚠️ ADMIN 전용 · 주문내역(orders) 페이지에서만 사용.
 * ⚠️ useCase는 부모(OrderContainer)가 useMemo로 만든 인스턴스를 재사용 — 여기서 새로 만들지 말 것.
 *
 * @param isOpen  모달 표시 여부
 * @param onClose 닫기 콜백. 인자 = 업로드 성공 여부(true 면 부모가 목록 재조회, PLAN 2609_07 D16).
 *                닫으면 내부 상태 전체 초기화
 * @param useCase 부모가 주입하는 ShippingLabelUseCase 인스턴스
 */
interface ShipmentConfirmModalProps {
  isOpen: boolean;
  /** true = 업로드가 한 번이라도 성공했다 → 부모가 목록을 다시 불러와야 한다(PLAN D16). */
  onClose: (didSucceed: boolean) => void;
  useCase: ShippingLabelUseCase;
}

export function ShipmentConfirmModal({ isOpen, onClose, useCase }: ShipmentConfirmModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [result, setResult] = useState<ShipmentConfirmResult | null>(null);
  const [error, setError] = useState('');
  const [hasSucceeded, setHasSucceeded] = useState(false);

  if (!isOpen) return null;

  const reset = () => {
    setFile(null);
    setResult(null);
    setError('');
    setIsUploading(false);
  };

  const handleClose = () => {
    reset();
    // The modal is never unmounted (`if (!isOpen) return null` sits after the hooks), so this flag
    // survives close→reopen unless it is cleared right here — otherwise the next plain close would
    // refetch the list for nothing.
    setHasSucceeded(false);
    onClose(hasSucceeded);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0] ?? null;
    setFile(selected);
    setResult(null);
    setError('');
  };

  const handleUpload = async () => {
    if (!file) return;
    try {
      setIsUploading(true);
      setError('');
      const res = await useCase.confirmShipment(file);
      setResult(res);
      // Never reset to false: a second upload that skips everything must not drop the refetch.
      if (res.succeeded > 0) setHasSucceeded(true);
    } catch (err) {
      // 400 = 빈 파일/파싱 실패. 그 외 서버 오류도 동일 고정 메시지(스코프 상 단순화).
      const status = axios.isAxiosError(err) ? err.response?.status : undefined;
      setError(
        status === 400
          ? '파일을 처리할 수 없습니다. 택배사 결과 xlsx 형식을 확인해주세요.'
          : '발송처리에 실패했습니다. 다시 시도해주세요.'
      );
    } finally {
      setIsUploading(false);
    }
  };

  const skipped = result?.skipped ?? [];
  // Group by status so a 60-order carrier file collapses into one or two lines, not 60 rows.
  const skippedGroups = Object.entries(
    skipped.reduce<Record<string, string[]>>((acc, s) => {
      (acc[s.status] ??= []).push(s.orderId);
      return acc;
    }, {})
  );

  return (
    <div className="fixed inset-0 bg-black bg-opacity-25 flex items-center justify-center z-50">
      {/* max-h + flex column: the failure/skip lists can be hundreds of rows, and the backdrop is
          fixed — without a height cap the close button scrolls out of reach entirely. */}
      <div className="bg-white rounded-lg shadow-lg w-full mx-4 max-w-2xl max-h-[85vh] flex flex-col p-8">
        <div className="shrink-0 flex items-center justify-between mb-6">
          <h3 className="text-2xl font-semibold text-gray-900">발송처리 (운송장 업로드)</h3>
          <button
            onClick={handleClose}
            aria-label="닫기"
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        {/* Only band that scrolls — no inner vertical scroller (list-table-scroll stays: it is horizontal). */}
        <div className="flex-1 min-h-0 overflow-y-auto">
          {result == null ? (
            <div className="space-y-4">
              <p className="text-sm text-gray-600">
                택배사가 운송장번호를 채운 결과 xlsx를 업로드하세요. 서버가 주문번호로 매칭해 쿠팡에 송장을 등록합니다.
              </p>
              <p className="text-sm text-gray-500">이미 발송처리된 주문은 자동으로 제외됩니다.</p>

              <div className="flex items-center gap-3">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-2 whitespace-nowrap px-4 py-2 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-100 transition-colors"
                >
                  <Upload size={16} />
                  파일 선택
                </button>
                <span className="text-sm text-gray-600 truncate">
                  {file ? file.name : '선택된 파일 없음'}
                </span>
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-800 text-sm">
                  {error}
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
                <span className="text-gray-700">총 {result.totalRows}행</span>
                <span className="text-gray-700">매칭 {result.matchedOrders}주문</span>
                <span className="text-green-700 font-medium">성공 {result.succeeded}건</span>
                <span className={result.failed.length > 0 ? 'text-red-700 font-medium' : 'text-gray-500'}>
                  실패 {result.failed.length}건
                </span>
                <span className="text-gray-700">미매칭 {result.unmatched.length}건</span>
                <span className="text-gray-700">제외 {skipped.length}건</span>
              </div>

              {result.unmatched.length === 0 &&
                result.failed.length === 0 &&
                skipped.length === 0 &&
                result.succeeded > 0 && (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-green-800 text-sm">
                    모든 박스가 정상 처리되었습니다.
                  </div>
                )}

              {result.unmatched.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold text-gray-900 mb-2">미매칭 주문번호</h4>
                  <p className="text-xs text-gray-500 mb-2">order_item 없거나 쿠팡이 아니라 스킵됨</p>
                  <div className="flex flex-wrap gap-2">
                    {result.unmatched.map((orderId) => (
                      <span
                        key={orderId}
                        className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded"
                      >
                        {orderId}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {skippedGroups.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold text-gray-900 mb-2">전송 제외 (이미 발송처리됨)</h4>
                  <p className="text-xs text-gray-500 mb-2">배송지시 이상으로 넘어간 주문 — 실패가 아닙니다.</p>
                  {/* `status || '알 수 없음'`: the fallback path reports 쿠팡 응답 `box.status`, which can come
                      back empty — an empty label would render a headerless `· N건` line. */}
                  {skippedGroups.map(([status, orderIds]) => (
                    <div key={status} className="mb-2">
                      <p className="text-xs text-gray-600 mb-1">
                        {status ? getOrderStatusLabel(status) : '알 수 없음'} · {orderIds.length}건
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {orderIds.map((orderId) => (
                          <span
                            key={orderId}
                            className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded"
                          >
                            {orderId}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {result.failed.length > 0 && (
                <div>
                  <h4 className="text-sm font-semibold text-gray-900 mb-2">실패 상세</h4>
                  <div className="border border-gray-200 rounded-lg list-table-scroll">
                    <table>
                      <thead>
                        <tr className="bg-gray-50 text-left text-xs font-medium text-gray-500">
                          <th className="px-4 py-2">박스 ID</th>
                          <th className="px-4 py-2">코드</th>
                          <th className="px-4 py-2">메시지</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200 text-sm text-gray-900">
                        {result.failed.map((box) => (
                          <tr key={box.shipmentBoxId}>
                            <td className="px-4 py-2">{box.shipmentBoxId}</td>
                            <td className="px-4 py-2">{box.resultCode}</td>
                            <td className="px-4 py-2">{box.message}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="shrink-0 border-t border-gray-200 mt-4 pt-4 flex justify-end gap-2">
          {result == null ? (
            <button
              onClick={handleUpload}
              disabled={!file || isUploading}
              className="px-6 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors disabled:bg-blue-400 disabled:cursor-not-allowed"
            >
              {isUploading ? <Spinner label="처리 중..." /> : '업로드'}
            </button>
          ) : (
            <>
              <button
                onClick={reset}
                className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-100 transition-colors"
              >
                다른 파일 업로드
              </button>
              <button
                onClick={handleClose}
                className="px-6 py-2 bg-gray-300 text-gray-700 font-semibold rounded-lg hover:bg-gray-400 transition-colors"
              >
                닫기
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
