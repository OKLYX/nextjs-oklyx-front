'use client';

import { useEffect, useState } from 'react';
import axios from 'axios';
import { Spinner } from '@/presentation/components/Spinner';
import { addressHead } from '@/infrastructure/utils/address';
import type { OrderItem } from '@/domain/entities/OrderEntity';
import { getOrderStatusLabel, isAlreadyShipped } from '@/domain/entities/OrderEntity';
import type { ShippingLabelUseCase } from '@/application/usecases/ShippingLabelUseCase';
import type {
  CarrierOption,
  ManualShipmentResult,
  ShippingLabelExportRow,
} from '@/application/dto/ShippingLabelDTOs';

/**
 * 주문 상세 모달 — 읽기전용 정보 + (ADMIN·쿠팡) 단건 송장 접수시트 조회·다운로드
 *
 * 인라인 섹션이 두 개 붙는다 — 송장 접수시트(조회·다운로드)와 발송처리(택배사·송장번호 직접 입력).
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
  /** true = 발송처리가 성공했다 → 부모가 목록을 다시 불러와야 한다(PLAN 2609_11 D13). */
  onClose: (didSucceed: boolean) => void;
  isAdmin: boolean;
  useCase: ShippingLabelUseCase;
}

const PARCEL_MIN_MESSAGE = '택배수량은 1 이상이어야 합니다.';

// Platform display labels. COUPANG only on purpose: the sheet button is disabled for every other
// platform (`!isCoupang`), so no other code can reach this banner. Kept as a map (not a literal
// '쿠팡') so a second platform needs one entry, not a rewrite; unknown codes fall back to the raw code.
const PLATFORM_LABELS: Record<string, string> = { COUPANG: '쿠팡' };

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
  // Manual shipment section state. Reset is the parent's `key` remount, not an effect.
  const [carrierOptions, setCarrierOptions] = useState<CarrierOption[]>([]);
  const [carrierId, setCarrierId] = useState<number | null>(null);
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [result, setResult] = useState<ManualShipmentResult | null>(null);
  // Load failure is NOT an empty list: an empty list means "register a carrier code", a failure
  // means "we could not ask". Collapsing the two shows the register notice to someone whose
  // carriers are already registered.
  const [carrierLoadFailed, setCarrierLoadFailed] = useState(false);
  const [isLoadingCarriers, setIsLoadingCarriers] = useState(false);
  const [carrierReloadTick, setCarrierReloadTick] = useState(0);   // [다시 시도] re-runs the effect

  // Carrier list load — a DB lookup (a handful of rows), not a Coupang call, so it runs on open
  // without a button. The guard mirrors the section's render gate: hooks run even when the
  // section is hidden, so without it a USER account would hammer an ADMIN-only endpoint for 403s.
  // Deps are the platform *string* and isAdmin — passing the order object refetches every render.
  useEffect(() => {
    const platform = order?.platform;
    if (!isAdmin || platform !== 'COUPANG') return;
    let alive = true;
    void (async () => {
      setIsLoadingCarriers(true);
      try {
        const options = await useCase.getCarrierOptions(platform);
        if (alive) {
          setCarrierOptions(options);
          setCarrierLoadFailed(false);
        }
      } catch {
        // Keep the section (the user can retry); the flag routes the notice away from D16.
        if (alive) {
          setCarrierOptions([]);
          setCarrierLoadFailed(true);
        }
      } finally {
        if (alive) setIsLoadingCarriers(false);
      }
    })();
    return () => { alive = false; };
  }, [isAdmin, order?.platform, useCase, carrierReloadTick]);

  if (order == null) return null;

  const isEmpty = hasLoaded && rows.length === 0;
  const isCoupang = order.platform === 'COUPANG';
  // Coupang safe numbers die 48h after delivery; the ordersheet then returns an empty phone.
  // The sheet table never renders the phone (PII), so this flag is the only signal the user gets.
  // `receiverPhone` is a non-nullable string in the DTO — "" is the only "no value" form.
  // `?.` guards the one case types can't: a server response that drops the field would otherwise
  // throw inside render and blank the modal.
  const hasMissingPhone = rows.some((row) => !row.receiverPhone?.trim());

  // Manual shipment derived state — never mirrored into useState.
  const isShipped = isAlreadyShipped(order.status);
  const isLocked = isSubmitting || result != null;                  // D14 — only after a 200
  const isInputDisabled = isLocked || carrierOptions.length === 0;  // load failure lands here too (empty list)
  const isSubmitDisabled = isInputDisabled || carrierId == null || invoiceNumber.trim() === '';

  const handleClose = () => {
    // Belt-and-braces: collapse immediately even if a close path bypasses the parent state.
    setRows([]);
    setPreviewError('');
    setExportError('');
    setInvalidRowKey(null);
    setHasLoaded(false);
    setIsExporting(false);
    // Only a real success justifies the parent's refetch (PLAN 2609_11 D13).
    onClose(result != null && result.succeeded > 0);
  };

  const handlePreview = async () => {
    try {
      setIsPreviewing(true);
      setPreviewError('');
      setExportError('');
      setInvalidRowKey(null);
      const previewRows = await useCase.previewRowsByOrder(order.id);
      setRows(previewRows);
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

  /**
   * 단건 발송처리 — 앵커 라인이 속한 박스 1개를 전송한다.
   * - 전송 단위는 박스 전체다. 박스 라인 전개는 서버가 한다(PLAN 2609_11 D1) — 여기서는 앵커 1줄만 보낸다.
   * - 신규 업로드/송장수정 모드는 서버가 주문 상태로 결정한다(D3) — 클라이언트는 라벨만 바꾼다.
   * - 200 응답을 받은 뒤에만 입력을 잠근다. 요청 자체가 실패하면 잠그지 않는다(D14).
   */
  const handleManualConfirm = async () => {
    if (carrierId == null) return;
    try {
      setIsSubmitting(true);
      setSubmitError('');
      // orderItemId is our order_item PK (`order.id`) — the visible `order.externalItemId`
      // (Coupang vendorItemId) would fail silently. Same value previewRowsByOrder takes.
      const response = await useCase.confirmManualShipment({
        orderItemId: order.id,
        carrierId,
        invoiceNumber: invoiceNumber.trim(),   // D15: trim only, no format check
      });
      setResult(response);                     // the lock is set here and nowhere else (D14)
    } catch (err) {
      // Request never landed — no setResult, so the inputs stay open for a retry (D14).
      const serverMessage =
        axios.isAxiosError(err) && err.response?.status === 400
          ? (err.response.data as { message?: string } | undefined)?.message
          : undefined;
      setSubmitError(serverMessage ?? '발송처리에 실패했습니다. 다시 시도해주세요.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // No detail API exists — display the row's fields read-only
  const fields: { label: string; value: string | number }[] = [
    { label: '플랫폼', value: order.platform },
    { label: '주문번호', value: order.externalOrderId },
    { label: '박스 ID', value: order.externalBoxId ?? '-' },
    { label: '아이템 ID', value: order.externalItemId },
    { label: '상품명', value: order.itemName ?? '-' },
    { label: '주문자', value: order.ordererName ?? '-' },
    { label: '수취인', value: order.receiverName ?? '-' },
    { label: '주문수량', value: order.orderCount },
    { label: '취소수량', value: order.cancelCount },
    { label: '보류수량', value: order.holdCount },
    { label: '구매가능수량', value: order.purchasableQty },
    // A successful CREATE writes 배송지시 back server-side; show it straight from the result (D4).
    { label: '상태', value: getOrderStatusLabel(result?.resultStatus ?? order.status) },
    { label: '결제일', value: formatDate(order.paidAt) },
    { label: '마켓 계정 ID', value: order.marketplaceAccountId },
  ];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-25 flex items-center justify-center z-50">
      {/* Fixed geometry from the first paint — expanding the sheet must not resize the modal (D1). */}
      <div className="bg-white rounded-lg shadow-lg w-full mx-4 max-w-4xl h-[90vh] flex flex-col p-8">
        <h3 className="shrink-0 text-2xl font-semibold text-gray-900 mb-6">주문 상세</h3>

        {/* Only this middle band scrolls — the table keeps no scroller of its own (D2). */}
        <div className="flex-1 min-h-0 overflow-y-auto">
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

          {/* 발송처리 — 택배사·송장번호를 직접 입력해 이 라인이 속한 박스 1개를 전송한다.
              전송 단위는 박스 전체(PLAN 2609_11 D1), 신규/수정 모드는 서버가 상태로 결정(D3),
              입력 잠금은 200 응답을 받은 뒤에만(요청 실패는 열어둔다, D14). */}
          {isAdmin && isCoupang && (
            <div className="mt-6 border-t border-gray-200 pt-6">
              <h4 className="text-lg font-semibold text-gray-900">발송처리</h4>
              <p className="mt-1 text-sm text-gray-500">
                박스 {order.externalBoxId ?? '-'} 의 모든 옵션에 같은 운송장번호가 적용됩니다.
              </p>

              {isShipped && (
                <div className="mt-3 bg-amber-50 border border-amber-200 rounded-lg p-3 text-amber-900 text-sm">
                  이미 발송처리된 주문입니다. 입력한 운송장으로 송장번호를 수정합니다.
                </div>
              )}

              <div className="mt-4 flex flex-wrap items-center gap-3">
                <select
                  value={carrierId ?? ''}
                  onChange={(e) => setCarrierId(e.target.value === '' ? null : Number(e.target.value))}
                  disabled={isInputDisabled}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm disabled:bg-gray-100"
                >
                  <option value="">택배사 선택</option>
                  {carrierOptions.map((option) => (
                    <option key={option.carrierId} value={option.carrierId}>
                      {option.carrierName}
                    </option>
                  ))}
                </select>

                {/* type="text": invoice formats differ per carrier and Coupang validates them (D15). */}
                <input
                  type="text"
                  maxLength={50}
                  placeholder="송장번호"
                  value={invoiceNumber}
                  onChange={(e) => { setInvoiceNumber(e.target.value); setSubmitError(''); }}
                  disabled={isInputDisabled}
                  className="w-56 px-3 py-2 border border-gray-300 rounded-lg text-sm disabled:bg-gray-100"
                />

                <button
                  onClick={handleManualConfirm}
                  disabled={isSubmitDisabled}
                  className="px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors disabled:bg-blue-400 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? <Spinner label="전송 중..." /> : (isShipped ? '송장 수정' : '발송처리')}
                </button>
              </div>

              {/* A load failure and an empty list need different words — telling someone whose
                  carriers are registered to go register them sends them to the wrong screen. */}
              {carrierLoadFailed ? (
                <div className="mt-2 flex items-center gap-2 text-sm text-gray-500">
                  <span>택배사 목록을 불러오지 못했습니다.</span>
                  <button
                    onClick={() => setCarrierReloadTick((tick) => tick + 1)}
                    disabled={isLoadingCarriers}
                    className="text-blue-600 underline hover:text-blue-700 disabled:text-gray-400 disabled:no-underline"
                  >
                    {isLoadingCarriers ? '불러오는 중...' : '다시 시도'}
                  </button>
                </div>
              ) : (
                carrierOptions.length === 0 &&
                !isLoadingCarriers && (
                  <p className="mt-2 text-sm text-gray-500">
                    택배사 관리에서 이 플랫폼의 택배사 코드를 먼저 등록하세요.   {/* D16 */}
                  </p>
                )
              )}

              {submitError && (
                <div className="mt-4 bg-red-50 border border-red-200 rounded-lg p-4 text-red-800 text-sm">
                  {submitError}
                </div>
              )}

              {result != null && result.succeeded > 0 && result.failed.length === 0 && (
                <div className="mt-4 bg-green-50 border border-green-200 rounded-lg p-4 text-green-800 text-sm">
                  {result.mode === 'UPDATE' ? '송장 수정 완료' : '발송처리 완료'} — 박스 {result.shipmentBoxId} ·{' '}
                  {result.sentLines}건
                </div>
              )}

              {result != null && result.failed.length > 0 && (
                <div className="mt-4">
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-800 text-sm">
                    발송처리에 실패한 박스가 있습니다.
                  </div>
                  {/* Same columns/tone as ShipmentConfirmModal's failure table, deliberately not
                      extracted into a shared component (2609_01 D5). Coupang wording verbatim (D6). */}
                  <div className="mt-3 border border-gray-200 rounded-lg list-table-scroll">
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

          {hasLoaded && (
            <div className="mt-6 border-t border-gray-200 pt-6">
              <h4 className="text-lg font-semibold text-gray-900">송장 접수시트</h4>
              <p className="mt-1 text-sm text-gray-500">
                주문번호 {order.externalOrderId} · {rows.length}건
              </p>

              {/* Notice only, no re-issue button: Coupang OpenAPI has no safe-number re-issue endpoint
                  and re-fetching the ordersheet returns the same value (PLAN 조사 결과). */}
              {hasMissingPhone && (
                <div className="mt-4 bg-amber-50 border border-amber-200 rounded-lg p-4 text-amber-900 text-sm">
                  {PLATFORM_LABELS[order.platform] ?? order.platform}에서 고객 안심번호를 재발행하십시오.
                </div>
              )}

              {isEmpty ? (
                <div className="py-10 text-center text-gray-500">발송 대상 라인이 없습니다.</div>
              ) : (
                <div className="mt-4">
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
        </div>

        {/* Pinned foot band. exportError lives here, not in the body: a download failure must be
            visible right where the button that caused it is, even when the table is scrolled away.
            border-t marks where the scrolling body ends — without it the body scrolls under the
            buttons with no visible boundary. */}
        <div className="shrink-0 border-t border-gray-200">
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
    </div>
  );
}
