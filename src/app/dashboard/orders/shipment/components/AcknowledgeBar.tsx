'use client';

import type { LucideIcon } from 'lucide-react';
import { CalendarX, ClipboardCheck, PackageCheck, RefreshCw, Truck, Undo2 } from 'lucide-react';
import { Spinner } from '@/presentation/components/Spinner';
import { Button, type ButtonVariant } from '@/presentation/components/ui/Button';

/**
 * 출고관리 표 상단 선택 액션 바 — 선택 건수 · [주문 상태 갱신] · [발주처리] · [내부 발주처리] · [내부 발주 해제] ·
 * 페이지 크기 · 결과 메시지.
 *
 * ⚠️ 버튼 글자에 선택 건수를 넣지 않는다 — 건수를 말하는 자리는 이 바의 왼쪽 한 곳뿐이다.
 *
 * ⚠️ `ShipmentFilterCard` 에 넣지 않는다 — 그 카드는 "조회 조건 + 서버가 sellerId 로 처리하는 액션"의
 * 자리다. 발주처리는 선택에 종속되고 페이지 크기는 표에 종속이라 표 바로 위가 맞다.
 * ⚠️ 바 자체는 항상 렌더한다(비-ADMIN·결과 0건 포함) — 숨는 것은 ADMIN 버튼들뿐.
 * ⚠️ Below 768px the container renders it with `docked` after the list, only when the list has rows
 * (FEATURE_2611_32 / D12 ① ⑥). Docked = one row of icon buttons with a short name below (full name in `title`),
 * no guidance lines except the over-limit warning, and no page-size select — the container draws
 * `PageSizeSelect` above the list instead.
 * ⚠️ [내부 발주처리]는 [발주처리] **바로 옆 · 초록**(`variant="confirm"`)이다(FEATURE_2609_75 / D13). 색을 바꾸지 말 것.
 */
/** 페이지 크기는 판매상품 마스터와 같은 25/50/100 (PLAN 2609_17 D16). 그 화면의 URL 쿼리 모듈에서 import 하지 않는다. */
const PAGE_SIZE_OPTIONS = [25, 50, 100] as const;
/** 서버 `@Size(max=500)` 과 같은 값. 넘겨 보내면 400 이라 버튼에서 먼저 막는다(PLAN 2609_17 D12). */
const MAX_SELECTION = 500;
/**
 * What [발주처리] covers, per marketplace (FEATURE_2610_17 / D56): Coupang confirms the whole box of a chosen option
 * (PLAN 2609_17 D1); 11st confirms the chosen product with the same product's lines of that delivery (D48); LotteON
 * confirms the chosen product only (FEATURE_2611_23 / D17).
 */
const ACK_NOTICE_BY_PLATFORM: Record<'COUPANG' | 'ELEVENST' | 'LOTTEON', string> = {
  COUPANG: '쿠팡: 선택한 옵션이 속한 배송건(박스) 전체가 함께 발주처리됩니다.',
  ELEVENST: '11번가: 선택한 상품(같은 배송건의 같은 상품 옵션 포함)만 발주확인됩니다.',
  LOTTEON: '롯데ON: 선택한 상품만 발주확인됩니다.',
};

/** Rows-per-page select. Inside the bar on desktop; above the list below 768px (the docked bar has no room). */
export function PageSizeSelect({ value, onChange }: { value: number; onChange: (size: number) => void }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      aria-label="페이지당 개수"
    >
      {PAGE_SIZE_OPTIONS.map((size) => (
        <option key={size} value={size}>
          {size}개씩
        </option>
      ))}
    </select>
  );
}

/**
 * Icon box colors of the docked bar — the same roles as `Button` variants (the docked cell is icon + name
 * stacked, which `Button`'s fixed padding cannot draw).
 */
const ICON_BOX: Record<ButtonVariant, string> = {
  primary: 'bg-blue-600 text-white group-enabled:group-hover:bg-blue-700 group-disabled:bg-blue-400',
  secondary: 'border border-gray-300 bg-white text-gray-700 group-enabled:group-hover:bg-gray-50 group-disabled:opacity-50',
  danger: 'bg-red-600 text-white group-enabled:group-hover:bg-red-700 group-disabled:opacity-50',
  confirm: 'bg-green-600 text-white group-enabled:group-hover:bg-green-700 group-disabled:opacity-50',
};

interface BarAction {
  key: string;
  label: string;
  /** Name under the icon in the docked bar — at most 4 Korean letters so six cells fit a 360px screen. */
  shortLabel: string;
  icon: LucideIcon;
  variant: ButtonVariant;
  onClick: () => void;
  disabled: boolean;
  busy: boolean;
  busyLabel: string;
}

interface AcknowledgeBarProps {
  selectedCount: number;
  /**
   * Picked orders that have at least one order-confirmation target line — can be smaller than `selectedCount`
   * (picked orders) (FEATURE_2611_30 / D16).
   */
  acknowledgeableCount: number;
  /** Number of line ids actually sent — the server's 500 limit is checked against this (R3). */
  acknowledgeLineCount: number;
  /** Marketplaces among the confirmation targets, order Coupang → 11st → LotteON (FEATURE_2610_17 / D56 · FEATURE_2611_23 / D17). */
  acknowledgePlatforms: readonly ('COUPANG' | 'ELEVENST' | 'LOTTEON')[];
  onAcknowledge: () => void;
  isSubmitting: boolean;
  canAcknowledge: boolean;      // = isAdmin
  /** 선택 중 내부 발주처리되는 건수(결제완료·내부 단계 없음). */
  internalCount: number;
  /** 선택 중 「내부 상품준비중」 건수 — [내부 발주 해제] 대상. */
  releaseCount: number;
  onInternalAcknowledge: () => void;
  onReleaseInternal: () => void;
  /** 선택 중 「발송대기중」 건수 — [예약 취소] 대상(D18 행2). */
  cancelCount: number;
  onCancelReservation: () => void;
  /** 선택 중 내부 단계(「내부 상품준비중」·「발송대기중」) 건수 — [저장된 송장으로 발송] 대상(D18 🔁). */
  storedCount: number;
  /** 발송처리 모달을 저장된 송장 모드로 연다(요청은 모달이 보낸다). */
  onShipStored: () => void;
  /** 진행 중인 내부 작업. 버튼 세 개가 같은 요청 자리를 쓴다. */
  internalBusy: 'mark' | 'release' | 'cancel' | null;
  /** 선택한 주문을 마켓에서 다시 읽어 상태를 맞춘다(PLAN 2609_50). */
  onRefresh: () => void;
  /** Selected orders [주문 상태 갱신] would send — Coupang only (FEATURE_2610_17 / D12). */
  refreshableCount: number;
  isRefreshing: boolean;
  pageSize: number;
  onPageSizeChange: (size: number) => void;
  message: { text: string; detail: string[] } | null;
  /** true = drawn below 768px as the bar stuck to the screen bottom after the list (FEATURE_2611_32 / D12 ⑥ · R12). */
  docked?: boolean;
}

export function AcknowledgeBar({
  selectedCount,
  acknowledgeableCount,
  acknowledgeLineCount,
  acknowledgePlatforms,
  onAcknowledge,
  isSubmitting,
  canAcknowledge,
  internalCount,
  releaseCount,
  onInternalAcknowledge,
  onReleaseInternal,
  cancelCount,
  onCancelReservation,
  storedCount,
  onShipStored,
  internalBusy,
  onRefresh,
  refreshableCount,
  isRefreshing,
  pageSize,
  onPageSizeChange,
  message,
  docked = false,
}: AcknowledgeBarProps) {
  // The limit applies to the line ids actually sent (`acknowledgeLineCount`) — non-target lines in the selection never go out.
  const isOverLimit = acknowledgeLineCount > MAX_SELECTION;
  const notAcknowledgeable = selectedCount - acknowledgeableCount;

  const overLimitNotice = (
    <p className="text-xs text-red-700">
      한 번에 {MAX_SELECTION}건까지 발주처리할 수 있습니다. 선택을 줄여주세요.
    </p>
  );

  const notices = (
    <>
      {/* What gets confirmed, one line per marketplace in the targets (PLAN 2609_17 D1 · FEATURE_2610_17 / D56). */}
      {acknowledgeableCount > 0 && acknowledgePlatforms.map((platform) => (
        <p key={platform} className="text-xs text-gray-500">
          {ACK_NOTICE_BY_PLATFORM[platform]}
        </p>
      ))}

      {/* Says why [발주처리] stays off — picking orders only to refresh their status is common. */}
      {notAcknowledgeable > 0 && (
        <p className="text-xs text-gray-500">
          선택한 {selectedCount}건 중 {notAcknowledgeable}건은 결제완료가 아니거나 입고완료 전 11번가 예약판매라서 발주처리 대상이 아닙니다.
          주문 상태 갱신은 그대로 됩니다.
        </p>
      )}

      {/* Internal acknowledge is not sent to the market — the market keeps the order as paid (D1 · FEATURE_2611_23 / D54). */}
      {canAcknowledge && internalCount > 0 && (
        <p className="text-xs text-gray-500">
          내부 발주처리는 마켓에 보내지 않습니다. 마켓에는 결제완료로 남고 오클릭스에만 「내부 상품준비중」으로 표시됩니다.
        </p>
      )}

      {isOverLimit && overLimitNotice}
    </>
  );

  // Same order as before: refresh → acknowledge → internal (green, right next to it) → release → cancel → stored.
  // 상태 갱신은 마켓에 쓰지 않는 읽기라 ADMIN 게이트를 걸지 않는다(PLAN 2609_50 D17). 상한은 서버가 판정한다(D3).
  const actions: BarAction[] = [
    {
      key: 'refresh', label: '주문 상태 갱신', shortLabel: '상태 갱신', icon: RefreshCw, variant: 'secondary',
      onClick: onRefresh, disabled: refreshableCount === 0 || isRefreshing,
      busy: isRefreshing, busyLabel: '확인 중...',
    },
    ...(canAcknowledge ? [
      {
        key: 'ack', label: '발주처리', shortLabel: '발주처리', icon: ClipboardCheck, variant: 'primary',
        onClick: onAcknowledge, disabled: acknowledgeableCount === 0 || isOverLimit || isSubmitting,
        busy: isSubmitting, busyLabel: '전송 중...',
      },
      {
        key: 'internal', label: '내부 발주처리', shortLabel: '내부 발주', icon: PackageCheck, variant: 'confirm',
        onClick: onInternalAcknowledge, disabled: internalCount === 0 || internalBusy !== null,
        busy: internalBusy === 'mark', busyLabel: '처리 중...',
      },
      {
        key: 'release', label: '내부 발주 해제', shortLabel: '발주 해제', icon: Undo2, variant: 'secondary',
        onClick: onReleaseInternal, disabled: releaseCount === 0 || internalBusy !== null,
        busy: internalBusy === 'release', busyLabel: '처리 중...',
      },
      {
        key: 'cancel', label: '예약 취소', shortLabel: '예약 취소', icon: CalendarX, variant: 'secondary',
        onClick: onCancelReservation, disabled: cancelCount === 0 || internalBusy !== null,
        busy: internalBusy === 'cancel', busyLabel: '처리 중...',
      },
      // D18 🔁 — 파일 없이 저장된 송장으로 [예약 발송]/[지금 발송]. 요청·결과는 발송처리 모달(저장된 송장 모드)이 한다.
      {
        key: 'stored', label: '저장된 송장으로 발송', shortLabel: '송장 발송', icon: Truck, variant: 'secondary',
        onClick: onShipStored, disabled: storedCount === 0 || internalBusy !== null,
        busy: false, busyLabel: '',
      },
    ] satisfies BarAction[] : []),
  ];

  return (
    <div
      className={
        docked
          ? 'sticky bottom-0 z-20 -mx-4 space-y-2 border-t border-gray-200 bg-white px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]'
          : 'bg-white rounded-lg shadow px-4 py-3 space-y-2'
      }
    >
      {/* Docked: only the over-limit warning — the guidance lines took half the phone screen. */}
      {docked && isOverLimit && overLimitNotice}

      <div className={docked ? 'flex items-center justify-between gap-1' : 'flex items-center justify-between gap-3 max-md:flex-wrap'}>
        {/* 선택 건수는 이 바에서만 말한다 — 버튼 글자에 건수를 넣지 않는다.
            버튼마다 같은 수를 반복하면 두 버튼 중 어느 쪽 수인지 되읽게 된다. */}
        <div className={docked ? 'shrink-0 whitespace-nowrap text-xs text-gray-700' : 'text-sm text-gray-700'}>
          {docked
            ? selectedCount > 0
              ? <><span className="font-semibold text-gray-900">{selectedCount}건</span> 선택</>
              : '선택 없음'
            : selectedCount > 0
              ? <>선택 <span className="font-semibold text-gray-900">{selectedCount}건</span></>
              : '주문을 선택하세요'}
        </div>

        {docked ? (
          // One row of equal cells: icon box + short name below (icons alone were not recognizable).
          // The full name stays in title/aria-label. Box colors keep [발주처리] blue and [내부 발주처리] green.
          <div className="flex min-w-0 flex-1 items-start justify-end">
            {actions.map((a) => {
              const Icon = a.icon;
              return (
                <button
                  key={a.key}
                  type="button"
                  onClick={a.onClick}
                  disabled={a.disabled}
                  title={a.label}
                  aria-label={a.label}
                  className="group flex w-11 shrink-0 flex-col items-center gap-1 disabled:cursor-not-allowed"
                >
                  <span className={`flex h-9 w-9 items-center justify-center rounded-lg transition-colors ${ICON_BOX[a.variant]}`}>
                    {a.busy ? <Spinner size={18} /> : <Icon size={18} aria-hidden />}
                  </span>
                  <span className="whitespace-nowrap text-[10px] leading-none text-gray-700 group-disabled:text-gray-400" aria-hidden>
                    {a.shortLabel}
                  </span>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="flex flex-wrap items-center justify-end gap-3">
            {actions.map((a) => (
              <Button key={a.key} variant={a.variant} onClick={a.onClick} disabled={a.disabled}>
                {a.busy ? <Spinner label={a.busyLabel} /> : a.label}
              </Button>
            ))}
            <PageSizeSelect value={pageSize} onChange={onPageSizeChange} />
          </div>
        )}
      </div>

      {!docked && notices}

      {message && (
        <div className="text-sm text-gray-800">
          {/* The confirmation result has one line per marketplace (FEATURE_2610_17 / D57). */}
          <p className="whitespace-pre-line">{message.text}</p>
          {message.detail.map((line) => (
            <p key={line} className="text-xs text-red-700">
              {line}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
