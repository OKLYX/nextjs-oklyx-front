'use client';

import { useRef, useState } from 'react';
import axios from 'axios';
import { X, Upload } from 'lucide-react';
import { Spinner } from '@/presentation/components/Spinner';
import { getOrderStatusLabel } from '@/domain/entities/OrderEntity';
import type { ShippingLabelUseCase } from '@/application/usecases/ShippingLabelUseCase';
import type { ShipmentConfirmResult } from '@/application/dto/ShippingLabelDTOs';

// Buckets whose detail table can be opened from a summary chip = the three the server returns a
// *list* for (PLAN 2609_12 D2). 요청 건수·매칭·성공 are counts only, so they stay static chips —
// making them look clickable would mean rendering an empty table or inventing a list.
type ResultBucket = 'unmatched' | 'skipped' | 'failed';

type Chip = { key: ResultBucket | null; label: string; count: number; tone?: 'success' | 'danger' };

// Called from the result branch only, where `result` is non-null — the component body cannot build
// these (`result` is nullable there).
function buildChips(result: ShipmentConfirmResult): Chip[] {
  const skipped = result.skipped ?? [];
  return [
    { key: null, label: '요청 건수', count: result.totalRows },
    { key: null, label: '매칭', count: result.matchedOrders },
    { key: null, label: '성공', count: result.succeeded, tone: 'success' },
    {
      key: 'failed',
      label: '실패',
      count: result.failed.length,
      tone: result.failed.length > 0 ? 'danger' : undefined,
    },
    { key: 'unmatched', label: '미매칭', count: result.unmatched.length },
    { key: 'skipped', label: '전송 제외', count: skipped.length },
  ];
}

// `wide` = the 736px-minimum list-table contract (globals.css .list-table-scroll). Use it only for
// the failure table (3 columns + the raw 쿠팡 message). A 2-column table with that class always
// overflows inside this 608px-wide modal, so narrow tables just scroll when they actually overflow.
function ResultTable({
  headers,
  rows,
  wide = false,
}: {
  headers: string[];
  rows: React.ReactNode[][];
  wide?: boolean;
}) {
  return (
    <div className={`border border-gray-200 rounded-lg ${wide ? 'list-table-scroll' : 'overflow-x-auto'}`}>
      <table className="w-full">
        <thead>
          <tr className="bg-gray-50 text-left text-xs font-medium text-gray-500">
            {headers.map((h) => (
              <th key={h} className="px-4 py-2">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200 text-sm text-gray-900">
          {rows.map((cells, i) => (
            <tr key={i}>
              {cells.map((c, j) => (
                <td key={j} className="px-4 py-2">
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// The fallback path reports 쿠팡 응답 `box.status`, which can come back empty — an empty label
// would render a headerless row.
const statusLabel = (s: string) => (s ? getOrderStatusLabel(s) : '알 수 없음');

/**
 * 발송처리(운송장 업로드) 모달 — 택배사 결과 xlsx를 올려 쿠팡 송장업로드를 배치 전송
 *
 * 택배사가 운송장번호를 채운 결과 xlsx를 업로드 → 서버가 주문번호로 order_item을 전개해
 * 계정별 쿠팡 송장업로드(INSTRUCT→배송지시)를 실행하고, 성공/미매칭/실패/제외 요약을 돌려준다.
 * 이미 배송지시 이상으로 넘어간 주문은 서버가 전송에서 제외하고 `skipped`로 돌려준다(실패 아님).
 * 결과는 요약 칩 6개 + 선택한 칩의 상세 표 1개로 보여준다(PLAN 2609_12 D2 — 목록이 있는 3개만 클릭 가능).
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
  const [selected, setSelected] = useState<ResultBucket | null>(null);

  if (!isOpen) return null;

  const reset = () => {
    setFile(null);
    setResult(null);
    setError('');
    setIsUploading(false);
    // The modal is never unmounted, so a stale selection would open a table for the next result.
    setSelected(null);
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
    const selectedFile = e.target.files?.[0] ?? null;
    setFile(selectedFile);
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
      // Second upload on the same screen: the previous selection would open a table of new numbers.
      setSelected(null);
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

  const toggle = (key: ResultBucket) => setSelected((prev) => (prev === key ? null : key));

  const skipped = result?.skipped ?? [];
  // Sorting and the summary line both walk the status *code* order — if they disagreed, a reader
  // would see "배송지시 12" in the summary and 배송중 at the top of the table.
  const skippedRows = [...skipped].sort(
    (a, b) => a.status.localeCompare(b.status) || a.orderId.localeCompare(b.orderId)
  );
  const skippedSummary = skippedRows
    .reduce<{ status: string; count: number }[]>((acc, row) => {
      const last = acc[acc.length - 1];
      if (last && last.status === row.status) last.count += 1;
      else acc.push({ status: row.status, count: 1 });
      return acc;
    }, [])
    .map(({ status, count }) => `${statusLabel(status)} ${count}`)
    .join(' · ');

  return (
    <div className="fixed inset-0 bg-black bg-opacity-25 flex items-center justify-center z-50">
      {/* Upload screen sizes to its content; the result screen is pinned to h-[85vh] so switching
          buckets never resizes the modal (PLAN 2609_12 D6). Either way the close button stays put. */}
      <div
        className={`bg-white rounded-lg shadow-lg w-full mx-4 max-w-2xl flex flex-col p-8 ${
          result == null ? 'max-h-[85vh]' : 'h-[85vh]'
        }`}
      >
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

        {result == null ? (
          /* Only band that scrolls. */
          <div className="flex-1 min-h-0 overflow-y-auto">
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
          </div>
        ) : (
          <>
            {/* Chip row stays out of the scroller — the summary must remain visible while the
                detail table below scrolls. */}
            <div className="shrink-0 flex flex-wrap gap-2 mb-4">
              {buildChips(result).map(({ key, label, count, tone }) => {
                const clickable = key !== null && count > 0;
                const isSelected = clickable && selected === key;
                const base = 'px-3 py-1 rounded-full text-sm whitespace-nowrap transition-colors border';
                const toneClass =
                  tone === 'success'
                    ? 'text-green-700 font-medium'
                    : tone === 'danger'
                      ? 'text-red-700 font-medium'
                      : 'text-gray-700';
                if (!clickable) {
                  // Static chip: no list to open (counts-only bucket, or empty bucket) — PLAN 2609_12 D2/D3.
                  return (
                    <span key={label} className={`${base} border-transparent bg-gray-100 ${toneClass}`}>
                      {label} : {count}
                    </span>
                  );
                }
                return (
                  <button
                    key={label}
                    type="button"
                    aria-pressed={isSelected}
                    onClick={() => toggle(key)}
                    className={`${base} ${
                      isSelected
                        ? 'border-blue-600 bg-blue-600 text-white'
                        : `border-gray-300 bg-white hover:bg-gray-50 ${toneClass}`
                    }`}
                  >
                    {label} : {count}
                  </button>
                );
              })}
            </div>

            {/* Only band that scrolls — no inner vertical scroller (list-table-scroll stays: it is horizontal). */}
            <div className="flex-1 min-h-0 overflow-y-auto">
              {selected === null &&
                (result.unmatched.length === 0 &&
                result.failed.length === 0 &&
                skipped.length === 0 &&
                result.succeeded > 0 ? (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-green-800 text-sm">
                    모든 박스가 정상 처리되었습니다.
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">칩을 눌러 해당 주문 목록을 확인하세요.</p>
                ))}

              {selected === 'failed' && (
                <div>
                  <h4 className="text-sm font-semibold text-gray-900 mb-2">실패 상세</h4>
                  <ResultTable
                    wide
                    headers={['박스 ID', '코드', '메시지']}
                    rows={result.failed.map((box) => [box.shipmentBoxId, box.resultCode, box.message])}
                  />
                </div>
              )}

              {selected === 'unmatched' && (
                <div>
                  <h4 className="text-sm font-semibold text-gray-900 mb-2">미매칭 주문번호</h4>
                  <p className="text-xs text-gray-500 mb-2">order_item 없거나 쿠팡이 아니라 스킵됨</p>
                  <ResultTable
                    headers={['#', '주문번호']}
                    rows={result.unmatched.map((orderId, i) => [i + 1, orderId])}
                  />
                </div>
              )}

              {selected === 'skipped' && (
                <div>
                  <h4 className="text-sm font-semibold text-gray-900 mb-2">전송 제외</h4>
                  <p className="text-xs text-gray-500 mb-2">이미 배송지시된 상태입니다.</p>
                  <p className="text-xs text-gray-500 mb-2">{skippedSummary}</p>
                  <ResultTable
                    headers={['주문번호', '상태']}
                    rows={skippedRows.map((row) => [row.orderId, statusLabel(row.status)])}
                  />
                </div>
              )}
            </div>
          </>
        )}

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
