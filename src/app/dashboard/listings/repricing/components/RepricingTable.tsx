'use client';

import { Button } from '@/presentation/components/ui/Button';
import { Spinner } from '@/presentation/components/Spinner';
import type { RepricingRow } from '@/domain/entities/RepricingEntity';
import { basePriceText, parsePrice, previewMargin, sanitizePriceInput } from './priceDraft';
import { pushBlockLabel, pushBlockOf, type RecentActionMap } from './rowActions';

/** 원 단위 금액. null = 계산 불가 → '—' */
export const formatWon = (value: number | null | undefined) =>
  value == null ? '—' : `${Math.round(value).toLocaleString('ko-KR')}원`;

/** 0~1 소수 → 퍼센트 문자열. null = '—' */
export const formatPercent = (rate: number | null | undefined) =>
  rate == null ? '—' : `${(Math.round(rate * 1000) / 10).toLocaleString('ko-KR')}%`;

/** 「손익분기가」 열 머리 설명(2609_44 / PLAN 용어). 이 한 문장이 열 이름의 뜻을 다 담는다. */
const BREAK_EVEN_HINT =
  '마진이 0이 되는 판매가입니다. 원가·택배비·박스비와 채널 수수료(부가세 포함)를 낸 뒤 남는 것이 없는 지점으로, 이 값 아래로 팔면 손해입니다.';

/** 지금 가격이 손익분기가 아래인가 = 마진이 음수라는 뜻(2609_44 Step 4). 둘 중 하나라도 없으면 판정하지 않는다. */
const isBelowBreakEven = (row: RepricingRow) =>
  row.breakEvenPrice != null && row.judgedPrice != null && row.judgedPrice < row.breakEvenPrice;

interface RepricingTableProps {
  rows: RepricingRow[];
  /** 선택된 optionId 목록(전 그룹 공통, 부모가 보유) */
  selected: number[];
  onToggle: (optionId: number) => void;
  onToggleAll: (optionIds: number[], checked: boolean) => void;
  /** 편집 중인 optionId 목록 = 저장하지 않은 입력값이 있는 행(전 그룹 공통) */
  editing: number[];
  /** optionId → 입력칸의 현재 문자열. 편집 중일 때만 쓴다 */
  drafts: Record<number, string>;
  onDraftChange: (optionId: number, value: string) => void;
  /** [개별 입력] — 두 번째 인자는 입력칸의 시작값(공식값) */
  onEditStart: (optionId: number, initial: string) => void;
  onEditCancel: (optionId: number) => void;
  /** [저장] — 그 행 하나만 저장한다(PLAN 2609_43 D5·D8) */
  onSaveRow: (row: RepricingRow, price: number) => void;
  /** [마켓 반영] — 그 행 하나만 전송한다(D3·D8) */
  onPushRow: (row: RepricingRow) => void;
  /** 방금 처리한 행의 결과. 응답에서 빠진 행도 이 표시를 달고 남는다(D7) */
  recent: RecentActionMap;
  /** 이 그룹의 목표 마진율(0~1). 예상 마진율이 이 값 미만이면 경고색 */
  targetMarginRate: number | null;
  /** 실행 중이면 선택·입력을 잠근다 */
  disabled?: boolean;
  /** 실행 중인 행. 그 행의 버튼만 스피너를 돈다 */
  busyOptionId?: number | null;
}

/**
 * 판매가 재계산 대상 옵션 표(FEATURE_2609_39 D21·D23·D25 + 2609_42 D2·D9 + 2609_43 D1·D5·D6·D7).
 * File: src/app/dashboard/listings/repricing/components/RepricingTable.tsx
 *
 * 🔴 실행이 **행 안에** 있다(2609_43 D3·D5): 「새 판매가」는 [개별 입력] → [저장] 으로 열고 닫고,
 *    맨 오른쪽 [마켓 반영]이 그 행 하나를 전송한다. 묶음 버튼은 여러 건을 몰아칠 때만 쓴다.
 * 🔴 편집 중인 행은 [마켓 반영]을 **누를 수 없다**(D6) — 저장 전 옛 값이 마켓에 나가는 사고를 막는다.
 *    판정은 {@link pushBlockOf} 가 소유한다.
 * 🔴 직접 지정가(`MANUAL`) 행도 입력·반영이 된다(2609_43 D1, 2609_39 D6·2609_42 D4 번복).
 *    배지는 「재계산 제외」다 — 「실행 불가」가 아니다(D2).
 * 🔴 「비용 내역」은 **지금 값의 분해**다. 「전 → 후」로 쓰지 않는다 — 서버는 과거 비용을 모른다.
 *
 * 🔴 표는 **가로로 넘치지 않는다**(2609_44 / PLAN D5): 열 폭 합이 100% 인 `table-fixed` + colgroup 이고,
 *    상품·옵션을 한 열에 2줄로, 반영 상태와 [마켓 반영]을 한 열에 2줄로 합쳐 「손익분기가」 자리를 만들었다.
 *    ⚠️ 이 표에 `list-table-scroll`(최소폭 736px + nowrap)을 다시 씌우지 말 것 — 그게 가로 스크롤의 원인이었다.
 * 🔴 「손익분기가」는 **서버가 준 `breakEvenPrice` 를 그대로** 보여준다(PLAN D1). 화면에는 수수료 금액만 있고
 *    비율이 없어 역산하면 값이 어긋난다.
 */
export function RepricingTable({
  rows,
  selected,
  onToggle,
  onToggleAll,
  editing,
  drafts,
  onDraftChange,
  onEditStart,
  onEditCancel,
  onSaveRow,
  onPushRow,
  recent,
  targetMarginRate,
  disabled = false,
  busyOptionId = null,
}: RepricingTableProps) {
  if (rows.length === 0) {
    return <p className="px-4 py-6 text-center text-sm text-gray-500">표시할 옵션이 없습니다.</p>;
  }

  // 계산 불가 행만 선택에서 뺀다 — 직접 지정가는 마켓 반영 대상이다(2609_43 D1).
  const selectableIds = rows
    .filter((r) => r.excluded !== 'UNCALCULABLE')
    .map((r) => r.optionId);
  const allSelected =
    selectableIds.length > 0 && selectableIds.every((id) => selected.includes(id));

  /**
   * 「비용 내역」 칸 — 항목마다 한 줄, 금액은 오른쪽 정렬로 자릿수를 맞춘다(2609_44 / PLAN D4).
   *
   * 🔴 금액이 없는 항목도 줄을 **빼지 않고** `—` 로 둔다 — 줄 수가 행마다 달라지면 표가 들쭉날쭉해진다.
   */
  const costDetail = (row: RepricingRow) => {
    if (row.costSum == null) return <span className="text-xs text-gray-500">—</span>;
    const items: { label: string; value: number | null }[] = [
      { label: '원가', value: row.costSum },
      { label: '택배', value: row.delivery },
      { label: '박스', value: row.box },
      { label: '수수료', value: row.feeAmount },
    ];
    return (
      <dl className="space-y-0.5 text-xs leading-tight">
        {items.map((item) => (
          <div key={item.label} className="flex items-baseline justify-between gap-2">
            <dt className="text-gray-500">{item.label}</dt>
            <dd className="tabular-nums">
              {item.value == null ? '—' : Math.round(item.value).toLocaleString('ko-KR')}
            </dd>
          </div>
        ))}
      </dl>
    );
  };

  /** 「새 판매가」 칸 — 기본 / 편집 중 / 저장 직후 세 모습(D5). */
  const priceCell = (row: RepricingRow) => {
    if (row.excluded === 'UNCALCULABLE') {
      return (
        <div className="text-right">
          <span>{formatWon(row.newPrice)}</span>
          <p className="mt-0.5 text-[11px] text-gray-500">{row.excludedReason ?? '계산할 수 없습니다'}</p>
        </div>
      );
    }

    const isEditing = editing.includes(row.optionId);
    const action = recent[row.optionId];

    if (isEditing) {
      const draft = drafts[row.optionId] ?? basePriceText(row);
      const parsed = parsePrice(draft);
      return (
        // key = 모드가 바뀔 때 입력칸을 새로 마운트시켜 autoFocus 가 실제로 먹게 한다.
        <div key={`edit-${row.optionId}`} className="flex flex-col items-end gap-1">
          <input
            type="text"
            inputMode="decimal"
            value={draft}
            disabled={disabled}
            autoFocus
            onChange={(e) => onDraftChange(row.optionId, sanitizePriceInput(e.target.value))}
            aria-label={`${row.listingName} ${row.optionName} 새 판매가`}
            className={`w-full max-w-28 rounded border px-2 py-1 text-right text-sm text-gray-900 disabled:bg-gray-100 ${
              parsed == null ? 'border-red-500 bg-red-50' : 'border-blue-500 bg-blue-50'
            }`}
          />
          <div className="flex gap-1">
            <Button
              size="sm"
              disabled={disabled || parsed == null}
              onClick={() => parsed != null && onSaveRow(row, parsed)}
              className="flex items-center gap-1"
            >
              {busyOptionId === row.optionId ? <Spinner label="저장 중..." /> : '저장'}
            </Button>
            <Button
              size="sm"
              variant="secondary"
              disabled={disabled}
              onClick={() => onEditCancel(row.optionId)}
            >
              취소
            </Button>
          </div>
          {parsed == null ? (
            <span className="text-[11px] text-red-600">0보다 큰 금액을 입력하세요</span>
          ) : row.excluded === 'MANUAL' ? (
            <span className="text-[11px] text-gray-400">직접 지정가라 재계산으로 바뀌지 않습니다</span>
          ) : (
            <span className="text-[11px] text-gray-400">다음 재계산 때 공식값으로 되돌아갑니다</span>
          )}
        </div>
      );
    }

    if (action != null) {
      return (
        <div key={`saved-${row.optionId}`} className="flex flex-col items-end gap-0.5">
          <input
            type="text"
            value={formatWon(action.price ?? row.newPrice)}
            disabled
            readOnly
            aria-label={`${row.listingName} ${row.optionName} 새 판매가`}
            className="w-full max-w-28 rounded border border-gray-300 bg-gray-100 px-2 py-1 text-right text-sm text-gray-900"
          />
          <span className="text-[11px] text-gray-500">
            {action.kind === 'SAVED' ? '입력값 저장됨' : '마켓에 반영된 값'}
          </span>
          <Button
            size="sm"
            variant="secondary"
            disabled={disabled}
            onClick={() => onEditStart(row.optionId, basePriceText(row))}
          >
            다시 입력
          </Button>
        </div>
      );
    }

    return (
      <div key={`idle-${row.optionId}`} className="flex flex-col items-end gap-1">
        <span>{formatWon(row.newPrice)}</span>
        <Button
          size="sm"
          variant="secondary"
          disabled={disabled}
          onClick={() => onEditStart(row.optionId, basePriceText(row))}
        >
          개별 입력
        </Button>
      </div>
    );
  };

  /** 편집 중인 행에만 예상 마진을 덧붙인다. 필요한 값이 하나라도 없으면 아예 내지 않는다(2609_42 D9). */
  const marginCell = (row: RepricingRow) => {
    const current =
      row.marginAmount == null
        ? '—'
        : `${formatWon(row.marginAmount)} (${formatPercent(row.marginRate)})`;

    if (!editing.includes(row.optionId)) return current;
    const price = parsePrice(drafts[row.optionId] ?? basePriceText(row));
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

  /** 「반영」 칸 — 방금 처리한 결과가 있으면 그것부터 보여준다(D7). */
  const statusCell = (row: RepricingRow) => {
    const action = recent[row.optionId];
    if (action?.kind === 'PUSHED') {
      return (
        <span className="rounded bg-green-100 px-1.5 py-0.5 text-[10px] text-green-700">
          마켓 반영 완료{action.price != null && ` ${formatWon(action.price)}`}
        </span>
      );
    }
    if (action?.kind === 'SAVED') {
      return (
        <span className="flex flex-wrap items-center gap-1">
          <span className="rounded bg-gray-200 px-1.5 py-0.5 text-[10px] text-gray-600">저장됨</span>
          {row.pendingPush && (
            <span className="rounded bg-blue-100 px-1.5 py-0.5 text-[10px] text-blue-700">미반영</span>
          )}
        </span>
      );
    }
    return row.pendingPush ? (
      <span className="rounded bg-blue-100 px-1.5 py-0.5 text-[10px] text-blue-700">미반영</span>
    ) : (
      '—'
    );
  };

  /** 행 [마켓 반영] — 막혀 있으면 이유를 같이 적는다(D6). */
  const pushCell = (row: RepricingRow) => {
    const blocked = pushBlockOf(row, editing.includes(row.optionId));
    const label = blocked == null ? null : pushBlockLabel(row, blocked);
    return (
      <div className="flex flex-col items-start gap-0.5" title={label ?? undefined}>
        <Button
          size="sm"
          disabled={disabled || blocked != null}
          onClick={() => onPushRow(row)}
          className="flex items-center gap-1"
        >
          {busyOptionId === row.optionId ? <Spinner label="반영 중..." /> : '마켓 반영'}
        </Button>
        {label && <span className="text-[11px] text-gray-500">{label}</span>}
      </div>
    );
  };

  return (
    // 🔴 `table-fixed` + colgroup 으로 열 폭을 카드 안에 가둔다(2609_44 / PLAN D5) — 폭 합이 100% 라
    //    어떤 화면 폭에서도 표가 카드를 넘지 않는다. 넘치던 원인은 `list-table-scroll`(최소폭 736px +
    //    nowrap)이었고, 그래서 이 표는 그 클래스를 쓰지 않는다.
    <table className="w-full table-fixed text-sm">
      <colgroup>
        <col className="w-[4%]" />
        <col className="w-[20%]" />
        <col className="w-[9%]" />
        <col className="w-[13%]" />
        <col className="w-[10%]" />
        <col className="w-[17%]" />
        <col className="w-[15%]" />
        <col className="w-[12%]" />
      </colgroup>
      <thead className="bg-gray-100 border-b border-gray-200">
        <tr className="text-left text-sm text-gray-600">
          <th className="px-2 py-3">
            <input
              type="checkbox"
              checked={allSelected}
              disabled={disabled || selectableIds.length === 0}
              onChange={(e) => onToggleAll(selectableIds, e.target.checked)}
              aria-label="전체 선택"
            />
          </th>
          <th className="px-3 py-3">상품(셀) / 옵션</th>
          <th className="px-3 py-3 text-right">현재가</th>
          <th className="px-3 py-3 text-right">현재 마진</th>
          <th className="px-3 py-3 text-right" title={BREAK_EVEN_HINT}>
            손익분기가
          </th>
          <th className="px-3 py-3 text-right">새 판매가</th>
          <th className="px-3 py-3">비용 내역</th>
          <th className="px-3 py-3">반영</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => {
          const handled = recent[row.optionId] != null;
          // 방금 처리한 행은 기준을 넘겼으므로 경보색을 벗긴다(D7).
          const alert = row.below && !handled;
          // 현재가가 손익분기가 아래면 마진이 음수다 — 이 열을 추가한 이유라 눈에 띄게 칠한다.
          const belowBreakEven = isBelowBreakEven(row);
          return (
            <tr
              key={row.optionId}
              className={`border-b border-gray-100 text-sm ${alert ? 'bg-amber-50' : ''} ${
                row.excluded === 'UNCALCULABLE' ? 'text-gray-400' : 'text-gray-900'
              }`}
            >
              <td className="px-2 py-3 align-top">
                <input
                  type="checkbox"
                  checked={selected.includes(row.optionId)}
                  disabled={disabled || row.excluded === 'UNCALCULABLE'}
                  onChange={() => onToggle(row.optionId)}
                  aria-label={`${row.listingName} ${row.optionName} 선택`}
                />
              </td>
              {/* 상품·옵션을 한 열에 2줄로 합쳐 손익분기가 열 자리를 만든다(2609_44 / PLAN D5·D6). */}
              <td className="px-3 py-3 align-top">
                <p className="truncate font-medium" title={row.listingName}>
                  {row.listingName}
                </p>
                <p className="truncate text-xs text-gray-500" title={row.optionName}>
                  {row.optionName}
                </p>
                {(alert || row.excluded != null) && (
                  <div className="mt-1 flex flex-wrap items-center gap-1">
                    {alert && (
                      <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] text-amber-700">
                        대응 필요
                      </span>
                    )}
                    {row.excluded === 'MANUAL' && (
                      <span
                        className="rounded bg-gray-200 px-1.5 py-0.5 text-[10px] text-gray-600"
                        title="가격을 사람이 직접 정한 옵션입니다. [재계산]으로는 바뀌지 않지만, 직접 입력과 마켓 반영은 됩니다."
                      >
                        재계산 제외
                      </span>
                    )}
                    {row.excluded === 'UNCALCULABLE' && row.excludedReason && (
                      <span className="rounded bg-gray-200 px-1.5 py-0.5 text-[10px] text-gray-600">
                        {row.excludedReason}
                      </span>
                    )}
                  </div>
                )}
              </td>
              <td
                className={`px-3 py-3 text-right align-top ${
                  belowBreakEven ? 'font-semibold text-red-700' : ''
                }`}
                title={belowBreakEven ? '손익분기가보다 낮은 가격입니다 — 지금 팔면 손해입니다.' : undefined}
              >
                {formatWon(row.judgedPrice)}
              </td>
              <td className="px-3 py-3 text-right align-top">{marginCell(row)}</td>
              <td className="px-3 py-3 text-right align-top">
                <span>{formatWon(row.breakEvenPrice)}</span>
                {belowBreakEven && (
                  <span
                    className="ml-1 text-red-700"
                    title="현재가가 이 값보다 낮습니다 — 마진이 음수입니다."
                    aria-label="현재가가 손익분기가보다 낮습니다"
                  >
                    ⚠
                  </span>
                )}
              </td>
              <td className="px-3 py-3 text-right align-top">{priceCell(row)}</td>
              <td className="px-3 py-3 align-top">{costDetail(row)}</td>
              {/* 반영 상태와 [마켓 반영]을 한 열에 2줄로 합친다(2609_44 / PLAN D5). */}
              <td className="px-3 py-3 align-top">
                <div className="flex flex-col items-start gap-1">
                  {statusCell(row)}
                  {pushCell(row)}
                </div>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
