'use client';

import { useEffect, useState } from 'react';
import axios from 'axios';
import { Spinner } from '@/presentation/components/Spinner';
import { addressHead } from '@/infrastructure/utils/address';
import type { OrderItem } from '@/domain/entities/OrderEntity';
import { getOrderStatusLabel, isAlreadyShipped } from '@/domain/entities/OrderEntity';
import type { ShippingLabelUseCase } from '@/application/usecases/ShippingLabelUseCase';
import type { OrderUseCase } from '@/application/usecases/OrderUseCase';
import type {
  CancelReasonOption,
  OrderAcknowledgeResult,
  OrderCancelResult,
} from '@/application/dto/OrderDTOs';
import { extractErrorMessage } from '@/infrastructure/utils/errorMessage';
import type {
  CarrierOption,
  ManualShipmentResult,
  ShippingLabelExportRow,
} from '@/application/dto/ShippingLabelDTOs';

/**
 * 주문 상세 모달 — 읽기전용 정보 + (ADMIN·쿠팡) 단건 송장 접수시트 조회·다운로드
 *
 * 액션 배치 — 발주처리는 **하단 고정 바 왼쪽**에, 나머지는 본문의 **좌우 탭**(왼쪽부터 송장시트 ·
 * 발송처리 · 주문취소, 기본 선택은 발송처리)에 둔다. 발주는 뒤 액션들의 앞 단계라 탭에 섞지 않고,
 * 탭 셋은 한 번에 하나만 쓰는 배타적 선택이라 세로로 쌓지 않는다.
 * 엑셀 다운로드 버튼은 표를 볼 수 있는 송장시트 탭에서만 하단 바에 나온다.
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
  /** 발주처리(결제완료→상품준비중) 전용. 주문내역·출고관리 두 호출부가 모두 넘긴다. */
  orderUseCase: OrderUseCase;
}

const PARCEL_MIN_MESSAGE = '택배수량은 1 이상이어야 합니다.';

// Platform display labels. COUPANG only on purpose: the sheet button is disabled for every other
// platform (`!isCoupang`), so no other code can reach this banner. Kept as a map (not a literal
// '쿠팡') so a second platform needs one entry, not a rewrite; unknown codes fall back to the raw code.
const PLATFORM_LABELS: Record<string, string> = { COUPANG: '쿠팡' };

// 주문 상세 액션 탭. 왼쪽부터 송장시트 조회 → 발송처리 → 주문취소 순이고, **기본 선택은 발송처리**다 —
// 주문 대부분이 발송으로 끝나고, 취소는 되돌릴 수 없어 한 번 더 누르게 두는 편이 안전하다.
const ACTION_TABS = [
  { key: 'sheet', label: '송장시트' },
  { key: 'shipment', label: '발송처리' },
  { key: 'cancel', label: '주문 취소' },
] as const;

type ActionTab = (typeof ACTION_TABS)[number]['key'];

// 취소 접수 유형 라벨 — 쿠팡 `receiptType`(CANCEL=즉시취소 / STOP_SHIPMENT=출고중지) 표시 전용.
// 이 모달 안에서만 쓰므로 엔티티·DTO 로 빼지 않는다. 모르는 코드는 원문 그대로 보여준다(PLAN 2609_25 D16).
const RECEIPT_TYPE_LABELS: Record<string, string> = {
  CANCEL: '즉시취소',
  STOP_SHIPMENT: '출고중지 접수',
};

// 주문 시점 금액 스냅샷 표시(PLAN 2609_26 D9·D10).
// ⚠️ null 은 0 원이 아니라 "모른다"다 — 과거 주문은 백필된 만큼만 값이 있다.
// 0 으로 그리면 무료 주문과 구분되지 않으므로 '—' 로 가른다.
function formatAmount(value: number | null): string {
  if (value == null) return '—';
  return `${value.toLocaleString('ko-KR')}원`;
}

// Format ISO LocalDateTime to ko-KR readable string; '-' for null
function formatDate(value: string | null): string {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('ko-KR');
}

export function OrderDetailsModal({ order, onClose, isAdmin, useCase, orderUseCase }: OrderDetailsModalProps) {
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
  const [carrierCode, setCarrierCode] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  // 이미 발송처리된 주문은 입력칸을 감춰 둔다 — [송장 수정하기] 를 눌러야 열린다.
  // 실수로 정상 송장을 덮어쓰는 경로를 한 번 막는 것이 목적이라 미발송 주문에는 영향이 없다.
  const [isEditingInvoice, setIsEditingInvoice] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [result, setResult] = useState<ManualShipmentResult | null>(null);
  // Load failure is NOT an empty list: an empty list means "register a carrier code", a failure
  // means "we could not ask". Collapsing the two shows the register notice to someone whose
  // carriers are already registered.
  const [carrierLoadFailed, setCarrierLoadFailed] = useState(false);
  // Starts true: the effect only flips it inside its async IIFE (after the first paint), so a
  // `false` start shows the D16 register notice for a frame to someone who has carriers registered.
  const [isLoadingCarriers, setIsLoadingCarriers] = useState(true);
  const [carrierReloadTick, setCarrierReloadTick] = useState(0);   // [다시 시도] re-runs the effect
  // 발주처리(결제완료→상품준비중). 일괄과 같은 엔드포인트를 쓴다(PLAN 2609_17 D6).
  const [ackResult, setAckResult] = useState<OrderAcknowledgeResult | null>(null);
  const [isAcknowledging, setIsAcknowledging] = useState(false);
  const [ackError, setAckError] = useState('');
  // 발송 전 주문 취소(PLAN 2609_25). 사유 목록은 서버가 소유한다(D4) — 코드→라벨 상수를 만들지 않는다.
  const [cancelReasons, setCancelReasons] = useState<CancelReasonOption[]>([]);
  // 목록을 못 불러온 것과 "아직 안 골랐다"는 다르다 — 실패는 별도 플래그로 안내 문구를 가른다.
  const [cancelReasonsFailed, setCancelReasonsFailed] = useState(false);
  const [cancelReason, setCancelReason] = useState('');            // 선택 전에는 '' = 버튼 비활성
  // 기본값 = 전량 취소(D3). `order?.` 인 이유는 이 hook 이 `order == null` 가드보다 위에 오기 때문이다.
  const [cancelQty, setCancelQty] = useState(order?.purchasableQty ?? 1);
  const [cancelResult, setCancelResult] = useState<OrderCancelResult | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);
  const [cancelError, setCancelError] = useState('');
  // 발송처리·주문취소 탭. 기본은 왼쪽(발송처리). 상태 때문에 못 쓰는 탭이 골라져 있으면
  // 아래 `activeTab` 이 파생값으로 되돌린다 — effect 로 고쳐 쓰지 않는다.
  const [actionTab, setActionTab] = useState<ActionTab>('shipment');

  // Carrier list load — the platform's code table (Coupang has no carrier-list API), served from
  // our own backend, not a Coupang call, so it runs on open without a button. The guard mirrors the section's render gate: hooks run even when the
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

  // 취소 사유 목록 — 우리 백엔드의 서버 소유 목록이라(PLAN 2609_25 D4) 쿠팡 왕복이 아니다.
  // 택배사 목록과 같은 관례: 모달이 열릴 때 1회, ADMIN·쿠팡 가드, `alive` 로 언마운트 후 setState 방지.
  // ⚠️ 여기서 부르는 것은 `orderUseCase` 다 — 택배사 목록의 `useCase`(ShippingLabelUseCase)와 인스턴스가 다르다.
  useEffect(() => {
    const platform = order?.platform;
    if (!isAdmin || platform !== 'COUPANG') return;
    let alive = true;
    void (async () => {
      try {
        const options = await orderUseCase.getCancelReasons();
        if (alive) {
          setCancelReasons(options);
          setCancelReasonsFailed(false);
        }
      } catch {
        // 임의 기본값을 만들지 않는다 — 목록이 없으면 취소 버튼을 막는다.
        if (alive) {
          setCancelReasons([]);
          setCancelReasonsFailed(true);
        }
      }
    })();
    return () => { alive = false; };
  }, [isAdmin, order?.platform, orderUseCase]);

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
  const isSubmitDisabled = isInputDisabled || carrierCode === '' || invoiceNumber.trim() === '';
  // 미발송이면 늘 열려 있고, 발송된 건은 [송장 수정하기] 를 누른 뒤에만 열린다.
  const isFormOpen = !isShipped || isEditingInvoice;
  const ackSucceeded = ackResult != null && ackResult.succeeded > 0;
  // 취소 파생값 — 화면은 라인 1건만 보내므로(D6) 성공 라인도 최대 1건이다.
  const cancelledLine = cancelResult?.cancelled[0] ?? null;
  const cancelSucceeded = cancelledLine != null;
  // 전량취소 판정은 서버가 소유한다(PLAN 2609_26 D26). 응답이 있으면 방금 받은 resultStatus 가,
  // 없으면 목록 응답의 `cancelled` 가 근거다 — 둘 다 서버 판정이라 기준이 갈리지 않는다.
  const fullyCanceled = cancelResult != null
    ? cancelResult.cancelled.some((line) => line.resultStatus === 'CANCELLED')
    : order.cancelled;
  const cancelReceiptLabel = cancelledLine?.receiptType == null
    ? ''
    : (RECEIPT_TYPE_LABELS[cancelledLine.receiptType] ?? cancelledLine.receiptType);
  // 빈칸은 Number('') === 0 이라 0·NaN 도 범위 밖으로 취급해 버튼만 막는다 — 입력 중 값을 되돌리지 않는다.
  const isCancelQtyValid = Number.isInteger(cancelQty) && cancelQty >= 1 && cancelQty <= order.purchasableQty;
  const isCancelInputDisabled = isCancelling || cancelSucceeded || cancelReasons.length === 0;
  // 액션 노출 게이트 — 발주처리는 하단 고정 바로, 나머지 둘은 탭으로 갈린다.
  const canAcknowledge = isAdmin && isCoupang && order.status === 'PAID' && !fullyCanceled;
  // 시트는 쿠팡 전용이 아니다 — 버튼만 비활성되고 안내가 붙으므로 ADMIN 이면 탭을 연다.
  const canSheet = isAdmin;
  const canShip = isAdmin && isCoupang && !fullyCanceled;
  const canCancel = isAdmin && isCoupang && (order.status === 'PAID' || order.status === 'PREPARING');
  const tabAvailability: Record<ActionTab, boolean> = { sheet: canSheet, shipment: canShip, cancel: canCancel };
  // 고른 탭을 쓸 수 없으면 왼쪽부터 첫 번째로 쓸 수 있는 탭을 보여준다
  // (하나도 없으면 탭 영역 자체가 안 그려진다).
  const activeTab: ActionTab = tabAvailability[actionTab]
    ? actionTab
    : ACTION_TABS.find((tab) => tabAvailability[tab.key])?.key ?? actionTab;

  const registeredOptions = carrierOptions.filter((option) => option.registered);
  const otherOptions = carrierOptions.filter((option) => !option.registered);

  const handleClose = () => {
    // Belt-and-braces: collapse immediately even if a close path bypasses the parent state.
    setRows([]);
    setPreviewError('');
    setExportError('');
    setInvalidRowKey(null);
    setHasLoaded(false);
    setIsExporting(false);
    // Only a real success justifies the parent's refetch (PLAN 2609_11 D13).
    // 발주처리 성공도 같은 채널로 올린다(2609_17) — 호출부가 갈리지 않게 새 콜백을 만들지 않는다.
    // 취소 성공도 같은 채널로 올린다 — 부모 재조회가 stale 재취소 경로를 없앤다(PLAN 2609_25 D14).
    onClose((result != null && result.succeeded > 0) || ackSucceeded || cancelSucceeded);
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
   * 단건 발주처리 — 이 라인이 속한 박스 1개를 결제완료→상품준비중으로 전환한다.
   * 일괄(출고관리)과 같은 엔드포인트를 쓴다(PLAN 2609_17 D6) — 대상 판정은 서버가 한다.
   */
  const handleAcknowledge = async () => {
    try {
      setIsAcknowledging(true);
      setAckError('');
      setAckResult(await orderUseCase.acknowledgeOrders([order.id]));
    } catch (err) {
      // 요청이 안 갔을 수도 있으므로 버튼은 다시 누를 수 있게 열어 둔다.
      setAckError(extractErrorMessage(err, '발주처리에 실패했습니다. 다시 시도해주세요.'));
    } finally {
      setIsAcknowledging(false);
    }
  };

  /**
   * 발송 전 주문 취소 — 이 라인을 고른 수량만큼 취소한다(PLAN 2609_25 D6).
   * - 보내는 것은 라인 id + 수량뿐이다. 박스 분할·상태 판정·수량 상한은 서버가 한다(D1·D2·D3).
   * - 되돌릴 수 없고 판매자 점수가 하락하므로 확인 다이얼로그가 마지막 방어선이다(D13).
   */
  const handleCancel = async () => {
    if (cancelReason === '' || !isCancelQtyValid) return;
    const label = cancelReasons.find((reason) => reason.code === cancelReason)?.label ?? cancelReason;
    if (!window.confirm(
      `${cancelQty}개를 "${label}" 사유로 취소합니다.\n되돌릴 수 없고 판매자 점수가 하락합니다. 계속할까요?`
    )) return;
    try {
      setIsCancelling(true);
      setCancelError('');
      setCancelResult(
        await orderUseCase.cancelOrders([{ orderItemId: order.id, quantity: cancelQty }], cancelReason)
      );
    } catch (err) {
      // 요청이 안 갔을 수 있으므로 버튼은 다시 누를 수 있게 열어 둔다.
      setCancelError(extractErrorMessage(err, '주문 취소에 실패했습니다. 다시 시도해주세요.'));
    } finally {
      setIsCancelling(false);
    }
  };

  /**
   * 단건 발송처리 — 앵커 라인이 속한 박스 1개를 전송한다.
   * - 전송 단위는 박스 전체다. 박스 라인 전개는 서버가 한다(PLAN 2609_11 D1) — 여기서는 앵커 1줄만 보낸다.
   * - 신규 업로드/송장수정 모드는 서버가 주문 상태로 결정한다(D3) — 클라이언트는 라벨만 바꾼다.
   * - 200 응답을 받은 뒤에만 입력을 잠근다. 요청 자체가 실패하면 잠그지 않는다(D14).
   */
  const handleManualConfirm = async () => {
    if (carrierCode === '') return;
    try {
      setIsSubmitting(true);
      setSubmitError('');
      // orderItemId is our order_item PK (`order.id`) — the visible `order.externalItemId`
      // (Coupang vendorItemId) would fail silently. Same value previewRowsByOrder takes.
      const response = await useCase.confirmManualShipment({
        orderItemId: order.id,
        deliveryCompanyCode: carrierCode,
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
    // 취소 성공 라인은 서버가 준 결과값으로 덮어쓴다(PLAN 2609_25 D14) — 즉시취소는 취소수량이,
    // 출고중지는 보류수량이 는다(D7). 주문수량은 그대로다(쿠팡도 원 주문수량은 바꾸지 않는다).
    { label: '취소수량', value: cancelledLine?.resultCancelCount ?? order.cancelCount },
    { label: '보류수량', value: cancelledLine?.resultHoldCount ?? order.holdCount },
    { label: '구매가능수량', value: cancelledLine?.resultPurchasableQty ?? order.purchasableQty },
    // 금액은 주문 시점 스냅샷이라 취소·동기화로 바뀌지 않는다. 배송비는 박스 단위라 여기 없다.
    { label: '단가', value: formatAmount(order.unitPrice) },
    { label: '주문금액', value: formatAmount(order.lineAmount) },
    { label: '할인금액', value: formatAmount(order.discountAmount) },
    { label: '플랫폼 부담 할인', value: formatAmount(order.platformDiscountAmount) },
    // A successful CREATE writes 발송처리 back server-side; show it straight from the result (D4).
    // ⚠️ 발송처리 result 가 우선 — 순서를 뒤집으면 한 모달에서 발주→발송을 연달아 한 사용자에게 발송처리가 안 보인다.
    // 취소가 가장 뒤 단계라 취소 결과가 이긴다 — 전량취소면 서버가 'CANCELLED' 를 준다(D14).
    { label: '상태', value: getOrderStatusLabel(
        cancelledLine?.resultStatus ?? result?.resultStatus ?? (ackSucceeded ? 'PREPARING' : order.status)) },
    { label: '결제일', value: formatDate(order.paidAt) },
    { label: '마켓 계정 ID', value: order.marketplaceAccountId },
  ];

  return (
    <div className="fixed inset-0 bg-black/25 flex items-center justify-center z-50">
      {/* Fixed geometry from the first paint — expanding the sheet must not resize the modal (D1). */}
      <div className="bg-white rounded-lg shadow-lg w-full mx-4 max-w-4xl h-[90vh] flex flex-col p-8">
        <h3 className="shrink-0 text-2xl font-semibold text-gray-900 mb-6">주문 상세</h3>

        {/* Only this middle band scrolls — the table keeps no scroller of its own (D2). */}
        <div className="flex-1 min-h-0 overflow-y-auto modal-scroll-body">
          <dl className="divide-y divide-gray-200">
            {fields.map((field) => (
              <div key={field.label} className="flex justify-between py-2">
                <dt className="text-sm font-medium text-gray-500">{field.label}</dt>
                <dd className="text-sm text-gray-900 text-right">{field.value}</dd>
              </div>
            ))}
          </dl>

          {/* 송장시트 · 발송처리 · 주문 취소 — 좌우 탭(기본 선택은 발송처리).
              세로로 쌓으면 모달이 길어져 뒤 액션이 스크롤 밖으로 밀린다. 어차피 한 번에 하나만
              쓰는 배타적 선택이라 탭이 맞다. 쓸 수 없는 탭은 지우지 않고 비활성으로 남긴다 —
              지우면 "왜 안 보이지" 를 사용자가 알 수 없다.
              ⚠️ 입력값(택배사·송장번호·사유·수량)은 이 컴포넌트의 state 라 탭을 오가도 남는다.
              패널 안으로 state 를 내리면 탭 전환마다 입력이 날아간다. */}
          {(canSheet || canShip || canCancel) && (
            <div className="mt-6 border-t border-gray-200 pt-6">
              {/* 탭 모양은 ClaimTypeTabs 와 같은 관용구(밑줄) — 모달 안이라 컴포넌트로 빼지 않는다. */}
              <div className="flex gap-1 border-b border-gray-200">
                {ACTION_TABS.map((tab) => {
                  const isAvailable = tabAvailability[tab.key];
                  const isActive = activeTab === tab.key;
                  return (
                    <button
                      key={tab.key}
                      type="button"
                      onClick={() => setActionTab(tab.key)}
                      disabled={!isAvailable}
                      className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium disabled:cursor-not-allowed ${
                        isActive
                          ? 'border-blue-600 text-blue-700'
                          : 'border-transparent text-gray-500 hover:text-gray-700 disabled:text-gray-300 disabled:hover:text-gray-300'
                      }`}
                    >
                      {tab.label}
                    </button>
                  );
                })}
              </div>

              {/* 송장 접수시트 — 조회는 쿠팡 실시간 호출이라 탭을 열어도 자동으로 부르지 않는다.
                  버튼을 눌러야 조회하고, 불러온 표는 이 탭 안에 남는다(탭을 오가도 유지). */}
              {activeTab === 'sheet' && canSheet && (
                <div className="mt-4">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={handlePreview}
                      disabled={!isCoupang || isPreviewing}
                      className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-100 transition-colors disabled:text-gray-400 disabled:hover:bg-white disabled:cursor-not-allowed"
                    >
                      {isPreviewing ? <Spinner label="불러오는 중..." /> : '송장시트 조회'}
                    </button>
                    {!isCoupang && <span className="text-sm text-gray-500">쿠팡 주문만 지원합니다.</span>}
                  </div>

                  {previewError && (
                    <div className="mt-4 bg-red-50 border border-red-200 rounded-lg p-4 text-red-800 text-sm">
                      {previewError}
                    </div>
                  )}

                  {hasLoaded && (
                    <div className="mt-4">
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
              )}

              {/* 발송처리 — 택배사·송장번호를 직접 입력해 이 라인이 속한 박스 1개를 전송한다.
                  전송 단위는 박스 전체(PLAN 2609_11 D1), 신규/수정 모드는 서버가 상태로 결정(D3),
                  입력 잠금은 200 응답을 받은 뒤에만(요청 실패는 열어둔다, D14). */}
              {/* 전량취소면 남은 액션이 없다. 숨김 조건은 `fullyCanceled` 뿐 — `cancelSucceeded` 로 숨기면
                  부분취소 후 잔여 발송이 막힌다(PLAN 2609_25 D19). */}
              {activeTab === 'shipment' && canShip && (
                <div className="mt-4">
                  <p className="mt-1 text-sm text-gray-500">
                    박스 {order.externalBoxId ?? '-'} 의 모든 옵션에 같은 운송장번호가 적용됩니다.
                  </p>

                  {isShipped && (
                    <div className="mt-3 bg-amber-50 border border-amber-200 rounded-lg p-3 text-amber-900 text-sm">
                      {isFormOpen
                        ? '이미 발송처리된 주문입니다. 입력한 운송장으로 송장 수정을 요청합니다.'
                        : '이미 발송처리된 주문입니다. 운송장을 고치려면 [송장 수정하기] 를 누르세요.'}
                    </div>
                  )}

                  {/* 발송된 건은 입력칸을 감춰 둔다 — 실수로 정상 송장을 덮어쓰지 않게 한 번 막는다. */}
                  {!isFormOpen && (
                    <div className="mt-4">
                      <button
                        onClick={() => setIsEditingInvoice(true)}
                        disabled={isLocked}
                        className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-100 transition-colors disabled:text-gray-400 disabled:hover:bg-white disabled:cursor-not-allowed"
                      >
                        송장 수정하기
                      </button>
                    </div>
                  )}

                  {isFormOpen && (
                  <div className="mt-4 flex flex-wrap items-center gap-3">
                    {/* 값은 마켓 코드 자체다 — 쿠팡은 택배사 목록 API 가 없고 문서 코드표가 SSOT 라
                        로컬에 등록한 택배사는 [등록 택배사] 그룹으로 맨 위에만 올린다. */}
                    <select
                      value={carrierCode}
                      onChange={(e) => setCarrierCode(e.target.value)}
                      disabled={isInputDisabled}
                      className="px-3 py-2 border border-gray-300 rounded-lg text-sm disabled:bg-gray-100"
                    >
                      <option value="">택배사 선택</option>
                      {registeredOptions.length > 0 && (
                        <optgroup label="등록 택배사">
                          {registeredOptions.map((option) => (
                            <option key={option.deliveryCompanyCode} value={option.deliveryCompanyCode}>
                              {option.carrierName}
                            </option>
                          ))}
                        </optgroup>
                      )}
                      {otherOptions.length > 0 && (
                        <optgroup label={registeredOptions.length > 0 ? '전체 택배사' : '택배사'}>
                          {otherOptions.map((option) => (
                            <option key={option.deliveryCompanyCode} value={option.deliveryCompanyCode}>
                              {option.carrierName}
                            </option>
                          ))}
                        </optgroup>
                      )}
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
                      {isSubmitting ? <Spinner label="전송 중..." /> : (isShipped ? '송장 수정 요청' : '발송처리')}
                    </button>
                  </div>
                  )}

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
                        {/* D16 — 쿠팡은 코드표 전량을 내려주므로 여기까지 오면 서버 쪽 문제다. */}
                        선택할 수 있는 택배사가 없습니다. 잠시 후 다시 시도해주세요.
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
                      {result.mode === 'UPDATE' ? '송장 수정 요청 완료' : '발송처리 완료'} — 박스 {result.shipmentBoxId} ·{' '}
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

              {/* 주문 취소 — 결제완료는 즉시취소, 상품준비중은 출고중지로 접수된다(PLAN 2609_25 D6·D7).
                  노출은 2단계다: ① 섹션 게이트는 `order.status` 로만 판정해 성공 후에도 결과가 남게 하고,
                  ② 취소할 수량이 없는 주문은 섹션 안에서 안내 1줄로 갈린다. */}
              {activeTab === 'cancel' && canCancel && (
                <div className="mt-4">
                  {order.purchasableQty === 0 ? (
                    <p className="mt-1 text-sm text-gray-500">취소 가능한 수량이 없습니다 (이미 취소된 주문)</p>
                  ) : (
                    <>
                      <p className="mt-1 text-sm text-gray-500">
                        결제완료 주문은 즉시 취소되고, 상품준비중 주문은 출고중지로 접수됩니다.
                      </p>
                      {/* 판매자 점수 하락은 화면이 반드시 알려야 하는 대가다(D13). */}
                      <p className="mt-1 text-sm text-red-600">
                        ⚠️ 되돌릴 수 없으며, 쿠팡 판매자 점수(주문이행)가 하락합니다.
                      </p>

                      <div className="mt-4 flex flex-wrap items-center gap-3">
                        {/* 사유 라벨은 서버가 내려준 것만 쓴다 — 하드코딩하면 서버가 값을 늘렸을 때 조용히 어긋난다(D4). */}
                        <select
                          value={cancelReason}
                          onChange={(e) => { setCancelReason(e.target.value); setCancelError(''); }}
                          disabled={isCancelInputDisabled}
                          className="px-3 py-2 border border-gray-300 rounded-lg text-sm disabled:bg-gray-100"
                        >
                          <option value="" disabled>사유를 선택하세요</option>
                          {cancelReasons.map((reason) => (
                            <option key={reason.code} value={reason.code}>{reason.label}</option>
                          ))}
                        </select>

                        <input
                          type="number"
                          min={1}
                          max={order.purchasableQty}
                          value={cancelQty}
                          onChange={(e) => { setCancelQty(Number(e.target.value)); setCancelError(''); }}
                          disabled={isCancelInputDisabled}
                          className="w-24 px-3 py-2 border border-gray-300 rounded-lg text-sm text-right disabled:bg-gray-100"
                        />
                        <span className="text-sm text-gray-500">/ 취소 가능 {order.purchasableQty}개</span>

                        <button
                          onClick={handleCancel}
                          disabled={isCancelInputDisabled || cancelReason === '' || !isCancelQtyValid}
                          className="px-4 py-2 bg-red-600 text-white font-medium rounded-lg hover:bg-red-700 transition-colors disabled:bg-red-300 disabled:cursor-not-allowed"
                        >
                          {isCancelling ? <Spinner label="전송 중..." /> : '주문 취소'}
                        </button>
                      </div>

                      {/* 서버도 400 으로 막지만 왕복하지 않는다(D3). */}
                      {!isCancelQtyValid && (
                        <p className="mt-2 text-sm text-gray-500">1~{order.purchasableQty} 사이로 입력하세요</p>
                      )}

                      {/* 목록을 못 불러온 것과 "값이 없는 것"은 다르다 — 임의 기본값을 만들지 않는다. */}
                      {cancelReasonsFailed && (
                        <p className="mt-2 text-sm text-gray-500">사유 목록을 불러오지 못했습니다.</p>
                      )}
                    </>
                  )}

                  {cancelSucceeded && (
                    <div className="mt-4 bg-green-50 border border-green-200 rounded-lg p-4 text-green-800 text-sm">
                      취소 접수 완료 — {cancelResult?.succeededQty ?? 0}개
                      {cancelReceiptLabel !== '' && ` · ${cancelReceiptLabel}`}
                    </div>
                  )}

                  {cancelError && (
                    <div className="mt-4 bg-red-50 border border-red-200 rounded-lg p-4 text-red-800 text-sm">
                      {cancelError}
                    </div>
                  )}

                  {/* 실패 사유는 쿠팡 원문 그대로 — 번역·요약하면 유일한 진단 정보가 사라진다(D16). */}
                  {cancelResult != null && cancelResult.failed.length > 0 && (
                    <div className="mt-4 bg-red-50 border border-red-200 rounded-lg p-4 text-red-800 text-sm">
                      {cancelResult.failed.map((line) => (
                        <p key={line.orderItemId}>{line.code}: {line.message}</p>
                      ))}
                    </div>
                  )}

                  {cancelResult != null && cancelResult.skipped.length > 0 && (
                    <div className="mt-4 bg-gray-50 border border-gray-200 rounded-lg p-4 text-gray-700 text-sm">
                      {cancelResult.skipped.map((line) => (
                        <p key={line.orderItemId}>{line.reason} ({getOrderStatusLabel(line.status)})</p>
                      ))}
                    </div>
                  )}

                  {cancelResult != null && cancelResult.unsupported.length > 0 && (
                    <div className="mt-4 bg-gray-50 border border-gray-200 rounded-lg p-4 text-gray-700 text-sm">
                      {cancelResult.unsupported.map((line) => (
                        <p key={line.orderItemId}>{line.reason}</p>
                      ))}
                    </div>
                  )}
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

          {/* 발주처리 결과·오류도 이 띠에 둔다 — 버튼이 하단 고정이라 본문이 스크롤돼 있어도
              누른 결과가 눈앞에 남아야 한다. 실패 사유는 쿠팡 원문 그대로(D15). */}
          {ackError && (
            <div className="mt-4 bg-red-50 border border-red-200 rounded-lg p-4 text-red-800 text-sm">
              {ackError}
            </div>
          )}

          {ackResult != null && ackResult.failed.length > 0 && (
            <div className="mt-4 bg-red-50 border border-red-200 rounded-lg p-4 text-red-800 text-sm">
              {ackResult.failed.map((box) => (
                <p key={box.shipmentBoxId}>{box.resultCode}: {box.message}</p>
              ))}
            </div>
          )}

          {ackResult != null && !ackSucceeded && ackResult.failed.length === 0 && (
            <div className="mt-4 bg-amber-50 border border-amber-200 rounded-lg p-4 text-amber-900 text-sm">
              발주처리 대상이 아닙니다. 목록을 새로고침해 상태를 확인해주세요.
            </div>
          )}

          {/* 왼쪽 = 발주처리 하나만. 발주는 발송·취소와 달리 배타적 선택이 아니라 앞 단계라
              탭에 넣지 않고 항상 보이는 자리에 둔다(PLAN 2609_17 D14).
              대상이 아니면 왼쪽 칸은 빈 채로 두고 오른쪽 버튼 자리는 그대로 유지한다. */}
          <div className="flex items-center justify-between gap-3 pt-6">
            <div className="flex items-center gap-3">
              {canAcknowledge &&
                (ackSucceeded ? (
                  <span className="text-sm font-medium text-green-700">발주처리 완료</span>
                ) : (
                  <>
                    <button
                      onClick={handleAcknowledge}
                      disabled={isAcknowledging}
                      className="px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors disabled:bg-blue-400 disabled:cursor-not-allowed"
                    >
                      {isAcknowledging ? <Spinner label="전송 중..." /> : '발주처리'}
                    </button>
                    <span className="hidden text-sm text-gray-500 sm:inline">
                      박스 {order.externalBoxId ?? '-'} 전체가 상품준비중으로 전환됩니다. 되돌릴 수 없습니다.
                    </span>
                  </>
                ))}
            </div>

            <div className="flex shrink-0 gap-2">
              <button
                onClick={handleClose}
                className="px-4 py-2 bg-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-400 transition-colors"
              >
                닫기
              </button>
              {activeTab === 'sheet' && hasLoaded && (
                <button
                  onClick={handleExport}
                  disabled={isPreviewing || isExporting || isEmpty || !!previewError}
                  className="px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors disabled:bg-blue-400 disabled:cursor-not-allowed"
                >
                  {isExporting ? <Spinner label="다운로드 중..." /> : '엑셀 다운로드'}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
