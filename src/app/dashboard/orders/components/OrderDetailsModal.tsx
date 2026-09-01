'use client';

import { useState } from 'react';
import axios from 'axios';
import { Spinner } from '@/presentation/components/Spinner';
import { addressHead } from '@/infrastructure/utils/address';
import type { OrderItem } from '@/domain/entities/OrderEntity';
import { getOrderStatusLabel } from '@/domain/entities/OrderEntity';
import type { ShippingLabelUseCase } from '@/application/usecases/ShippingLabelUseCase';
import type { ShippingLabelExportRow } from '@/application/dto/ShippingLabelDTOs';

/**
 * 주문 상세 모달 — 읽기전용 정보 + (ADMIN·쿠팡) 단건 송장 접수시트 조회·다운로드
 *
 * 시트 섹션은 새 팝업이 아니라 이 모달을 인라인 확장한다. 표 편집 UI 가 기존
 * `ShippingLabelPreviewModal`(주문목록 전체)과 모양이 비슷하지만 **공통 컴포넌트로 추출하지 않는다** —
 * 사용자 결정(PLAN D5)에 따라 이미 검증된 주문목록 다운로드 화면의 회귀 위험을 0 으로 두기 위함.
 *
 * ⚠️ 시트 조회는 쿠팡 실시간 호출이라 모달이 열릴 때 자동 조회하지 않는다(버튼 클릭 시에만).
 * ⚠️ 부모가 이 모달을 항상 렌더하고 null 가드로 숨기므로 닫아도 언마운트되지 않는다 → 상태 초기화는
 * 부모의 `key={selectedOrder?.id ?? 'none'}` remount 가 담당한다(주문이 바뀌거나 닫히면 새 인스턴스).
 * effect 로 초기화하면 프로젝트 lint(`react-hooks/set-state-in-effect`)에 걸린다.
 * `handleClose` 의 초기화는 부모를 거치지 않는 닫힘 경로용 보조 안전장치.
 * ⚠️ useCase 는 부모(OrderContainer)의 useMemo 인스턴스를 재사용 — 여기서 새로 만들지 말 것.
 * ⚠️ 전화/우편번호/전체주소는 DOM 에 렌더하지 않고 state 에만 보관(export POST 용).
 */
interface OrderDetailsModalProps {
  order: OrderItem | null;
  onClose: () => void;
  isAdmin: boolean;
  useCase: ShippingLabelUseCase;
}

const PARCEL_MIN_MESSAGE = '택배수량은 1 이상이어야 합니다.';

// Format ISO LocalDateTime to ko-KR readable string; '-' for null
function formatDate(value: string | null): string {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('ko-KR');
}

export function OrderDetailsModal({ order, onClose, isAdmin, useCase }: OrderDetailsModalProps) {
  // Hooks must precede the `order == null` guard — a conditional hook breaks the Rules of Hooks.
  const [rows, setRows] = useState<ShippingLabelExportRow[]>([]);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [previewError, setPreviewError] = useState('');
  const [exportError, setExportError] = useState('');
  const [invalidRowKey, setInvalidRowKey] = useState<string | null>(null);
  const [hasLoaded, setHasLoaded] = useState(false);

  if (order == null) return null;

  const isEmpty = hasLoaded && rows.length === 0;
  const isCoupang = order.platform === 'COUPANG';

  const handleClose = () => {
    // Belt-and-braces: collapse immediately even if a close path bypasses the parent state.
    setRows([]);
    setPreviewError('');
    setExportError('');
    setInvalidRowKey(null);
    setHasLoaded(false);
    setIsExporting(false);
    onClose();
  };

  const handlePreview = async () => {
    try {
      setIsPreviewing(true);
      setPreviewError('');
      setExportError('');
      setInvalidRowKey(null);
      const result = await useCase.previewRowsByOrder(order.id);
      setRows(result);
      setHasLoaded(true);
    } catch {
      setPreviewError('쿠팡 주문 조회에 실패했습니다. 다시 시도해주세요.');
    } finally {
      setIsPreviewing(false);
    }
  };

  const handleParcelChange = (rowKey: string, value: string) => {
    const parsed = Number(value);
    setInvalidRowKey(null);
    setExportError('');
    setRows((prev) =>
      prev.map((row) =>
        row.rowKey === rowKey
          ? { ...row, parcelQuantity: Number.isNaN(parsed) ? row.parcelQuantity : parsed }
          : row
      )
    );
  };

  const handleExport = async () => {
    try {
      setIsExporting(true);
      setExportError('');
      setInvalidRowKey(null);
      const blob = await useCase.exportSpreadsheet(rows);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `주문목록_${order.externalOrderId}.xlsx`;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      // responseType 'blob' → 400 body is also a Blob; parse it for the message/rowKey.
      if (axios.isAxiosError(err) && err.response?.status === 400) {
        try {
          const text = await (err.response.data as Blob).text();
          const parsed = JSON.parse(text);
          if (typeof parsed?.rowKey === 'string') setInvalidRowKey(parsed.rowKey);
          setExportError(parsed?.message || PARCEL_MIN_MESSAGE);
        } catch {
          setExportError(PARCEL_MIN_MESSAGE);
        }
      } else {
        setExportError('엑셀 다운로드에 실패했습니다. 다시 시도해주세요.');
      }
    } finally {
      setIsExporting(false);
    }
  };

  // No detail API exists — display the row's fields read-only
  const fields: { label: string; value: string | number }[] = [
    { label: '플랫폼', value: order.platform },
    { label: '주문번호', value: order.externalOrderId },
    { label: '박스 ID', value: order.externalBoxId ?? '-' },
    { label: '아이템 ID', value: order.externalItemId },
    { label: '상품명', value: order.itemName ?? '-' },
    { label: '주문수량', value: order.orderCount },
    { label: '취소수량', value: order.cancelCount },
    { label: '보류수량', value: order.holdCount },
    { label: '구매가능수량', value: order.purchasableQty },
    { label: '상태', value: getOrderStatusLabel(order.status) },
    { label: '결제일', value: formatDate(order.paidAt) },
    { label: '마켓 계정 ID', value: order.marketplaceAccountId },
  ];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-25 flex items-center justify-center z-50">
      <div
        className={`bg-white rounded-lg shadow-lg p-8 w-full mx-4 ${
          hasLoaded ? 'max-w-4xl max-h-[90vh] flex flex-col overflow-y-auto' : 'max-w-lg'
        }`}
      >
        <h3 className="text-2xl font-semibold text-gray-900 mb-6">주문 상세</h3>
        <dl className="divide-y divide-gray-200">
          {fields.map((field) => (
            <div key={field.label} className="flex justify-between py-2">
              <dt className="text-sm font-medium text-gray-500">{field.label}</dt>
              <dd className="text-sm text-gray-900 text-right">{field.value}</dd>
            </div>
          ))}
        </dl>

        {isAdmin && (
          <div className="mt-6 flex items-center gap-3">
            <button
              onClick={handlePreview}
              disabled={!isCoupang || isPreviewing}
              className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-100 transition-colors disabled:text-gray-400 disabled:hover:bg-white disabled:cursor-not-allowed"
            >
              {isPreviewing ? <Spinner label="불러오는 중..." /> : '송장시트 조회'}
            </button>
            {!isCoupang && <span className="text-sm text-gray-500">쿠팡 주문만 지원합니다.</span>}
          </div>
        )}

        {previewError && (
          <div className="mt-4 bg-red-50 border border-red-200 rounded-lg p-4 text-red-800 text-sm">
            {previewError}
          </div>
        )}

        {hasLoaded && (
          <div className="mt-6 border-t border-gray-200 pt-6">
            <h4 className="text-lg font-semibold text-gray-900">송장 접수시트</h4>
            <p className="mt-1 text-sm text-gray-500">
              주문번호 {order.externalOrderId} · {rows.length}건
            </p>

            {isEmpty ? (
              <div className="py-10 text-center text-gray-500">발송 대상 라인이 없습니다.</div>
            ) : (
              <div className="mt-4 max-h-[45vh] overflow-y-auto">
                <div className="border border-gray-200 rounded-lg list-table-scroll">
                  <table>
                    <thead>
                      <tr className="bg-gray-50 text-left text-xs font-medium text-gray-500">
                        <th className="px-4 py-2">이름</th>
                        <th className="px-4 py-2">배송지</th>
                        <th className="px-4 py-2">상품명</th>
                        <th className="px-4 py-2 text-right">내품수량</th>
                        <th className="px-4 py-2 text-right">택배수량</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 text-sm text-gray-900">
                      {rows.map((row) => (
                        <tr key={row.rowKey}>
                          <td className="px-4 py-2">{row.receiverName}</td>
                          <td className="px-4 py-2">{addressHead(row.address)}</td>
                          <td className="px-4 py-2">{row.productName}</td>
                          <td className="px-4 py-2 text-right">{row.quantity}</td>
                          <td className="px-4 py-2 text-right">
                            <input
                              type="number"
                              min={1}
                              value={row.parcelQuantity}
                              onChange={(e) => handleParcelChange(row.rowKey, e.target.value)}
                              className={`w-20 px-2 py-1 border rounded text-right outline-none focus:ring-2 focus:ring-blue-500 ${
                                invalidRowKey === row.rowKey
                                  ? 'border-red-500 ring-2 ring-red-300'
                                  : 'border-gray-300'
                              }`}
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}

        {exportError && (
          <div className="mt-4 bg-red-50 border border-red-200 rounded-lg p-4 text-red-800 text-sm">
            {exportError}
          </div>
        )}

        <div className="flex justify-end gap-2 pt-6">
          <button
            onClick={handleClose}
            className="px-6 py-3 bg-gray-300 text-gray-700 font-semibold text-base rounded-lg hover:bg-gray-400 transition-colors"
          >
            닫기
          </button>
          {hasLoaded && (
            <button
              onClick={handleExport}
              disabled={isPreviewing || isExporting || isEmpty || !!previewError}
              className="px-6 py-3 bg-blue-600 text-white font-semibold text-base rounded-lg hover:bg-blue-700 transition-colors disabled:bg-blue-400 disabled:cursor-not-allowed"
            >
              {isExporting ? <Spinner label="다운로드 중..." /> : '엑셀 다운로드'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
