'use client';

import type { RepricingRow } from '@/domain/entities/RepricingEntity';
import {
  basePriceText,
  isEdited,
  parsePrice,
  previewMargin,
  sanitizePriceInput,
} from './priceDraft';

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
  /** optionId → 입력칸의 현재 문자열. 없으면 공식값을 그대로 보여준다 */
  drafts: Record<number, string>;
  onDraftChange: (optionId: number, value: string) => void;
  /** 이 그룹의 목표 마진율(0~1). 예상 마진율이 이 값 미만이면 경고색 */
  targetMarginRate: number | null;
  /** 실행 중이면 선택을 잠근다 */
  disabled?: boolean;
}

/**
 * 판매가 재계산 대상 옵션 표(FEATURE_2609_39 / PLAN D21·D23·D25 + FEATURE_2609_42 D2·D4·D9).
 * File: src/app/dashboard/listings/repricing/components/RepricingTable.tsx
 *
 * 🔴 선택 단위는 **옵션 행**이지만 [재계산]은 상품(셀) 단위로 나간다 — 그 접기는 부모가 한다.
 * 🔴 「새 마진」열은 두지 않는다: 새 판매가는 목표 마진율로 역산한 값이라 모든 행이 같은 숫자다
 *    (목표 마진율은 카드 머리에 한 번 적는다). 단, **사람이 값을 고친 행만** 그 자리에서 예상 마진을 센다.
 * 🔴 「비용 내역」은 **지금 값의 분해**다. 「전 → 후」로 쓰지 않는다 — 서버는 과거 비용을 모른다.
 * 🔴 「새 판매가」 입력값은 저장해도 `price_source` 를 바꾸지 않아 **다음 재계산 때 공식값으로 되돌아간다**(2609_42 D2).
 * 🔴 직접 지정가·계산 불가 행은 입력칸을 **열지 않는다**(D4) — 서버가 `skipped` 로 되돌려 보내므로 눌러도 아무 일이 없다.
 */
export function RepricingTable({
  rows,
  selected,
  onToggle,
  onToggleAll,
  drafts,
  onDraftChange,
  targetMarginRate,
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

  /** 입력칸을 여는 행인지. 직접 지정가·계산 불가는 저장 대상이 아니다(D4). */
  const priceCell = (row: RepricingRow) => {
    if (row.excluded === 'MANUAL') {
      return (
        <div className="text-right">
          <span>{formatWon(row.newPrice)}</span>
          <p className="mt-0.5 text-[11px] text-gray-500">
            직접 지정가입니다. 옵션 편집에서 바꾸세요
          </p>
        </div>
      );
    }
    if (row.excluded === 'UNCALCULABLE') {
      return (
        <div className="text-right">
          <span>{formatWon(row.newPrice)}</span>
          <p className="mt-0.5 text-[11px] text-gray-500">{row.excludedReason ?? '계산할 수 없습니다'}</p>
        </div>
      );
    }

    const draft = drafts[row.optionId] ?? basePriceText(row);
    const edited = isEdited(row, drafts[row.optionId]);
    const parsed = parsePrice(draft);
    const invalid = edited && parsed == null;

    return (
      <div className="flex flex-col items-end gap-0.5">
        <input
          type="text"
          inputMode="decimal"
          value={draft}
          disabled={disabled}
          onChange={(e) => onDraftChange(row.optionId, sanitizePriceInput(e.target.value))}
          aria-label={`${row.listingName} ${row.optionName} 새 판매가`}
          className={`w-28 rounded border px-2 py-1 text-right text-sm text-gray-900 disabled:bg-gray-100 ${
            invalid
              ? 'border-red-500 bg-red-50'
              : edited
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-300'
          }`}
        />
        {invalid ? (
          <span className="text-[11px] text-red-600">0보다 큰 금액을 입력하세요</span>
        ) : (
          <span className="text-[11px] text-gray-400">다음 재계산 때 공식값으로 되돌아갑니다</span>
        )}
      </div>
    );
  };

  /** 값을 고친 행에만 예상 마진을 덧붙인다. 필요한 값이 하나라도 없으면 아예 내지 않는다(D9). */
  const marginCell = (row: RepricingRow) => {
    const current =
      row.marginAmount == null
        ? '—'
        : `${formatWon(row.marginAmount)} (${formatPercent(row.marginRate)})`;

    const draft = drafts[row.optionId];
    if (row.excluded != null || !isEdited(row, draft)) return current;
    const price = parsePrice(draft as string);
    const preview = price == null ? null : previewMargin(row, price);
    if (preview == null) return current;

    const tone =
      preview.rate < 0
        ? 'text-red-700 font-semibold'
        : targetMarginRate != null && preview.rate < targetMarginRate
          ? 'text-amber-700'
          : 'text-blue-700';

    return (
      <div className="text-right">
        <span>{current}</span>
        <p className={`mt-0.5 text-[11px] ${tone}`}>
          예상 {formatWon(preview.amount)} ({formatPercent(preview.rate)})
        </p>
      </div>
    );
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
              <td className="px-4 py-3 text-right">{marginCell(row)}</td>
              <td className="px-4 py-3 text-right">{priceCell(row)}</td>
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
