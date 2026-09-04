'use client';

import { Spinner } from '@/presentation/components/Spinner';

/**
 * 출고관리 표 상단 선택 액션 바 — 선택 건수 · [발주처리] · 페이지 크기 · 결과 메시지.
 *
 * ⚠️ `ShipmentFilterCard` 에 넣지 않는다 — 그 카드는 "조회 조건 + 서버가 sellerId 로 처리하는 액션"의
 * 자리다. 발주처리는 선택에 종속되고 페이지 크기는 표에 종속이라 표 바로 위가 맞다.
 * ⚠️ 바 자체는 항상 렌더한다(비-ADMIN·결과 0건 포함) — 숨는 것은 [발주처리] 버튼뿐.
 */
/** 페이지 크기는 판매상품 마스터와 같은 25/50/100 (PLAN 2609_17 D16). 그 화면의 URL 쿼리 모듈에서 import 하지 않는다. */
const PAGE_SIZE_OPTIONS = [25, 50, 100] as const;
/** 서버 `@Size(max=500)` 과 같은 값. 넘겨 보내면 400 이라 버튼에서 먼저 막는다(PLAN 2609_17 D12). */
const MAX_SELECTION = 500;

interface AcknowledgeBarProps {
  selectedCount: number;
  onAcknowledge: () => void;
  isSubmitting: boolean;
  canAcknowledge: boolean;      // = isAdmin
  pageSize: number;
  onPageSizeChange: (size: number) => void;
  message: { text: string; detail: string[] } | null;
}

export function AcknowledgeBar({
  selectedCount,
  onAcknowledge,
  isSubmitting,
  canAcknowledge,
  pageSize,
  onPageSizeChange,
  message,
}: AcknowledgeBarProps) {
  const isOverLimit = selectedCount > MAX_SELECTION;

  return (
    <div className="bg-white rounded-lg shadow px-4 py-3 space-y-2">
      <div className="flex items-center justify-between gap-3">
        <div className="text-sm text-gray-700">
          {selectedCount > 0 ? `선택 ${selectedCount}건` : '발주처리할 주문을 선택하세요'}
        </div>

        <div className="flex items-center gap-3">
          {canAcknowledge && (
            <button
              onClick={onAcknowledge}
              disabled={selectedCount === 0 || isOverLimit || isSubmitting}
              className="px-6 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors disabled:bg-blue-400 disabled:cursor-not-allowed"
            >
              {isSubmitting ? <Spinner label="전송 중..." /> : `발주처리 (${selectedCount}건)`}
            </button>
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
      {selectedCount > 0 && (
        <p className="text-xs text-gray-500">
          선택한 옵션이 속한 배송건(박스) 전체가 함께 발주처리됩니다.
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
