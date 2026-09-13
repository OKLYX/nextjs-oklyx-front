'use client';

import type { RepricingRow } from '@/domain/entities/RepricingEntity';

/** 원 단위 금액. null = 계산 불가 → '—' */
export const formatWon = (value: number | null | undefined) =>
  value == null ? '—' : `${Math.round(value).toLocaleString('ko-KR')}원`;

/** 0~1 소수 → 퍼센트 문자열. null = '—' */
export const formatPercent = (rate: number | null | undefined) =>
  rate == null ? '—' : `${(Math.round(rate * 1000) / 10).toLocaleString('ko-KR')}%`;

interface RepricingTableProps {
  rows: RepricingRow[];
  /** 선택된 optionId 목록(전 그룹 공통, 부모가 보유) */
  selected: number[];
  onToggle: (optionId: number) => void;
  onToggleAll: (optionIds: number[], checked: boolean) => void;
  /** 실행 중이면 선택을 잠근다 */
  disabled?: boolean;
}

/**
 * 판매가 재계산 대상 옵션 표(FEATURE_2609_39 / PLAN D21·D23·D25).
 * File: src/app/dashboard/listings/repricing/components/RepricingTable.tsx
 *
 * 🔴 선택 단위는 **옵션 행**이지만 [재계산]은 상품(셀) 단위로 나간다 — 그 접기는 부모가 한다.
 * 🔴 「새 마진」열은 두지 않는다: 새 판매가는 목표 마진율로 역산한 값이라 모든 행이 같은 숫자다
 *    (목표 마진율은 카드 머리에 한 번 적는다).
 * 🔴 「비용 내역」은 **지금 값의 분해**다. 「전 → 후」로 쓰지 않는다 — 서버는 과거 비용을 모른다.
 */
export function RepricingTable({
  rows,
  selected,
  onToggle,
  onToggleAll,
  disabled = false,
}: RepricingTableProps) {
  if (rows.length === 0) {
    return <p className="px-4 py-6 text-center text-sm text-gray-500">표시할 옵션이 없습니다.</p>;
  }

  // 실행 가능한 행(= 직접 지정·계산 불가가 아닌 행)만 선택할 수 있다.
  const selectableIds = rows.filter((r) => r.excluded == null).map((r) => r.optionId);
  const allSelected =
    selectableIds.length > 0 && selectableIds.every((id) => selected.includes(id));

  const costDetail = (row: RepricingRow) => {
    if (row.costSum == null) return '—';
    const parts = [
      `원가 ${Math.round(row.costSum).toLocaleString('ko-KR')}`,
      `택배 ${Math.round(row.delivery ?? 0).toLocaleString('ko-KR')}`,
      `박스 ${Math.round(row.box ?? 0).toLocaleString('ko-KR')}`,
    ];
    if (row.feeAmount != null) parts.push(`수수료 ${Math.round(row.feeAmount).toLocaleString('ko-KR')}`);
    return parts.join(' + ');
  };

  return (
    <table>
      <thead className="bg-gray-100 border-b border-gray-200">
        <tr className="text-left text-sm text-gray-600">
          <th className="px-4 py-3">
            <input
              type="checkbox"
              checked={allSelected}
              disabled={disabled || selectableIds.length === 0}
              onChange={(e) => onToggleAll(selectableIds, e.target.checked)}
              aria-label="전체 선택"
            />
          </th>
          <th className="px-4 py-3">상품(셀)</th>
          <th className="px-4 py-3">옵션</th>
          <th className="px-4 py-3 text-right">현재가</th>
          <th className="px-4 py-3 text-right">현재 마진</th>
          <th className="px-4 py-3 text-right">새 판매가</th>
          <th className="px-4 py-3">비용 내역</th>
          <th className="px-4 py-3">반영</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => {
          const isExcluded = row.excluded != null;
          return (
            <tr
              key={row.optionId}
              className={`border-b border-gray-100 text-sm ${row.below ? 'bg-amber-50' : ''} ${
                isExcluded ? 'text-gray-400' : 'text-gray-900'
              }`}
            >
              <td className="px-4 py-3">
                <input
                  type="checkbox"
                  checked={selected.includes(row.optionId)}
                  disabled={disabled || isExcluded}
                  onChange={() => onToggle(row.optionId)}
                  aria-label={`${row.listingName} ${row.optionName} 선택`}
                />
              </td>
              <td className="px-4 py-3">{row.listingName}</td>
              <td className="px-4 py-3">
                <span>{row.optionName}</span>
                {row.below && (
                  <span className="ml-1.5 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] text-amber-700">
                    대응 필요
                  </span>
                )}
                {row.excluded === 'MANUAL' && (
                  <span
                    className="ml-1.5 rounded bg-gray-200 px-1.5 py-0.5 text-[10px] text-gray-600"
                    title="판매상품 옵션 편집에서 [기본값으로 변경]"
                  >
                    직접 지정
                  </span>
                )}
                {row.excluded === 'UNCALCULABLE' && row.excludedReason && (
                  <span className="ml-1.5 rounded bg-gray-200 px-1.5 py-0.5 text-[10px] text-gray-600">
                    {row.excludedReason}
                  </span>
                )}
              </td>
              <td className="px-4 py-3 text-right">{formatWon(row.judgedPrice)}</td>
              <td className="px-4 py-3 text-right">
                {row.marginAmount == null
                  ? '—'
                  : `${formatWon(row.marginAmount)} (${formatPercent(row.marginRate)})`}
              </td>
              <td className="px-4 py-3 text-right">{formatWon(row.newPrice)}</td>
              <td className="px-4 py-3">{costDetail(row)}</td>
              <td className="px-4 py-3">
                {row.pendingPush ? (
                  <span className="rounded bg-blue-100 px-1.5 py-0.5 text-[10px] text-blue-700">
                    미반영
                  </span>
                ) : (
                  '—'
                )}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
