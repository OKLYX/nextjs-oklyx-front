'use client';

/**
 * 「우리 기록」 뱃지 — 회수송장이 **마켓에 반영되지 않은** 값임을 알린다 (FEATURE_2609_70 / D12).
 *
 * **용도**: 쿠팡이 회수송장 등록을 거절해 우리 DB 에만 저장한 건(`collectInvoiceSource === 'LOCAL'`)을
 * 목록·상세에서 같은 말로 표시한다. 두 화면이 각자 문구를 쓰면 같은 사실이 다르게 읽힌다.
 *
 * **파일**: `src/app/dashboard/orders/claims/components/LocalRecordBadge.tsx`
 *
 * **사용 예제**:
 * ```tsx
 * // 목록 회수송장 열
 * {claim.collectInvoiceNo ?? '-'}
 * {claim.collectInvoiceSource === 'LOCAL' && <LocalRecordBadge />}
 *
 * // 상세 「회수송장」 행 (설명 툴팁 포함)
 * {claim.collectInvoiceSource === 'LOCAL' && <LocalRecordBadge title="쿠팡에는 반영되지 않았습니다" />}
 * ```
 *
 * ⚠️ `null`·`PLATFORM` 에는 **아무것도 그리지 않는다** — 정상이 시끄러우면 이상한 것을 못 본다.
 *    그래서 이 컴포넌트는 출처 값을 받지 않는다(호출부가 `LOCAL` 일 때만 그린다).
 * ❌ 이 뱃지로 [쿠팡에 다시 보내기] 버튼을 대신하지 말 것 — 무엇을 누를 수 있는지는 서버가
 *    `availableActions` 로 정한다(2609_21 D1).
 */
export function LocalRecordBadge({ title }: { title?: string }) {
  return (
    <span
      title={title}
      className="ml-2 px-2 py-0.5 text-xs rounded-full bg-gray-100 text-gray-600 whitespace-nowrap"
    >
      우리 기록
    </span>
  );
}
