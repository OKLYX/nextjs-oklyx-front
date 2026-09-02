'use client';

import { useEffect, useState } from 'react';
import axios from 'axios';
import { X } from 'lucide-react';
import { Spinner } from '@/presentation/components/Spinner';
import { addressHead } from '@/infrastructure/utils/address';
import type { ShippingLabelUseCase } from '@/application/usecases/ShippingLabelUseCase';
import type { ShippingLabelExportRow } from '@/application/dto/ShippingLabelDTOs';

/**
 * 송장 접수시트 미리보기·택배수량 편집 모달 (Shipping Label V2)
 *
 * 다운로드 전 preview 테이블에서 라인별 택배수량(parcelQuantity)을 조정한 뒤, 편집된 full rows 를
 * 서버에 POST 해 xlsx 로 내려받는다. preview 응답의 full rows 는 state 에 보관하되 화면에는 축약만
 * 노출한다 — 전화/우편번호/전체주소는 DOM 에 렌더하지 않고 state 에만 남겨 export POST 에 사용.
 *
 * ⚠️ ADMIN 전용 · 주문내역(orders) 페이지에서만 사용.
 * ⚠️ useCase 는 부모(OrderContainer)가 useMemo 로 만든 인스턴스를 재사용 — 여기서 새로 만들지 말 것.
 *
 * @param open        모달 표시 여부
 * @param onOpenChange 열림/닫힘 콜백 (닫으면 내부 상태 전체 초기화)
 * @param sellerId    판매자 필터 (없으면 전체) — preview 조회에 그대로 전달
 * @param isAdmin     ADMIN 게이트 (비-ADMIN 이면 렌더 안 함)
 * @param useCase     부모가 주입하는 ShippingLabelUseCase 인스턴스
 */
interface ShippingLabelPreviewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sellerId?: number;
  isAdmin: boolean;
  useCase: ShippingLabelUseCase;
}

const PARCEL_MIN_MESSAGE = '택배수량은 1 이상이어야 합니다.';

export function ShippingLabelPreviewModal({
  open,
  onOpenChange,
  sellerId,
  isAdmin,
  useCase,
}: ShippingLabelPreviewModalProps) {
  const [rows, setRows] = useState<ShippingLabelExportRow[]>([]);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [previewError, setPreviewError] = useState('');
  const [exportError, setExportError] = useState('');
  const [invalidRowKey, setInvalidRowKey] = useState<string | null>(null);
  const [hasLoaded, setHasLoaded] = useState(false);

  // On open: fetch preview rows on demand. Full rows go into state; the table renders a subset.
  useEffect(() => {
    if (!open || !isAdmin) return;
    let active = true;
    const loadPreview = async () => {
      try {
        setIsPreviewing(true);
        setPreviewError('');
        setExportError('');
        setInvalidRowKey(null);
        setHasLoaded(false);
        const result = await useCase.previewRows(sellerId);
        if (!active) return;
        setRows(result);
        setHasLoaded(true);
      } catch {
        if (!active) return;
        setPreviewError('쿠팡 주문 조회에 실패했습니다. 다시 시도해주세요.');
      } finally {
        if (active) setIsPreviewing(false);
      }
    };
    loadPreview();
    return () => {
      active = false;
    };
  }, [open, isAdmin, sellerId, useCase]);

  if (!open || !isAdmin) return null;

  const handleClose = () => {
    setRows([]);
    setPreviewError('');
    setExportError('');
    setInvalidRowKey(null);
    setHasLoaded(false);
    setIsExporting(false);
    onOpenChange(false);
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
      // Same filename convention as the V1 download (OrderContainer) — keep both in sync.
      const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      anchor.href = url;
      anchor.download = `주문목록_${today}.xlsx`;
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

  const isEmpty = hasLoaded && rows.length === 0;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-25 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-lg p-8 max-w-4xl w-full mx-4 max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-2xl font-semibold text-gray-900">주문목록 확인</h3>
          <button
            onClick={handleClose}
            aria-label="닫기"
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        {isPreviewing ? (
          <div className="flex items-center justify-center py-16">
            <Spinner size={28} label="불러오는 중..." />
          </div>
        ) : previewError ? (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-800 text-sm">
            {previewError}
          </div>
        ) : isEmpty ? (
          <div className="py-16 text-center text-gray-500">발송 대상 주문이 없습니다.</div>
        ) : (
          <div className="flex-1 overflow-y-auto">
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

        {exportError && (
          <div className="mt-4 bg-red-50 border border-red-200 rounded-lg p-4 text-red-800 text-sm">
            {exportError}
          </div>
        )}

        <div className="flex justify-end gap-2 pt-6">
          <button
            onClick={handleClose}
            className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-100 transition-colors"
          >
            닫기
          </button>
          <button
            onClick={handleExport}
            disabled={isPreviewing || isExporting || isEmpty || !!previewError}
            className="px-6 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors disabled:bg-blue-400 disabled:cursor-not-allowed"
          >
            {isExporting ? <Spinner label="다운로드 중..." /> : '엑셀 다운로드'}
          </button>
        </div>
      </div>
    </div>
  );
}
