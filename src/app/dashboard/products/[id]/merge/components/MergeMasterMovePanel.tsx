'use client';

import type { MergePreviewItem, MergePreviewPair } from '@/domain/repositories/ProductMergeRepository';

/**
 * Master move panel of the merge screen (FEATURE_2611_09 / D18 · D23 · D24 · D28).
 *
 * Shows every master the merge deletes (its components would equal another master's) and lets the user pick,
 * per option of that master, where it goes on the surviving master.
 * File: src/app/dashboard/products/[id]/merge/components/MergeMasterMovePanel.tsx
 *
 * Same picking rules as the 「마켓 상품 추가하기」 modal (`ImportCoupangProductModal`):
 * - choices = every option of the surviving master + 「새 옵션 만들기」
 * - 「새 옵션 만들기」 may be chosen only when the server found no option with the same quantities
 *   (`defaultOptionId === null`, D24 ③)
 * - no quantity input (D24 ⑥) — a new option takes the deleted option's quantities
 *
 * Presentational only: the container loads the preview and owns the chosen values.
 */
export interface MergeMasterOptionChoice {
  /** An option id of the surviving master, or 'new' = create an option named `newOptionName` */
  targetOptionId: number | 'new';
  newOptionName: string;
}

export interface MergeMasterMovePanelProps {
  pairs: MergePreviewPair[];
  /** Keyed by the deleted master's option id (`sourceOptionId`) */
  choices: Record<number, MergeMasterOptionChoice>;
  onChange: (sourceOptionId: number, choice: MergeMasterOptionChoice) => void;
  disabled?: boolean;
}

function itemsLabel(items: MergePreviewItem[]): string {
  return items.map((it) => `${it.productName}×${it.quantity}`).join(', ');
}

export function MergeMasterMovePanel({
  pairs,
  choices,
  onChange,
  disabled = false,
}: MergeMasterMovePanelProps) {
  if (pairs.length === 0) return null;

  return (
    <div className="mt-3 space-y-3">
      {pairs.map((pair) => (
        <div key={pair.deleteMasterId} className="rounded-lg border border-gray-200 p-3 text-sm">
          <p className="text-gray-900">
            구성품이 같아지는 마스터 {pair.deleteMasterName} 은 지워지고, 판매상품 {pair.listings.length}개가{' '}
            {pair.keepMasterName} 으로 옮겨집니다.
          </p>
          {pair.optionRows.map((row) => {
            const choice: MergeMasterOptionChoice = choices[row.sourceOptionId] ?? {
              targetOptionId: row.defaultOptionId ?? 'new',
              newOptionName: row.sourceOptionName,
            };
            return (
              <div key={row.sourceOptionId} className="mt-3">
                <p className="text-gray-800">
                  {row.sourceOptionName} ({itemsLabel(row.items)})
                </p>
                <div className="mt-2 flex items-center gap-2">
                  <span className="shrink-0 text-xs text-gray-500">마스터 옵션</span>
                  <select
                    disabled={disabled}
                    aria-label={`${row.sourceOptionName} 마스터 옵션`}
                    className="min-w-0 flex-1 rounded border border-gray-300 px-2 py-1 text-sm text-gray-900 disabled:bg-gray-100"
                    value={String(choice.targetOptionId)}
                    onChange={(e) => {
                      const value = e.target.value;
                      onChange(row.sourceOptionId, {
                        ...choice,
                        targetOptionId: value === 'new' ? 'new' : Number(value),
                      });
                    }}
                  >
                    {pair.keepOptions.map((option) => (
                      <option key={option.optionId} value={String(option.optionId)}>
                        {option.name} ({itemsLabel(option.items)})
                      </option>
                    ))}
                    <option value="new" disabled={row.defaultOptionId !== null}>
                      새 옵션 만들기
                    </option>
                  </select>
                </div>
                {choice.targetOptionId === 'new' && (
                  <>
                    <div className="mt-2 flex items-center gap-2">
                      <span className="shrink-0 text-xs text-gray-500">새 옵션 이름</span>
                      <input
                        type="text"
                        disabled={disabled}
                        aria-label={`${row.sourceOptionName} 새 옵션 이름`}
                        className="min-w-0 flex-1 rounded border border-gray-300 px-2 py-1 text-sm text-gray-900 disabled:bg-gray-100"
                        value={choice.newOptionName}
                        onChange={(e) => onChange(row.sourceOptionId, { ...choice, newOptionName: e.target.value })}
                      />
                    </div>
                    <p className="mt-1 text-[11px] text-gray-500">
                      {choice.newOptionName.trim() === ''
                        ? '새 옵션 이름을 입력하세요'
                        : '이 수량과 같은 옵션이 마스터에 없어 새 옵션을 만듭니다.'}
                    </p>
                  </>
                )}
              </div>
            );
          })}
        </div>
      ))}
      <p className="text-sm text-red-700">되돌릴 수 없습니다. 지운 마스터 내용은 병합 기록 파일에 남습니다.</p>
    </div>
  );
}
