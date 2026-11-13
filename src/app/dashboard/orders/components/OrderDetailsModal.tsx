'use client';

import { useEffect, useState, type ReactNode } from 'react';
import axios from 'axios';
import { Spinner } from '@/presentation/components/Spinner';
import { Lock } from 'lucide-react';
import { addressHead } from '@/infrastructure/utils/address';
import type { OrderDetail, OrderDetailParcel, OrderItem, OrderStatus } from '@/domain/entities/OrderEntity';
import { getOrderStatusLabel, isAlreadyShipped, orderNetAmount } from '@/domain/entities/OrderEntity';
import type { InternalStage } from '@/domain/entities/OrderEntity';
import type { ShippingLabelUseCase } from '@/application/usecases/ShippingLabelUseCase';
import type { OrderUseCase } from '@/application/usecases/OrderUseCase';
import type {
  CancelReasonOption,
  ElevenstChoices,
  InternalStageResult,
  LotteonChoices,
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
import { DataCard, DataCardSwitch } from '@/presentation/components/DataCard';
import { QuantityStepper } from '@/presentation/components/QuantityStepper';
import { ReservedShipmentHistory } from './ReservedShipmentHistory';
import { StoredInvoiceEditor } from './StoredInvoiceEditor';
import { ElevenstCancelRequests } from './ElevenstCancelRequests';
import { ElevenstSellerReturnForm } from './ElevenstSellerReturnForm';
import { ElevenstSaleRefusalForm } from './ElevenstSaleRefusalForm';
import { ElevenstDeliveryDelayForm } from './ElevenstDeliveryDelayForm';
import { ElevenstSplitShipmentForm } from './ElevenstSplitShipmentForm';
import type { ElevenstSplitSubmit } from './ElevenstSplitShipmentForm';
import { ElevenstVisitPickupForm } from './ElevenstVisitPickupForm';
import { LotteonCancelRequests } from './LotteonCancelRequests';
import { LotteonSellerCancelForm } from './LotteonSellerCancelForm';
import { LotteonDeliveryAppointmentForm } from './LotteonDeliveryAppointmentForm';
import { LotteonInvoiceEditModal } from './LotteonInvoiceEditModal';
import { OrderDetailSummary } from './OrderDetailSummary';
import { OrderDetailHeader, OrderRefreshButton } from './OrderDetailHeader';
import { OrderProgress } from './OrderProgress';
import { OrderNextStepCard } from './OrderNextStepCard';
import { platformName } from '@/config/platforms';

/**
 * The shared order detail modal (FEATURE_2611_07 / D4 · D21) — one modal, two entries:
 * - line mode (props `order` …): 「주문내역」 · 「출고관리」 open it by the clicked order line.
 * - packing mode (props `parcelId` …): 「포장 작업」 「오늘 완료」 opens it by the clicked parcel — the header without status,
 *   the product, order info, customer and invoice groups and [상자 변경] only, none of the actions below
 *   (D13 · D14 · FEATURE_2611_29 / D19 ① · R17).
 * Both modes read the order from the server (`getOrderDetail` / `getParcelOrderDetail`, D18 · D30); the header is
 * `OrderDetailHeader`, pinned above the scrolling band (FEATURE_2611_29 / D33), and the body is `OrderDetailSummary`.
 *
 * Line mode — read-only info + (ADMIN · Coupang / 11st / LotteON) single-order label sheet lookup and download.
 * 11st orders also get their cancel requests and the seller return request (FEATURE_2610_17 / D19 · D35), and the
 * 11st seller actions — sale refusal in the cancel tab, delay notice · partial / split shipment · visit pickup in
 * the shipment tab, and [입고완료 처리] in place of [발주처리] for a reserved sale (D61 ~ D67).
 *
 * Action layout (FEATURE_2611_29 / D2 · D5 · D6 · D7) — header → progress → next step card → marketplace requests →
 * tabs → body, with only the close button in the foot bar. Order confirmation lives in the next step card under the
 * progress strip; the rest is in the **tabs** (from the left: label sheet · shipment · order cancel; shipment is
 * selected first, a fully canceled order opens on the cancel tab). Locked tabs stay visible with a lock icon and a
 * reason. The Excel download button sits next to the sheet lookup button inside the sheet tab (D19 ③).
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
interface LineModeProps {
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

/** Packing mode — opened from a 「포장 작업」 「오늘 완료」 row (FEATURE_2611_07 / D1 · D6 · D30 ②). */
interface PackingModeProps {
  parcelId: number;
  orderUseCase: OrderUseCase;
  /** A change re-reads the order detail, keeping the open chip (D7 · D28) */
  reloadKey: number;
  onClose: () => void;
  /** [상자 변경] of a packed parcel (D2 · D24) */
  onChangeBox: (parcel: OrderDetailParcel) => void;
}

type OrderDetailsModalProps = LineModeProps | PackingModeProps;

const PARCEL_MIN_MESSAGE = '택배수량은 1 이상이어야 합니다.';

// Order detail action tabs, left to right: label sheet → shipment → order cancel. Shipment is selected first, a fully
// canceled order opens on the cancel tab (FEATURE_2611_29 / D6 · R10). Tab names come from `tabLabel`.
const ACTION_TABS = [{ key: 'sheet' }, { key: 'shipment' }, { key: 'cancel' }] as const;

type ActionTab = (typeof ACTION_TABS)[number]['key'];

// Quantity text of a fully canceled order — the hold count only when there is one (FEATURE_2611_29 / D15 supplement).
function cancelQtyText(cancel: number, hold: number): string {
  return hold > 0 ? `취소 수량 ${cancel}개 · 보류 ${hold}개` : `취소 수량 ${cancel}개`;
}

// The next step card per shown status (FEATURE_2611_29 / D15 · R8); paid uses the confirmation card, preparing has none.
const NEXT_STEP_BY_STATUS: Partial<Record<OrderStatus, { title: string; body: string }>> = {
  SHIPPED: { title: '택배 집하 대기', body: '택배사가 집하하면 배송중으로 바뀝니다. 송장 수정 탭에서 송장을 고칠 수 있습니다.' },
  DELIVERING: { title: '배송 중', body: '고객에게 가는 중입니다.' },
  DELIVERED: { title: '배송 완료', body: '처리할 작업이 없습니다.' },
};

// Lock reasons of the tabs (FEATURE_2611_29 / D5 · R9) — every other locked tab has no reason.
const TAB_LOCK_CANCELED = '취소된 주문';
const TAB_LOCK_SHIPPED = '발송 후에는 취소할 수 없습니다(반품으로 처리)';

// 취소 접수 유형 라벨 — 쿠팡 `receiptType`(CANCEL=즉시취소 / STOP_SHIPMENT=출고중지) 표시 전용.
// 이 모달 안에서만 쓰므로 엔티티·DTO 로 빼지 않는다. 모르는 코드는 원문 그대로 보여준다(PLAN 2609_25 D16).
const RECEIPT_TYPE_LABELS: Record<string, string> = {
  CANCEL: '즉시취소',
  STOP_SHIPMENT: '출고중지 접수',
};

/** Load state of the order detail — 「불러오는 중...」 only before the first response; a failure shows its text (D18). */
function DetailLoadState({ loaded, error }: { loaded: boolean; error: string }) {
  if (error) return <p className="py-2 text-sm text-red-600">{error}</p>;
  if (loaded) return null;
  return <p className="py-2 text-sm text-gray-500">불러오는 중...</p>;
}

/** The chip that opens: the one picked if it is still there, otherwise the first chip (D28). */
function openChipOf(detail: OrderDetail, picked: number | null): number | null {
  if (picked != null && detail.parcels.some((parcel) => parcel.parcelId === picked)) return picked;
  return detail.parcels[0]?.parcelId ?? null;
}

export function OrderDetailsModal(props: OrderDetailsModalProps) {
  if ('parcelId' in props) return <PackingOrderDetailsModal {...props} />;
  return <LineOrderDetailsModal {...props} />;
}

function PackingOrderDetailsModal({ parcelId, orderUseCase, reloadKey, onClose, onChangeBox }: PackingModeProps) {
  const [detail, setDetail] = useState<OrderDetail | null>(null);
  const [detailError, setDetailError] = useState('');
  // The clicked parcel's chip opens first (D28); a reload keeps the open chip (D7).
  const [openParcelId, setOpenParcelId] = useState<number | null>(parcelId);

  // Reads on open and on every `reloadKey` change; the drawn content stays until the new response arrives.
  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const loaded = await orderUseCase.getParcelOrderDetail(parcelId);
        if (alive) {
          setDetail(loaded);
          setDetailError('');
        }
      } catch (err) {
        if (alive) setDetailError(extractErrorMessage(err, '주문 상세를 불러오지 못했습니다.'));
      }
    })();
    return () => { alive = false; };
  }, [parcelId, orderUseCase, reloadKey]);

  return (
    <Modal isOpen onClose={onClose} title="주문 상세" fullHeight fullScreenOnNarrow>
      {/* The header stays pinned above the scrolling band (FEATURE_2611_29 / D33 · 2609_50 D12). */}
      <div className="shrink-0 pb-3 border-b border-gray-200">
        {detail && (
          <OrderDetailHeader
            detail={detail}
            status={null}
            reservedSale={false}
            stage={null}
            amount={null}
            onRefresh={null}
            isRefreshing={false}
          />
        )}
        <DetailLoadState loaded={detail != null} error={detailError} />
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto">
        {detail && (
          <OrderDetailSummary
            detail={detail}
            line={null}
            quantities={null}
            fullyCanceled={false}
            highlightLineId={null}
            openParcelId={openChipOf(detail, openParcelId)}
            onSelectParcel={setOpenParcelId}
            onChangeBox={onChangeBox}
          />
        )}
      </div>

      <div className="shrink-0 border-t border-gray-200 hidden md:block">
        <div className="flex justify-end pt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-400 transition-colors"
          >
            닫기
          </button>
        </div>
      </div>
    </Modal>
  );
}

function LineOrderDetailsModal({ order, onClose, isAdmin, useCase, orderUseCase, onRefreshed }: LineModeProps) {
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
  const [actionTab, setActionTab] = useState<ActionTab>(order?.cancelled ? 'cancel' : 'shipment');
  // Narrow screens: the reason of the locked tab just pressed, one grey line under the tab row (FEATURE_2611_29 / R9).
  const [lockedNotice, setLockedNotice] = useState('');
  // FEATURE_2610_17 / D61 · D62 · D63: the 11st reason lists, loaded once for an 11st order (server-owned).
  const [elevenstChoices, setElevenstChoices] = useState<ElevenstChoices | null>(null);
  const [elevenstChoicesFailed, setElevenstChoicesFailed] = useState(false);
  // FEATURE_2611_23 / D58: the LotteON reason lists, loaded once for a LotteON order (server-owned).
  const [lotteonChoices, setLotteonChoices] = useState<LotteonChoices | null>(null);
  const [lotteonChoicesFailed, setLotteonChoicesFailed] = useState(false);
  // D19 ⑥: the LotteON invoice edit window — rendered only while open, so a reopen starts fresh (R52).
  const [isLotteonEditOpen, setIsLotteonEditOpen] = useState(false);
  // D64: how an 11st single invoice is sent — the whole delivery (default), chosen lines, or one line split.
  const [elevenstMode, setElevenstMode] = useState<'ALL' | 'PARTIAL' | 'SPLIT'>('ALL');
  // D67: [입고완료 처리] of a reserved-sale line.
  const [stockConfirmOpen, setStockConfirmOpen] = useState(false);
  const [isConfirmingStock, setIsConfirmingStock] = useState(false);
  const [stockSent, setStockSent] = useState(false);
  const [stockError, setStockError] = useState('');
  // Shared order detail (FEATURE_2611_07 / D18 · D30 ①) — read on open; `detailReloadTick` re-reads it (R12).
  const [detail, setDetail] = useState<OrderDetail | null>(null);
  const [detailError, setDetailError] = useState('');
  const [detailReloadTick, setDetailReloadTick] = useState(0);
  // The chip the user picked; before a pick the first chip is open (D28).
  const [pickedParcelId, setPickedParcelId] = useState<number | null>(null);

  // Order detail load — independent of the action areas, which render as before. The drawn content stays while a
  // re-read is in flight; the new response replaces it.
  useEffect(() => {
    const lineId = order?.id;
    if (lineId == null) return;
    let alive = true;
    void (async () => {
      try {
        const loaded = await orderUseCase.getOrderDetail(lineId);
        if (alive) {
          setDetail(loaded);
          setDetailError('');
        }
      } catch (err) {
        if (alive) setDetailError(extractErrorMessage(err, '주문 상세를 불러오지 못했습니다.'));
      }
    })();
    return () => { alive = false; };
  }, [order?.id, orderUseCase, detailReloadTick]);

  // Carrier list load — the platform's code table (Coupang has no carrier-list API; 11st uses the same catalog),
  // served from our own backend, not a marketplace call, so it runs on open without a button. The guard mirrors
  // the sections' render gate (Coupang · 11st · LotteON, FEATURE_2610_17 / D2 · FEATURE_2611_23 / D64): hooks run even when the section is hidden,
  // so without it a USER account would hammer an ADMIN-only endpoint for 403s.
  // Deps are the platform *string* and isAdmin — passing the order object refetches every render.
  useEffect(() => {
    const platform = order?.platform;
    if (!isAdmin || (platform !== 'COUPANG' && platform !== 'ELEVENST' && platform !== 'LOTTEON')) return;
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

  // LotteON reason lists (FEATURE_2611_23 / D58) — our own backend, same guard style as the 11st load above.
  useEffect(() => {
    if (!isAdmin || order?.platform !== 'LOTTEON') return;
    let alive = true;
    void (async () => {
      try {
        const choices = await orderUseCase.getLotteonChoices();
        if (alive) {
          setLotteonChoices(choices);
          setLotteonChoicesFailed(false);
        }
      } catch {
        if (alive) setLotteonChoicesFailed(true);
      }
    })();
    return () => { alive = false; };
  }, [isAdmin, order?.platform, orderUseCase]);

  if (order == null) return null;

  const isEmpty = hasLoaded && rows.length === 0;
  const isCoupang = order.platform === 'COUPANG';
  // FEATURE_2610_17 / D28: order confirmation, single invoice and the sheet are open to 11st as well, and the seller
  // cancel opens as 11st sale refusal (D61); refresh stays Coupang only (D12). Internal stage · reservation are open to
  // 11st too (FEATURE_2611_23 / D51) and to LotteON, which also gets confirmation · shipment · sheet (D16 · D18 · D49).
  const isElevenst = order.platform === 'ELEVENST';
  const isLotteon = order.platform === 'LOTTEON';
  const isMarketOrder = isCoupang || isElevenst || isLotteon;
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
  // Action gates — order confirmation goes to the next step card under the progress strip, the other two (shipment ·
  // cancel) split into tabs (FEATURE_2611_29 / D7). An 11st reserved sale (raw 201) is not confirmed yet —
  // [입고완료 처리] takes the slot instead (D67).
  const canAcknowledge = isAdmin && isMarketOrder && order.status === 'PAID' && !fullyCanceled && !order.reservedSale;
  const canStockConfirm = isAdmin && isElevenst && order.reservedSale && order.status === 'PAID' && !fullyCanceled;
  const stockConfirmed = stockSent || order.stockConfirmSent;
  // [Internal acknowledge] = Coupang · 11st · LotteON [발주처리] targets without an internal stage, 11st visit pickup
  // excluded (D1·D13 · FEATURE_2610_17 / D12 · FEATURE_2611_23 / D51 · D53 · R50).
  const canMarkInternal = canAcknowledge && (isCoupang || isLotteon || (isElevenst && !order.visitPickup)) && order.internalStage == null;
  // The sheet is not Coupang only (the button disables with a notice), so an ADMIN gets the tab — locked for a fully
  // canceled order (FEATURE_2611_29 / R10).
  const canSheet = isAdmin && !fullyCanceled;
  const canShip = isAdmin && isMarketOrder && !fullyCanceled;
  // 11st sale refusal (D61) and the LotteON seller cancel (FEATURE_2611_23 / D25) also need a line that is not fully cancelled.
  // An order canceled before opening keeps the cancel tab open with one line of text, no form (FEATURE_2611_29 / R10).
  const canCancel = isAdmin && (order.cancelled || ((isCoupang || ((isElevenst || isLotteon) && !fullyCanceled))
    && (order.status === 'PAID' || order.status === 'PREPARING')));
  // D66: a visit-pickup 11st order gets [방문수령 완료] instead of the invoice form, from paid on.
  const showVisitPickup = isElevenst && order.visitPickup && (order.status === 'PAID' || order.status === 'PREPARING');
  // D63 · FEATURE_2611_23 / D26: [발송지연 안내] (11st) or [발송 약정일 안내] (LotteON) under the shipment tab for a paid / preparing order.
  const showDeliveryDelay = (isElevenst || isLotteon) && (order.status === 'PAID' || order.status === 'PREPARING');
  const tabAvailability: Record<ActionTab, boolean> = { sheet: canSheet, shipment: canShip, cancel: canCancel };
  // 고른 탭을 쓸 수 없으면 왼쪽부터 첫 번째로 쓸 수 있는 탭을 보여준다
  // (하나도 없으면 탭 영역 자체가 안 그려진다).
  const activeTab: ActionTab = tabAvailability[actionTab]
    ? actionTab
    : ACTION_TABS.find((tab) => tabAvailability[tab.key])?.key ?? actionTab;
  const tabLabel = (tab: ActionTab): ReactNode => {
    if (tab === 'sheet') return '송장시트';
    if (tab === 'shipment') return isShipped ? '송장 수정' : '발송처리';
    if (isCoupang && order.status === 'PREPARING') return '출고중지';
    return (
      <>
        <span className="hidden md:inline">주문 취소</span>
        <span className="md:hidden">취소</span>
      </>
    );
  };
  const lockReason = (tab: ActionTab): string => {
    if (tabAvailability[tab]) return '';
    if ((tab === 'sheet' || tab === 'shipment') && fullyCanceled) return TAB_LOCK_CANCELED;
    if (tab === 'cancel' && isShipped) return TAB_LOCK_SHIPPED;
    return '';
  };

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
      // The header and body come from the server response, so the order detail is read again (R12).
      setDetailReloadTick((tick) => tick + 1);
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

  // The clicked line in the response (`order` until it is there, PLAN R17 · D40) — the source of the shown status, the
  // quantities and the body's line groups (FEATURE_2611_29 / D8).
  const line = detail?.lines.find((candidate) => candidate.id === order.id) ?? order;
  // Shown status (FEATURE_2611_29 / R7) — header badge, progress and next step card read this one value.
  // A successful CREATE writes 「발송처리」 back server-side; show it straight from the result (D4).
  // ⚠️ The shipment result comes first — reversing the order hides 「발송처리」 from a user who confirmed and then
  // shipped in one modal. The cancel is the last step, so the cancel result wins — a full cancel comes back as
  // 'CANCELLED' from the server (D14).
  const shownStatus = cancelledLine?.resultStatus ?? result?.resultStatus ?? (ackSucceeded ? 'PREPARING' : line.status);
  // A successful cancel line is overwritten with the server's result (PLAN 2609_25 D14) — an instant cancel raises the
  // cancel count, a shipment stop the hold count (D7). The order count stays (Coupang keeps the original count too).
  const quantities = {
    order: line.orderCount,
    cancel: cancelledLine?.resultCancelCount ?? line.cancelCount,
    hold: cancelledLine?.resultHoldCount ?? line.holdCount,
    purchasable: cancelledLine?.resultPurchasableQty ?? line.purchasableQty,
  };
  const nextStep = NEXT_STEP_BY_STATUS[shownStatus];

  // Fixed geometry (D1) — opening the sheet does not resize the modal; `fullHeight` carries that role.
  const renderTab = (tab: (typeof ACTION_TABS)[number]) => {
    const isAvailable = tabAvailability[tab.key];
    const isActive = activeTab === tab.key;
    // The cancel tab text is always red, locked or not (FEATURE_2611_29 / D1 · R19); locks show as an icon.
    const tone = tab.key === 'cancel'
      ? `text-red-700 ${isActive ? 'border-red-700' : 'border-transparent'}${isAvailable ? '' : ' cursor-not-allowed'}`
      : !isAvailable
        ? 'border-transparent text-gray-400 cursor-not-allowed'
        : isActive
          ? 'border-blue-600 text-blue-700'
          : 'border-transparent text-gray-500 hover:text-gray-700';
    return (
      <button
        key={tab.key}
        type="button"
        onClick={() => {
          if (!isAvailable) {
            setLockedNotice(lockReason(tab.key));
            return;
          }
          setActionTab(tab.key);
          setLockedNotice('');
        }}
        aria-disabled={!isAvailable}
        title={lockReason(tab.key) || undefined}
        className={`-mb-px inline-flex items-center justify-center gap-1 border-b-2 px-4 py-2 text-sm font-medium max-md:flex-1 ${tone}`}
      >
        {!isAvailable && <Lock size={13} aria-hidden />}
        {tabLabel(tab.key)}
      </button>
    );
  };

  return (
    <Modal isOpen onClose={handleClose} title="주문 상세" fullHeight fullScreenOnNarrow>

        {/* The header stays pinned above the scrolling band (FEATURE_2611_29 / D33 · 2609_50 D12). */}
        <div className="shrink-0 pb-3 border-b border-gray-200">
          {detail != null ? (
            <>
              <OrderDetailHeader
                detail={detail}
                status={shownStatus}
                stage={shownStage}
                reservedSale={line.reservedSale}
                amount={orderNetAmount(line.lineAmount, line.discountAmount)}
                isRefreshing={isRefreshing}
                onRefresh={isCoupang ? () => void handleRefresh() : null}
              />
              {detailError && <DetailLoadState loaded error={detailError} />}
            </>
          ) : (
            // No detail yet (loading or failed): a Coupang order keeps its refresh button beside the text (D4).
            <div className="flex items-start justify-between gap-2">
              <DetailLoadState loaded={false} error={detailError} />
              {isCoupang && <OrderRefreshButton onRefresh={() => void handleRefresh()} isRefreshing={isRefreshing} />}
            </div>
          )}
          {refreshBanner && (
            <p className="pt-2 text-sm text-gray-800">{refreshBanner}</p>
          )}
        </div>

        {/* Only this middle band scrolls — the table keeps no scroller of its own (D2). */}
        <div className="flex-1 min-h-0 overflow-y-auto">
          {detail && (
            <div className="pt-4">
              <OrderProgress status={shownStatus} paidAt={detail.paidAt} />
            </div>
          )}

          {/* Next step card (FEATURE_2611_29 / D7 · D15 · R8) — order confirmation first, then a full cancel, then the
              card of the shown status. Results and errors of the confirmation stay inside the card. */}
          <div className="mt-4">
            {canAcknowledge || canStockConfirm ? (
              <OrderNextStepCard
                title="다음 단계 · 발주 확인"
                body={canAcknowledge && !ackSucceeded ? (
                  // FEATURE_2610_17 / D52 · FEATURE_2611_23 / D17: 11st and LotteON confirm this product only — their notice has no box number.
                  <span className="text-sm text-gray-500">
                    {isElevenst
                      ? '이 상품(주문 줄)이 발주확인 처리되어 배송준비중으로 바뀝니다. 되돌릴 수 없습니다.'
                      : isLotteon
                      ? '이 상품(주문 줄)이 발주확인 처리되어 상품준비중으로 바뀝니다. 되돌릴 수 없습니다.'
                      : `박스 ${order.externalBoxId ?? '-'} 전체가 상품준비중으로 전환됩니다. 되돌릴 수 없습니다.`}
                  </span>
                ) : undefined}
                messages={
                  <>
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
                  </>
                }
              >
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
                      <button
                        onClick={handleAcknowledge}
                        disabled={isAcknowledging || isMarkingInternal}
                        className="px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors disabled:bg-blue-400 disabled:cursor-not-allowed"
                      >
                        {isAcknowledging ? <Spinner label="전송 중..." /> : '발주처리'}
                      </button>
                    </>
                  ))}
              </OrderNextStepCard>
            ) : fullyCanceled ? (
              <OrderNextStepCard title="주문이 취소되었습니다" body={cancelQtyText(quantities.cancel, quantities.hold)} />
            ) : nextStep ? (
              <OrderNextStepCard title={nextStep.title} body={nextStep.body} />
            ) : null}
          </div>

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
          {isLotteon && (
            <LotteonCancelRequests
              orderItemId={order.id}
              isAdmin={isAdmin}
              orderUseCase={orderUseCase}
              rejectReasons={lotteonChoices?.cancelRejectReasons ?? []}
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

          {/* Label sheet · shipment · order cancel — exclusive tabs (FEATURE_2611_29 / D5 · D6). Locked tabs stay with a
              lock icon and a hover reason; on narrow screens a press shows the reason under the tab row (R9).
              ⚠️ The inputs (carrier, invoice, reason, quantity) are this component's state, so they survive tab
              switches — pushing state down into the panels would drop the input on every switch. */}
          {(canSheet || canShip || canCancel) && (
            <div className="mt-6 border-t border-gray-200 pt-6">
              {/* Underline tabs, the ClaimTypeTabs idiom — kept inline inside the modal. */}
              <div className="flex items-center gap-1 border-b border-gray-200">
                {ACTION_TABS.slice(0, 2).map(renderTab)}
                <span className="flex-1 max-md:hidden" aria-hidden />
                <span className="mx-1 w-px h-5 bg-gray-300 max-md:hidden" aria-hidden />
                {renderTab(ACTION_TABS[2])}
              </div>
              {lockedNotice && <p className="mt-2 text-sm text-gray-500 md:hidden">{lockedNotice}</p>}

              {/* Label sheet — the lookup is a live marketplace call, so opening the tab does not run it.
                  It runs on the button, and the loaded table stays in this tab (kept across tab switches). */}
              {activeTab === 'sheet' && canSheet && (
                <div className="mt-4">
                  <p className="text-sm text-gray-500">송장시트에서 여러 주문의 송장을 한 번에 등록·조회할 수 있습니다.</p>
                  <div className="mt-3 flex flex-wrap items-center gap-3">
                    <button
                      onClick={handlePreview}
                      disabled={!isMarketOrder || isPreviewing}
                      className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-100 transition-colors disabled:text-gray-400 disabled:hover:bg-white disabled:cursor-not-allowed"
                    >
                      {isPreviewing ? <Spinner label="불러오는 중..." /> : '송장시트 조회'}
                    </button>
                    {/* The download sits next to the lookup once the table is loaded (FEATURE_2611_29 / D19 ③ · R13). */}
                    {hasLoaded && (
                      <button
                        onClick={handleExport}
                        disabled={isPreviewing || isExporting || isEmpty || !!previewError}
                        className="px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors disabled:bg-blue-400 disabled:cursor-not-allowed"
                      >
                        {isExporting ? <Spinner label="다운로드 중..." /> : '엑셀 다운로드'}
                      </button>
                    )}
                    {!isMarketOrder && <span className="text-sm text-gray-500">쿠팡 · 11번가 주문만 지원합니다.</span>}
                  </div>

                  {/* A download failure shows right under the button that caused it. */}
                  {exportError && (
                    <div className="mt-4 bg-red-50 border border-red-200 rounded-lg p-4 text-red-800 text-sm">
                      {exportError}
                    </div>
                  )}

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
                          {platformName(order.platform)}에서 고객 안심번호를 재발행하십시오.
                        </div>
                      )}

                      {isEmpty ? (
                        <div className="py-10 text-center text-gray-500">발송 대상 라인이 없습니다.</div>
                      ) : (
                        <div className="mt-4">
                          <DataCardSwitch
                            placement="nested"
                            className="border border-gray-200 rounded-lg list-table-scroll"
                            renderCards={() =>
                              // Narrow-screen cards (FEATURE_2610_31 D14 · D28 · D37): the app's sheet line — address
                              // head, the product (two lines), 「내품수량 N」 and 「택배수량」 with the shared
                              // quantity stepper (min 1); the table's 「이름」 at the bottom.
                              rows.map((row) => (
                                <DataCard
                                  key={row.rowKey}
                                  body={
                                    <div className="space-y-1">
                                      <p className="text-xs text-gray-500">{addressHead(row.address)}</p>
                                      <p className="line-clamp-2 text-[13px] text-gray-900">{row.productName}</p>
                                      <div className="flex items-center gap-2 pt-1 text-xs">
                                        <span className="text-gray-500">내품수량 {row.quantity}</span>
                                        <span className="flex-1" />
                                        <span className="text-gray-900">택배수량</span>
                                        <QuantityStepper
                                          className="w-24"
                                          min={1}
                                          ariaLabel={`${row.productName} 택배수량`}
                                          value={String(row.parcelQuantity)}
                                          onChange={(next) => handleParcelChange(row.rowKey, next)}
                                          invalid={invalidRowKey === row.rowKey}
                                        />
                                      </div>
                                    </div>
                                  }
                                  extraFields={[{ label: '이름', value: row.receiverName }]}
                                />
                              ))
                            }
                          >
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
                          </DataCardSwitch>
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
              {/* FEATURE_2611_23 / D96 · R51 — a paid LotteON order needs [발주처리] first: the notice instead of the form. */}
              {activeTab === 'shipment' && canShip && isLotteon && shownStage == null && order.status === 'PAID' && (
                <div className="mt-4 bg-amber-50 border border-amber-200 rounded-lg p-3 text-amber-900 text-sm">
                  롯데ON 주문은 [발주처리] 뒤에 송장을 등록할 수 있습니다.
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
                && !(isElevenst && (order.status === 'PAID' || isShipped)) && !(isLotteon && order.status === 'PAID') && (
                <div className="mt-4">
                  {elevenstMode === 'ALL' && (
                    <p className="mt-1 text-sm text-gray-500">
                      박스 {order.externalBoxId ?? '-'} 의 모든 옵션에 같은 운송장번호가 적용됩니다.
                    </p>
                  )}

                  {isShipped && !isLotteon && (
                    <div className="mt-3 bg-amber-50 border border-amber-200 rounded-lg p-3 text-amber-900 text-sm">
                      이미 발송처리된 주문입니다. 입력한 운송장으로 송장 수정을 요청합니다.
                    </div>
                  )}

                  {/* A shipped LotteON order edits its invoice in a separate window, so only the button shows; every
                      other order keeps the inputs open (FEATURE_2611_29 / D19 ⑥ · R14). */}
                  {isShipped && isLotteon && (
                    <div className="mt-4">
                      <button
                        onClick={() => setIsLotteonEditOpen(true)}
                        disabled={isLocked}
                        className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-100 transition-colors disabled:text-gray-400 disabled:hover:bg-white disabled:cursor-not-allowed"
                      >
                        송장 수정하기
                      </button>
                    </div>
                  )}

                  {!(isShipped && isLotteon) && elevenstMode === 'ALL' && (
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
                      {/* Below 768px: one red box per failed box, 「박스 ID · 코드 · 메시지」 — the app's failure lines
                          (FEATURE_2610_31 D27). Marketplace wording verbatim (D6). */}
                      <div className="mt-3 space-y-2 md:hidden">
                        {result.failed.map((box) => (
                          <p
                            key={box.shipmentBoxId}
                            className="rounded-lg border border-red-200 bg-red-50 p-2 text-xs text-red-800"
                          >
                            {box.shipmentBoxId} · {box.resultCode} · {box.message}
                          </p>
                        ))}
                      </div>
                      {/* Same columns/tone as ShipmentConfirmModal's failure table, deliberately not
                          extracted into a shared component (2609_01 D5). Coupang wording verbatim (D6). */}
                      <div className="mt-3 hidden border border-gray-200 rounded-lg list-table-scroll md:block">
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

              {/* FEATURE_2610_17 / D63 · FEATURE_2611_23 / D26 — [발송지연 안내] (11st) or [발송 약정일 안내] (LotteON) under the shipment tab, paid / preparing orders. */}
              {canShip && showDeliveryDelay && (
                <div className={activeTab === 'shipment' ? undefined : 'hidden'}>
                  {isLotteon ? (
                    <LotteonDeliveryAppointmentForm
                      orderItemId={order.id}
                      reasons={lotteonChoices?.appointmentReasons ?? []}
                      detailReasons={lotteonChoices?.appointmentDetailReasons ?? []}
                      reasonsFailed={lotteonChoicesFailed}
                      orderUseCase={orderUseCase}
                    />
                  ) : (
                    <ElevenstDeliveryDelayForm
                      orderItemId={order.id}
                      reasons={elevenstChoices?.delayReasons ?? []}
                      reasonsFailed={elevenstChoicesFailed}
                      orderUseCase={orderUseCase}
                    />
                  )}
                </div>
              )}

              {/* Stored invoice (FEATURE_2609_75 / D18) — while in an internal stage, the carrier and invoice of every
                  delivery bundle can be edited; the carrier list is the one this modal already loaded. Then the reserved
                  shipment history (D30) — planned and run times, results and row actions, nothing when there is no
                  record. Both live in the shipment tab and only hide on another tab (FEATURE_2611_29 / D16 · R12). */}
              {isAdmin && (isCoupang || isElevenst || isLotteon) && (
                <div className={activeTab === 'shipment' ? undefined : 'hidden'}>
                  {shownStage != null && (
                    <div className="mt-6 border-t border-gray-200 pt-6">
                      <StoredInvoiceEditor
                        useCase={useCase}
                        externalOrderId={order.externalOrderId}
                        carrierOptions={carrierOptions}
                        onChanged={() => setReservationChanged(true)}
                      />
                    </div>
                  )}
                  <ReservedShipmentHistory
                    useCase={useCase}
                    externalOrderId={order.externalOrderId}
                    onChanged={() => setReservationChanged(true)}
                  />
                </div>
              )}

              {activeTab === 'cancel' && order.cancelled && (
                <p className="mt-4 text-sm text-gray-500">이미 취소된 주문입니다 · {cancelQtyText(quantities.cancel, quantities.hold)}</p>
              )}
              {/* 11st order cancel = sale refusal of the whole line (FEATURE_2610_17 / D61). */}
              {!order.cancelled && canCancel && isElevenst && (
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
              {/* LotteON order cancel = seller cancel of the whole line (FEATURE_2611_23 / D25). */}
              {!order.cancelled && canCancel && isLotteon && (
                <div className={activeTab === 'cancel' ? undefined : 'hidden'}>
                  <LotteonSellerCancelForm
                    orderItemId={order.id}
                    quantity={order.orderCount}
                    purchasableQty={order.purchasableQty}
                    reasons={lotteonChoices?.cancelReasons ?? []}
                    reasonsFailed={lotteonChoicesFailed}
                    orderUseCase={orderUseCase}
                    onSent={() => setReservationChanged(true)}
                  />
                </div>
              )}

              {/* Coupang order cancel — paid goes through as an instant cancel, preparing as a shipment stop
                  (PLAN 2609_25 D6·D7). Shown in two steps: ① the section gate reads only `order.status`, so the
                  result stays after a success, and ② an order with nothing left to cancel gets a one-line notice
                  inside the section. */}
              {!order.cancelled && activeTab === 'cancel' && canCancel && isCoupang && (
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

          {detail && (
            <div className="mt-6 border-t border-gray-200 pt-6">
              <OrderDetailSummary
                detail={detail}
                line={line}
                quantities={quantities}
                fullyCanceled={fullyCanceled}
                highlightLineId={order.id}
                openParcelId={openChipOf(detail, pickedParcelId)}
                onSelectParcel={setPickedParcelId}
              />
            </div>
          )}

        </div>

        {/* Pinned foot band — only [닫기] on wide screens; narrow screens close with the back button (FEATURE_2611_29 / D7 · R20). */}
        <div className="shrink-0 border-t border-gray-200 hidden md:block">
          <div className="flex justify-end pt-6">
            <button
              onClick={handleClose}
              className="px-4 py-2 bg-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-400 transition-colors"
            >
              닫기
            </button>
          </div>
        </div>
        <ConfirmDialog
          isOpen={ackConfirmOpen}
          nested
          title="예약된 주문 포함"
          message="예약된 주문입니다. 마켓에 지금 발주처리하면 해당 주문의 내부 발주·예약 발송이 해제됩니다. 계속할까요?"
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
        {isLotteonEditOpen && (
          <LotteonInvoiceEditModal
            orderItemId={order.id}
            externalOrderId={order.externalOrderId}
            carrierOptions={carrierOptions}
            useCase={useCase}
            orderUseCase={orderUseCase}
            onChanged={() => setReservationChanged(true)}
            onClose={() => setIsLotteonEditOpen(false)}
          />
        )}
    </Modal>
  );
}
