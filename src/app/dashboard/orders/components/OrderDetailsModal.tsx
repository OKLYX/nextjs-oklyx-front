'use client';

import { useEffect, useState } from 'react';
import axios from 'axios';
import { Spinner } from '@/presentation/components/Spinner';
import { addressHead } from '@/infrastructure/utils/address';
import type { OrderItem } from '@/domain/entities/OrderEntity';
import { ELEVENST_RESERVED_LABEL, getOrderStatusLabel, isAlreadyShipped } from '@/domain/entities/OrderEntity';
import type { InternalStage } from '@/domain/entities/OrderEntity';
import type { ShippingLabelUseCase } from '@/application/usecases/ShippingLabelUseCase';
import type { OrderUseCase } from '@/application/usecases/OrderUseCase';
import type {
  CancelReasonOption,
  ElevenstChoices,
  InternalStageResult,
  OrderAcknowledgeResult,
  OrderCancelResult,
  OrderRefreshResult,
} from '@/application/dto/OrderDTOs';
import { extractErrorMessage } from '@/infrastructure/utils/errorMessage';
import type {
  CarrierOption,
  ManualShipmentRequest,
  ManualShipmentResult,
  ShippingLabelExportRow,
} from '@/application/dto/ShippingLabelDTOs';
import { Modal } from '@/presentation/components/ui/Modal';
import { Button } from '@/presentation/components/ui/Button';
import { ConfirmDialog } from '@/presentation/components/ui/ConfirmDialog';
import { InternalStageBadge } from './InternalStageBadge';
import { ReservedShipmentHistory } from './ReservedShipmentHistory';
import { StoredInvoiceEditor } from './StoredInvoiceEditor';
import { ElevenstCancelRequests } from './ElevenstCancelRequests';
import { ElevenstSellerReturnForm } from './ElevenstSellerReturnForm';
import { ElevenstSaleRefusalForm } from './ElevenstSaleRefusalForm';
import { ElevenstDeliveryDelayForm } from './ElevenstDeliveryDelayForm';
import { ElevenstSplitShipmentForm } from './ElevenstSplitShipmentForm';
import type { ElevenstSplitSubmit } from './ElevenstSplitShipmentForm';
import { ElevenstVisitPickupForm } from './ElevenstVisitPickupForm';

/**
 * Order detail modal — read-only info + (ADMIN · Coupang / 11st) single-order label sheet lookup and download.
 * 11st orders also get their cancel requests and the seller return request (FEATURE_2610_17 / D19 · D35), and the
 * 11st seller actions — sale refusal in the cancel tab, delay notice · partial / split shipment · visit pickup in
 * the shipment tab, and [입고완료 처리] in place of [발주처리] for a reserved sale (D61 ~ D67).
 *
 * Action layout — order confirmation sits at the **left of the pinned foot bar**, the rest in the body's **tabs**
 * (from the left: label sheet · shipment · order cancel; shipment is selected by default). Confirmation is the step
 * before the others, so it is not mixed into the tabs; the three tabs are an exclusive choice, so they are not
 * stacked. The Excel download button shows in the foot bar only on the sheet tab, where the table is visible.
 * The sheet section expands this modal inline instead of a new popup. The table editing UI looks like the existing
 * `ShippingLabelPreviewModal` (whole order list) but is **not extracted into a shared component** — the user decision
 * (PLAN D5) keeps the regression risk of the already-verified order-list download at 0.
 *
 * ⚠️ The sheet lookup is a live marketplace call, so it does not run when the modal opens (button click only).
 * ⚠️ The parent always renders this modal and hides it with a null guard, so closing does not unmount it → state
 * reset is the parent's `key={selectedOrder?.id ?? 'none'}` remount (a new instance when the order changes or the
 * modal closes). Resetting in an effect trips the project lint (`react-hooks/set-state-in-effect`).
 * The reset in `handleClose` is a backup for close paths that bypass the parent.
 * ⚠️ useCase reuses the parent's (OrderContainer) useMemo instance — do not create a new one here.
 * ⚠️ Phone / postcode / full address are never rendered in the DOM; they stay in state only (for the export POST).
 */
interface OrderDetailsModalProps {
  order: OrderItem | null;
  /** true = 발송처리가 성공했다 → 부모가 목록을 다시 불러와야 한다(PLAN 2609_11 D13). */
  onClose: (didSucceed: boolean) => void;
  isAdmin: boolean;
  useCase: ShippingLabelUseCase;
  /** 발주처리(결제완료→상품준비중) 전용. 주문내역·출고관리 두 호출부가 모두 넘긴다. */
  orderUseCase: OrderUseCase;
  /**
   * 주문 상태 갱신이 끝났다 → 부모가 목록을 다시 불러오고 이 모달의 `order` prop 을 새 행으로 교체한다
   * (PLAN 2609_50 D13). 모달은 닫지 않는다 — 사용자는 상태가 바뀌었는지 보려고 누른다.
   */
  onRefreshed?: () => Promise<void> | void;
}

const PARCEL_MIN_MESSAGE = '택배수량은 1 이상이어야 합니다.';

// Platform display labels for the missing-phone banner. Only COUPANG and ELEVENST reach it: the sheet button is
// disabled for every other platform (`!isMarketOrder`, FEATURE_2610_17 / D2). Kept as a map (not a literal
// '쿠팡') so another platform needs one entry, not a rewrite; unknown codes fall back to the raw code.
const PLATFORM_LABELS: Record<string, string> = { COUPANG: '쿠팡', ELEVENST: '11번가' };

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

export function OrderDetailsModal({ order, onClose, isAdmin, useCase, orderUseCase, onRefreshed }: OrderDetailsModalProps) {
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
  // 내부 발주처리(FEATURE_2609_75 / D13). 쿠팡에 보내지 않는다.
  const [internalResult, setInternalResult] = useState<InternalStageResult | null>(null);
  const [isMarkingInternal, setIsMarkingInternal] = useState(false);
  const [internalError, setInternalError] = useState('');
  // 예약 발송 기록에서 행 작업이 성공했다 → 닫을 때 부모가 목록을 다시 불러온다(FEATURE_2609_75 / D30).
  const [reservationChanged, setReservationChanged] = useState(false);
  // D14 안내 Modal — 내부 단계 주문에 [발주처리]를 눌렀을 때.
  const [ackConfirmOpen, setAckConfirmOpen] = useState(false);
  // 주문 상태 갱신(쿠팡에서 이 주문을 다시 읽어 상태를 맞춘다, PLAN 2609_50). 읽기라 탭 밖에 둔다(D12).
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshBanner, setRefreshBanner] = useState('');
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
  // FEATURE_2610_17 / D61 · D62 · D63: the 11st reason lists, loaded once for an 11st order (server-owned).
  const [elevenstChoices, setElevenstChoices] = useState<ElevenstChoices | null>(null);
  const [elevenstChoicesFailed, setElevenstChoicesFailed] = useState(false);
  // D64: how an 11st single invoice is sent — the whole delivery (default), chosen lines, or one line split.
  const [elevenstMode, setElevenstMode] = useState<'ALL' | 'PARTIAL' | 'SPLIT'>('ALL');
  // D67: [입고완료 처리] of a reserved-sale line.
  const [stockConfirmOpen, setStockConfirmOpen] = useState(false);
  const [isConfirmingStock, setIsConfirmingStock] = useState(false);
  const [stockSent, setStockSent] = useState(false);
  const [stockError, setStockError] = useState('');

  // Carrier list load — the platform's code table (Coupang has no carrier-list API; 11st uses the same catalog),
  // served from our own backend, not a marketplace call, so it runs on open without a button. The guard mirrors
  // the sections' render gate (Coupang · 11st, FEATURE_2610_17 / D2): hooks run even when the section is hidden,
  // so without it a USER account would hammer an ADMIN-only endpoint for 403s.
  // Deps are the platform *string* and isAdmin — passing the order object refetches every render.
  useEffect(() => {
    const platform = order?.platform;
    if (!isAdmin || (platform !== 'COUPANG' && platform !== 'ELEVENST')) return;
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

  // 11st reason lists (FEATURE_2610_17 / D61 · D62 · D63) — our own backend, not an 11st call; same guard style as
  // the cancel-reason load above (ADMIN · this platform only, `alive` against a set-state after unmount).
  useEffect(() => {
    if (!isAdmin || order?.platform !== 'ELEVENST') return;
    let alive = true;
    void (async () => {
      try {
        const choices = await orderUseCase.getElevenstChoices();
        if (alive) {
          setElevenstChoices(choices);
          setElevenstChoicesFailed(false);
        }
      } catch {
        if (alive) setElevenstChoicesFailed(true);
      }
    })();
    return () => { alive = false; };
  }, [isAdmin, order?.platform, orderUseCase]);

  if (order == null) return null;

  const isEmpty = hasLoaded && rows.length === 0;
  const isCoupang = order.platform === 'COUPANG';
  // FEATURE_2610_17 / D28: order confirmation, single invoice and the sheet are open to 11st as well, and the seller
  // cancel opens as 11st sale refusal (D61); refresh · internal stage · reservation stay Coupang only (D12).
  const isElevenst = order.platform === 'ELEVENST';
  const isMarketOrder = isCoupang || isElevenst;
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
  const internalMarked = internalResult != null && internalResult.changedShipments > 0;
  // 배지 = 방금 한 동작의 결과가 우선. 발주처리 성공이면 서버가 내부 단계를 지웠다(D14).
  const shownStage: InternalStage | null = ackSucceeded
    ? null
    : internalMarked ? 'INTERNAL_PREPARING' : order.internalStage;
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
  // Action gates — order confirmation goes to the pinned foot bar, the other two (shipment · cancel) split into
  // tabs. An 11st reserved sale (raw 201) is not confirmed yet — [입고완료 처리] takes the slot instead (D67).
  const canAcknowledge = isAdmin && isMarketOrder && order.status === 'PAID' && !fullyCanceled && !order.reservedSale;
  const canStockConfirm = isAdmin && isElevenst && order.reservedSale && order.status === 'PAID' && !fullyCanceled;
  const stockConfirmed = stockSent || order.stockConfirmSent;
  // [Internal acknowledge] = Coupang [발주처리] targets without an internal stage (D1·D13 · FEATURE_2610_17 / D12).
  const canMarkInternal = canAcknowledge && isCoupang && order.internalStage == null;
  // 시트는 쿠팡 전용이 아니다 — 버튼만 비활성되고 안내가 붙으므로 ADMIN 이면 탭을 연다.
  const canSheet = isAdmin;
  const canShip = isAdmin && isMarketOrder && !fullyCanceled;
  // 11st sale refusal (D61) also needs a line that is not fully cancelled.
  const canCancel = isAdmin && (isCoupang || (isElevenst && !fullyCanceled))
    && (order.status === 'PAID' || order.status === 'PREPARING');
  // D66: a visit-pickup 11st order gets [방문수령 완료] instead of the invoice form, from paid on.
  const showVisitPickup = isElevenst && order.visitPickup && (order.status === 'PAID' || order.status === 'PREPARING');
  // D63: [발송지연 안내] under the shipment tab for a paid / preparing 11st order.
  const showDeliveryDelay = isElevenst && (order.status === 'PAID' || order.status === 'PREPARING');
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
    onClose(
      (result != null && result.succeeded > 0) || ackSucceeded || cancelSucceeded || internalMarked || reservationChanged
        || stockSent
    );
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
      setPreviewError('마켓 주문 조회에 실패했습니다. 다시 시도해주세요.');
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
   * Single order confirmation — paid → preparing for the one box this line belongs to (Coupang) or for this line's
   * (delivery number, product number) group (11st, FEATURE_2610_17 / D48). Same endpoint as the bulk one (shipment
   * page, PLAN 2609_17 D6) — the server decides the targets.
   */
  const runAcknowledge = async () => {
    try {
      setIsAcknowledging(true);
      setAckError('');
      setAckResult(await orderUseCase.acknowledgeOrders([order.id]));
    } catch (err) {
      // 요청이 안 갔을 수도 있으므로 버튼은 다시 누를 수 있게 열어 둔다(예약 처리 중 400 포함).
      setAckError(extractErrorMessage(err, '발주처리에 실패했습니다. 다시 시도해주세요.'));
    } finally {
      setIsAcknowledging(false);
    }
  };

  // 내부 단계 주문이면 D14 안내 Modal 을 먼저 띄운다. 방금 이 창에서 내부 발주한 주문(internalMarked)도 서버에서는 내부 단계다.
  const handleAcknowledge = () => {
    if (order.internalStage != null || internalMarked) {
      setAckConfirmOpen(true);
      return;
    }
    void runAcknowledge();
  };

  /** 내부 발주처리 — 쿠팡에 보내지 않는다(D1). 성공하면 배지가 「내부 상품준비중」으로 바뀐다. */
  const handleMarkInternal = async () => {
    try {
      setIsMarkingInternal(true);
      setInternalError('');
      setInternalResult(await orderUseCase.markInternal([order.id]));
    } catch (err) {
      setInternalError(extractErrorMessage(err, '내부 발주처리에 실패했습니다. 다시 시도해주세요.'));
    } finally {
      setIsMarkingInternal(false);
    }
  };

  /**
   * 이 주문 1건을 쿠팡에서 다시 읽어 로컬 상태를 맞춘다(PLAN 2609_50).
   *
   * 일괄 상태 갱신과 **같은 엔드포인트**를 쓴다(D14, 길이 1) — 판정을 두 곳에 두지 않는다.
   * ⚠️ 성공해도 모달을 닫지 않는다(D13). `onClose(true)` 는 발송처리 성공 규약이라 여기서 부르지 않는다.
   */
  const handleRefresh = async () => {
    try {
      setIsRefreshing(true);
      setRefreshBanner('');
      const result: OrderRefreshResult = await orderUseCase.refreshOrders([order.id]);
      if (result.failed.length > 0) {
        // 사유는 서버 원문 그대로 — 사용자가 고칠 수 있는 정보가 여기 담긴다.
        setRefreshBanner(result.failed[0].reason);
      } else if (result.unsupported.length > 0) {
        setRefreshBanner('이 채널은 주문 상태 갱신을 지원하지 않습니다.');
      } else if (result.cancelled.length > 0) {
        // 쿠팡이 "이미 끝난 주문"이라고 답한 경우 — 서버가 로컬도 함께 정리했다.
        const marked = result.cancelled[0];
        setRefreshBanner(marked.cancelledLines > 0
          ? '마켓에서 취소·반품된 주문입니다. 발송 전이라 취소로 정리했습니다.'
          : '마켓에서 취소·반품된 주문입니다. 이미 발송한 건이라 금액은 그대로 두었습니다.');
      } else if (result.empty.length > 0) {
        setRefreshBanner('마켓에 남은 배송건이 없습니다(전량 취소로 보입니다).');
      } else if (result.refreshed > 0) {
        setRefreshBanner('최신 상태로 갱신했습니다.');
      } else {
        // 갱신 0건은 실패가 아니다 — 이미 최신이면 0이 정상이다.
        setRefreshBanner('이미 최신입니다.');
      }
      await onRefreshed?.();
    } catch (err) {
      setRefreshBanner(extractErrorMessage(err, '주문 상태 갱신에 실패했습니다. 다시 시도해주세요.'));
    } finally {
      setIsRefreshing(false);
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
   * Single shipment — sends the one box the anchor line belongs to (11st: the whole delivery, or with `mode` the
   * chosen lines / one line split, FEATURE_2610_17 / D64).
   * - The send unit is the whole box. The server expands the box lines (PLAN 2609_11 D1) — only the anchor goes.
   * - New upload / invoice edit mode is decided by the server from the order status (D3) — the client only relabels.
   * - The inputs lock only after a 200. A request that failed outright does not lock (D14).
   */
  const submitManual = async (request: ManualShipmentRequest) => {
    try {
      setIsSubmitting(true);
      setSubmitError('');
      const response = await useCase.confirmManualShipment(request);
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

  const handleManualConfirm = () => {
    if (carrierCode === '') return;
    // orderItemId is our order_item PK (`order.id`) — the visible `order.externalItemId`
    // (Coupang vendorItemId) would fail silently. Same value previewRowsByOrder takes.
    void submitManual({
      orderItemId: order.id,
      deliveryCompanyCode: carrierCode,
      invoiceNumber: invoiceNumber.trim(),     // D15: trim only, no format check
    });
  };

  // FEATURE_2610_17 / D64: 「일부 줄만 보내기」 · 「한 줄을 송장 여러 장으로」 go through the same endpoint.
  const handleElevenstModeSubmit = (submit: ElevenstSplitSubmit) => {
    if (elevenstMode === 'ALL') return;
    void submitManual({
      orderItemId: order.id,
      deliveryCompanyCode: submit.carrierCode,
      invoiceNumber: submit.invoiceNumber,
      mode: elevenstMode,
      orderItemIds: submit.orderItemIds,
      splits: submit.splits,
    });
  };

  /** [입고완료 처리] of a reserved-sale 11st line (D67) — the raw status is left to the next sync. */
  const handleStockConfirm = async () => {
    setStockConfirmOpen(false);
    try {
      setIsConfirmingStock(true);
      setStockError('');
      await orderUseCase.confirmElevenstStock(order.id);
      setStockSent(true);
    } catch (err) {
      setStockError(extractErrorMessage(err, '입고완료 처리에 실패했습니다. 다시 시도해주세요.'));
    } finally {
      setIsConfirmingStock(false);
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
    // A successful CREATE writes 「발송처리」 back server-side; show it straight from the result (D4).
    // ⚠️ The shipment result comes first — reversing the order hides 「발송처리」 from a user who confirmed and then
    // shipped in one modal. The cancel is the last step, so the cancel result wins — a full cancel comes back as
    // 'CANCELLED' from the server (D14).
    // FEATURE_2610_17 / D67: a reserved-sale line shows the 11st label beside its status.
    { label: '상태', value: getOrderStatusLabel(
        cancelledLine?.resultStatus ?? result?.resultStatus ?? (ackSucceeded ? 'PREPARING' : order.status))
        + (order.reservedSale ? ` · ${ELEVENST_RESERVED_LABEL}` : '') },
    { label: '결제일', value: formatDate(order.paidAt) },
    { label: '마켓 계정 ID', value: order.marketplaceAccountId },
  ];

  // 기하 고정(D1) — 시트를 펼쳐도 모달 크기가 변하지 않는다. `fullHeight` 가 그 역할을 승계한다.
  return (
    <Modal isOpen onClose={handleClose} title="주문 상세" fullHeight>

        {/* 쿠팡에서 이 주문을 다시 읽어 상태를 맞춘다 — 읽기라서 탭(쓰기 작업) 밖에 둔다(PLAN 2609_50 D12).
            쿠팡 주문에만 보인다(D17) — isAdmin 은 걸지 않는다(읽기다).
            스크롤 밴드 앞에 둬야 길게 내려도 버튼이 남는다. 공용 Modal 의 title 은 string 이라 제목줄에
            버튼을 끼울 수 없고, 앱 전체가 쓰는 공용 컴포넌트를 고치지 않는다. */}
        {isCoupang && (
          <div className="flex items-center justify-between gap-2 pb-3 border-b border-gray-200">
            <span className="text-xs text-gray-500">
              주문번호 {order.externalOrderId}
              <InternalStageBadge stage={shownStage} />
            </span>
            <button
              type="button"
              onClick={() => void handleRefresh()}
              disabled={isRefreshing}
              className="px-3 py-1.5 text-sm font-medium rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isRefreshing ? <Spinner label="확인 중..." /> : '주문 상태 갱신'}
            </button>
          </div>
        )}

        {refreshBanner && (
          <p className="pt-2 text-sm text-gray-800">{refreshBanner}</p>
        )}

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

          {/* FEATURE_2610_17 / D19 · D35 — 11st only: the buyer's open cancel requests, and the seller return
              request for a shipped line that is not fully cancelled (D39 ⑤). */}
          {isElevenst && (
            <ElevenstCancelRequests
              orderItemId={order.id}
              isAdmin={isAdmin}
              orderUseCase={orderUseCase}
              carrierOptions={carrierOptions}
              faultRejectReasons={elevenstChoices?.faultRejectReasons ?? []}
              onChanged={() => setReservationChanged(true)}
            />
          )}
          {isElevenst && isAdmin && !fullyCanceled
            && (order.status === 'SHIPPED' || order.status === 'DELIVERING' || order.status === 'DELIVERED') && (
            <ElevenstSellerReturnForm
              orderItemId={order.id}
              quantity={order.orderCount}
              orderUseCase={orderUseCase}
              carrierOptions={carrierOptions}
            />
          )}

          {/* 송장(FEATURE_2609_75 / D18 🔁) — 내부 단계 동안 언제나 배송 묶음별 택배사·송장번호를 고친다.
              택배사 목록은 이 모달이 이미 불러온 `carrierOptions` 를 넘긴다(새로 부르지 않는다). */}
          {isAdmin && isCoupang && shownStage != null && (
            <div className="mt-6 border-t border-gray-200 pt-6">
              <StoredInvoiceEditor
                useCase={useCase}
                externalOrderId={order.externalOrderId}
                carrierOptions={carrierOptions}
                onChanged={() => setReservationChanged(true)}
              />
            </div>
          )}

          {/* 예약 발송 기록(FEATURE_2609_75 / D30) — 이 주문의 예정·실행 시각과 결과 + 행 작업. 기록이 없으면 그리지 않는다. */}
          {isAdmin && isCoupang && (
            <ReservedShipmentHistory
              useCase={useCase}
              externalOrderId={order.externalOrderId}
              onChanged={() => setReservationChanged(true)}
            />
          )}

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

              {/* Label sheet — the lookup is a live marketplace call, so opening the tab does not run it.
                  It runs on the button, and the loaded table stays in this tab (kept across tab switches). */}
              {activeTab === 'sheet' && canSheet && (
                <div className="mt-4">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={handlePreview}
                      disabled={!isMarketOrder || isPreviewing}
                      className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-100 transition-colors disabled:text-gray-400 disabled:hover:bg-white disabled:cursor-not-allowed"
                    >
                      {isPreviewing ? <Spinner label="불러오는 중..." /> : '송장시트 조회'}
                    </button>
                    {!isMarketOrder && <span className="text-sm text-gray-500">쿠팡 · 11번가 주문만 지원합니다.</span>}
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
                              <thead className="bg-gray-100 border-b border-gray-200">
                                <tr className="text-left text-xs font-medium text-gray-500">
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
              {/* 내부 단계 주문(FEATURE_2609_75 / D27) — 새 입력을 막고 「송장」 + [저장된 송장으로 발송]으로 안내한다.
                  판정 = 주문번호 옆 배지와 같은 `shownStage`. 서버도 같은 문구로 거절한다(400, PLAN §4-4). */}
              {activeTab === 'shipment' && canShip && shownStage != null && (
                <div className="mt-4 bg-amber-50 border border-amber-200 rounded-lg p-3 text-amber-900 text-sm">
                  내부 단계 주문은 여기서 발송처리할 수 없습니다. 「송장」에 송장을 저장한 뒤 출고관리의 [저장된 송장으로 발송]을 누르세요
                </div>
              )}
              {/* FEATURE_2610_17 / D20 · D21 — an 11st invoice needs [발주처리] first, and 11st has no
                  invoice-update API: both cases show the notice instead of the form. A visit-pickup order shows
                  [방문수령 완료] instead, from paid on (D66). */}
              {canShip && showVisitPickup && (
                <div className={activeTab === 'shipment' ? undefined : 'hidden'}>
                  <ElevenstVisitPickupForm
                    orderItemId={order.id}
                    orderUseCase={orderUseCase}
                    onDone={() => setReservationChanged(true)}
                  />
                </div>
              )}
              {activeTab === 'shipment' && canShip && isElevenst && !showVisitPickup
                && (order.status === 'PAID' || isShipped) && (
                <div className="mt-4 bg-amber-50 border border-amber-200 rounded-lg p-3 text-amber-900 text-sm">
                  {order.status === 'PAID'
                    ? '11번가 주문은 [발주처리] 뒤에 송장을 등록할 수 있습니다.'
                    : '11번가는 송장 수정을 지원하지 않습니다. 11번가 셀러오피스에서 고쳐 주세요.'}
                </div>
              )}
              {/* FEATURE_2610_17 / D64 — an 11st invoice of a preparing order picks how it goes; the choice
                  locks with the inputs. The 11st forms stay mounted and only hide on another tab, so their inputs
                  survive a tab switch like the parent-held inputs below. */}
              {canShip && isElevenst && shownStage == null && !showVisitPickup && order.status === 'PREPARING' && (
                <div className={activeTab === 'shipment' ? undefined : 'hidden'}>
                  <div className="mt-4 flex flex-wrap items-center gap-4 text-sm text-gray-800">
                    {([
                      ['ALL', '한 번에 모두'],
                      ['PARTIAL', '일부 줄만 보내기'],
                      ['SPLIT', '한 줄을 송장 여러 장으로'],
                    ] as const).map(([mode, label]) => (
                      <label key={mode} className="flex items-center gap-2">
                        <input
                          type="radio"
                          name="elevenstMode"
                          checked={elevenstMode === mode}
                          onChange={() => setElevenstMode(mode)}
                          disabled={isLocked}
                        />
                        {label}
                      </label>
                    ))}
                  </div>
                  <div className={elevenstMode === 'ALL' ? 'hidden' : undefined}>
                    <ElevenstSplitShipmentForm
                      mode={elevenstMode === 'SPLIT' ? 'SPLIT' : 'PARTIAL'}
                      orderItemId={order.id}
                      orderUseCase={orderUseCase}
                      carrierOptions={carrierOptions}
                      isLocked={isInputDisabled}
                      isSending={isSubmitting}
                      onSubmit={handleElevenstModeSubmit}
                    />
                  </div>
                </div>
              )}
              {activeTab === 'shipment' && canShip && shownStage == null && !showVisitPickup
                && !(isElevenst && (order.status === 'PAID' || isShipped)) && (
                <div className="mt-4">
                  {elevenstMode === 'ALL' && (
                    <p className="mt-1 text-sm text-gray-500">
                      박스 {order.externalBoxId ?? '-'} 의 모든 옵션에 같은 운송장번호가 적용됩니다.
                    </p>
                  )}

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

                  {isFormOpen && elevenstMode === 'ALL' && (
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

                    {/* type="text": invoice formats differ per carrier and the marketplace validates them (D15). */}
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
                          <thead className="bg-gray-100 border-b border-gray-200">
                            <tr className="text-left text-xs font-medium text-gray-500">
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

              {/* FEATURE_2610_17 / D63 — [발송지연 안내] under the shipment tab, paid / preparing 11st orders. */}
              {canShip && showDeliveryDelay && (
                <div className={activeTab === 'shipment' ? undefined : 'hidden'}>
                  <ElevenstDeliveryDelayForm
                    orderItemId={order.id}
                    reasons={elevenstChoices?.delayReasons ?? []}
                    reasonsFailed={elevenstChoicesFailed}
                    orderUseCase={orderUseCase}
                  />
                </div>
              )}

              {/* 11st order cancel = sale refusal of the whole line (FEATURE_2610_17 / D61). */}
              {canCancel && isElevenst && (
                <div className={activeTab === 'cancel' ? undefined : 'hidden'}>
                  <ElevenstSaleRefusalForm
                    orderItemId={order.id}
                    quantity={order.orderCount}
                    purchasableQty={order.purchasableQty}
                    reasons={elevenstChoices?.cancelReasons ?? []}
                    reasonsFailed={elevenstChoicesFailed}
                    orderUseCase={orderUseCase}
                    onSent={() => setReservationChanged(true)}
                  />
                </div>
              )}

              {/* Coupang order cancel — paid goes through as an instant cancel, preparing as a shipment stop
                  (PLAN 2609_25 D6·D7). Shown in two steps: ① the section gate reads only `order.status`, so the
                  result stays after a success, and ② an order with nothing left to cancel gets a one-line notice
                  inside the section. */}
              {activeTab === 'cancel' && canCancel && isCoupang && (
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

          {internalError && (
            <div className="mt-4 bg-red-50 border border-red-200 rounded-lg p-4 text-red-800 text-sm">
              {internalError}
            </div>
          )}

          {stockError && (
            <div className="mt-4 bg-red-50 border border-red-200 rounded-lg p-4 text-red-800 text-sm">
              {stockError}
            </div>
          )}

          {/* 왼쪽 = 발주처리 하나만. 발주는 발송·취소와 달리 배타적 선택이 아니라 앞 단계라
              탭에 넣지 않고 항상 보이는 자리에 둔다(PLAN 2609_17 D14).
              대상이 아니면 왼쪽 칸은 빈 채로 두고 오른쪽 버튼 자리는 그대로 유지한다. */}
          <div className="flex items-center justify-between gap-3 pt-6">
            <div className="flex items-center gap-3">
              {/* FEATURE_2610_17 / D67 — a reserved sale takes [입고완료 처리] in the [발주처리] slot. */}
              {canStockConfirm &&
                (stockConfirmed ? (
                  <span className="text-sm font-medium text-green-700">입고완료 보냄</span>
                ) : (
                  <Button variant="primary" onClick={() => setStockConfirmOpen(true)} disabled={isConfirmingStock}>
                    {isConfirmingStock ? <Spinner label="전송 중..." /> : '입고완료 처리'}
                  </Button>
                ))}
              {canAcknowledge &&
                (ackSucceeded ? (
                  <span className="text-sm font-medium text-green-700">발주처리 완료</span>
                ) : (
                  <>
                    <button
                      onClick={handleAcknowledge}
                      disabled={isAcknowledging || isMarkingInternal}
                      className="px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors disabled:bg-blue-400 disabled:cursor-not-allowed"
                    >
                      {isAcknowledging ? <Spinner label="전송 중..." /> : '발주처리'}
                    </button>
                    {canMarkInternal &&
                      (internalMarked ? (
                        <span className="text-sm font-medium text-green-700">내부 발주 완료</span>
                      ) : (
                        <Button
                          variant="confirm"
                          onClick={() => void handleMarkInternal()}
                          disabled={isAcknowledging || isMarkingInternal}
                        >
                          {isMarkingInternal ? <Spinner label="처리 중..." /> : '내부 발주처리'}
                        </Button>
                      ))}
                    {/* FEATURE_2610_17 / D52: 11st confirms this product only — its notice has no box number. */}
                    <span className="hidden text-sm text-gray-500 sm:inline">
                      {isElevenst
                        ? '이 상품(주문 줄)이 발주확인 처리되어 배송준비중으로 바뀝니다. 되돌릴 수 없습니다.'
                        : `박스 ${order.externalBoxId ?? '-'} 전체가 상품준비중으로 전환됩니다. 되돌릴 수 없습니다.`}
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
        <ConfirmDialog
          isOpen={ackConfirmOpen}
          nested
          title="예약된 주문 포함"
          message="예약된 주문입니다. 쿠팡에 지금 발주처리하면 해당 주문의 내부 발주·예약 발송이 해제됩니다. 계속할까요?"
          confirmText="발주처리"
          isDangerous
          onConfirm={() => { setAckConfirmOpen(false); void runAcknowledge(); }}
          onCancel={() => setAckConfirmOpen(false)}
        />
        <ConfirmDialog
          isOpen={stockConfirmOpen}
          nested
          title="입고완료 처리"
          message="상품이 입고되어 발송 준비가 되었으면 처리하세요. 되돌릴 수 없습니다."
          confirmText="입고완료 처리"
          isDangerous
          onConfirm={() => void handleStockConfirm()}
          onCancel={() => setStockConfirmOpen(false)}
        />
    </Modal>
  );
}
