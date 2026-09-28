'use client';

import { Spinner } from '@/presentation/components/Spinner';
import { Button } from '@/presentation/components/ui/Button';

/**
 * 출고관리 표 상단 선택 액션 바 — 선택 건수 · [주문 상태 갱신] · [발주처리] · [내부 발주처리] · [내부 발주 해제] ·
 * 페이지 크기 · 결과 메시지.
 *
 * ⚠️ 버튼 글자에 선택 건수를 넣지 않는다 — 건수를 말하는 자리는 이 바의 왼쪽 한 곳뿐이다.
 *
 * ⚠️ `ShipmentFilterCard` 에 넣지 않는다 — 그 카드는 "조회 조건 + 서버가 sellerId 로 처리하는 액션"의
 * 자리다. 발주처리는 선택에 종속되고 페이지 크기는 표에 종속이라 표 바로 위가 맞다.
 * ⚠️ 바 자체는 항상 렌더한다(비-ADMIN·결과 0건 포함) — 숨는 것은 ADMIN 버튼들뿐.
 * ⚠️ [내부 발주처리]는 [발주처리] **바로 옆 · 초록**(`variant="confirm"`)이다(FEATURE_2609_75 / D13). 색을 바꾸지 말 것.
 */
/** 페이지 크기는 판매상품 마스터와 같은 25/50/100 (PLAN 2609_17 D16). 그 화면의 URL 쿼리 모듈에서 import 하지 않는다. */
const PAGE_SIZE_OPTIONS = [25, 50, 100] as const;
/** 서버 `@Size(max=500)` 과 같은 값. 넘겨 보내면 400 이라 버튼에서 먼저 막는다(PLAN 2609_17 D12). */
const MAX_SELECTION = 500;

interface AcknowledgeBarProps {
  selectedCount: number;
  /** 선택 중 실제로 발주처리되는 건수. 체크박스는 상태 무관이라 `selectedCount` 보다 작을 수 있다. */
  acknowledgeableCount: number;
  onAcknowledge: () => void;
  isSubmitting: boolean;
  canAcknowledge: boolean;      // = isAdmin
  /** 선택 중 내부 발주처리되는 건수(결제완료·내부 단계 없음). */
  internalCount: number;
  /** 선택 중 「내부 상품준비중」 건수 — [내부 발주 해제] 대상. */
  releaseCount: number;
  onInternalAcknowledge: () => void;
  onReleaseInternal: () => void;
  /** 진행 중인 내부 작업. 버튼 두 개가 같은 요청 자리를 쓴다. */
  internalBusy: 'mark' | 'release' | null;
  /** 선택한 주문을 마켓에서 다시 읽어 상태를 맞춘다(PLAN 2609_50). */
  onRefresh: () => void;
  isRefreshing: boolean;
  pageSize: number;
  onPageSizeChange: (size: number) => void;
  message: { text: string; detail: string[] } | null;
}

export function AcknowledgeBar({
  selectedCount,
  acknowledgeableCount,
  onAcknowledge,
  isSubmitting,
  canAcknowledge,
  internalCount,
  releaseCount,
  onInternalAcknowledge,
  onReleaseInternal,
  internalBusy,
  onRefresh,
  isRefreshing,
  pageSize,
  onPageSizeChange,
  message,
}: AcknowledgeBarProps) {
  // 상한은 실제로 보내는 건수에 걸린다 — 선택에 발주처리 비대상이 섞여 있어도 요청에는 안 들어간다.
  const isOverLimit = acknowledgeableCount > MAX_SELECTION;
  const notAcknowledgeable = selectedCount - acknowledgeableCount;

  return (
    <div className="bg-white rounded-lg shadow px-4 py-3 space-y-2">
      <div className="flex items-center justify-between gap-3">
        {/* 선택 건수는 이 바에서만 말한다 — 버튼 글자에 건수를 넣지 않는다.
            버튼마다 같은 수를 반복하면 두 버튼 중 어느 쪽 수인지 되읽게 된다. */}
        <div className="text-sm text-gray-700">
          {selectedCount > 0
            ? <>선택 <span className="font-semibold text-gray-900">{selectedCount}건</span></>
            : '주문을 선택하세요'}
        </div>

        <div className="flex flex-wrap items-center justify-end gap-3">
          {/* 상태 갱신은 마켓에 쓰지 않는 읽기라 ADMIN 게이트를 걸지 않는다(PLAN 2609_50 D17).
              상한(주문 50건)도 서버가 판정하므로 여기서 건수로 막지 않는다(D3). */}
          <Button
            variant="secondary"
            onClick={onRefresh}
            disabled={selectedCount === 0 || isRefreshing}
          >
            {isRefreshing ? <Spinner label="확인 중..." /> : '주문 상태 갱신'}
          </Button>

          {canAcknowledge && (
            <Button
              onClick={onAcknowledge}
              disabled={acknowledgeableCount === 0 || isOverLimit || isSubmitting}
            >
              {isSubmitting ? <Spinner label="전송 중..." /> : '발주처리'}
            </Button>
          )}

          {canAcknowledge && (
            <Button
              variant="confirm"
              onClick={onInternalAcknowledge}
              disabled={internalCount === 0 || internalBusy !== null}
            >
              {internalBusy === 'mark' ? <Spinner label="처리 중..." /> : '내부 발주처리'}
            </Button>
          )}

          {canAcknowledge && (
            <Button
              variant="secondary"
              onClick={onReleaseInternal}
              disabled={releaseCount === 0 || internalBusy !== null}
            >
              {internalBusy === 'release' ? <Spinner label="처리 중..." /> : '내부 발주 해제'}
            </Button>
          )}

          <select
            value={pageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
            className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            aria-label="페이지당 개수"
          >
            {PAGE_SIZE_OPTIONS.map((size) => (
              <option key={size} value={size}>
                {size}개씩
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* 선택한 라인이 아니라 그 라인이 속한 박스 전체가 전송된다(PLAN 2609_17 D1). */}
      {acknowledgeableCount > 0 && (
        <p className="text-xs text-gray-500">
          선택한 옵션이 속한 배송건(박스) 전체가 함께 발주처리됩니다.
        </p>
      )}

      {/* 발주처리 버튼이 왜 안 눌리는지 말해 준다 — 상태 갱신만 하려고 고른 경우가 흔하다. */}
      {notAcknowledgeable > 0 && (
        <p className="text-xs text-gray-500">
          선택한 {selectedCount}건 중 {notAcknowledgeable}건은 결제완료가 아니어서 발주처리 대상이 아닙니다.
          주문 상태 갱신은 그대로 됩니다.
        </p>
      )}

      {/* 내부 발주처리는 쿠팡에 보내지 않는다 — 쿠팡에는 결제완료로 남는다(D1). */}
      {canAcknowledge && internalCount > 0 && (
        <p className="text-xs text-gray-500">
          내부 발주처리는 쿠팡에 보내지 않습니다. 쿠팡에는 결제완료로 남고 오클릭스에만 「내부 상품준비중」으로 표시됩니다.
        </p>
      )}

      {isOverLimit && (
        <p className="text-xs text-red-700">
          한 번에 {MAX_SELECTION}건까지 발주처리할 수 있습니다. 선택을 줄여주세요.
        </p>
      )}

      {message && (
        <div className="text-sm text-gray-800">
          <p>{message.text}</p>
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
