'use client';

import type { ProductUsage } from '@/domain/entities/ProductUsage';
import type { MergeTransferOptions } from '@/domain/repositories/ProductMergeRepository';
import { Card } from '@/presentation/components/ui/Card';
import { TRANSFER_ROWS } from './mergeFields';

/**
 * 옮길 기록 고르기 (FEATURE_2609_69 / B).
 *
 * 🔴 기본은 **전부 켜짐**. 끈 항목은 옮겨지지 않고 버릴 물품과 함께 묻힌다(지워지는 것은 아니지만
 * 숨은 물품에 매달려 더는 보이지 않는다).
 * 🔴 건수가 0인 줄은 숨긴다 — 고를 것이 없다.
 */
export interface MergeTransferPanelProps {
  /** 건수는 **버릴 쪽** 것이다 — 옮겨질 후보가 거기 있다 */
  discardHistory: ProductUsage['history'];
  transfer: MergeTransferOptions;
  onChange: (key: keyof MergeTransferOptions, value: boolean) => void;
  disabled?: boolean;
}

export function MergeTransferPanel({
  discardHistory,
  transfer,
  onChange,
  disabled = false,
}: MergeTransferPanelProps) {
  const rows = TRANSFER_ROWS.filter((row) => (discardHistory[row.countKey] ?? 0) > 0);

  return (
    <Card title="옮길 기록">
      {rows.length === 0 ? (
        <p className="text-sm text-gray-600">버릴 물품에 옮길 기록이 없습니다.</p>
      ) : (
        <ul className="space-y-2">
          {rows.map((row) => (
            <li key={row.key} className="flex items-center gap-3 text-sm">
              <label className="flex flex-1 cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  checked={transfer[row.key]}
                  disabled={disabled}
                  onChange={(event) => onChange(row.key, event.target.checked)}
                />
                <span className="w-24 text-gray-900">{row.label}</span>
                <span className="text-gray-600">
                  {discardHistory[row.countKey]}
                  {row.unit}
                </span>
              </label>
              <span className="text-xs text-gray-500">
                {transfer[row.key] ? (row.note ?? '') : '끄면 버릴 물품과 함께 묻힙니다'}
              </span>
            </li>
          ))}
        </ul>
      )}

      <label className="mt-4 flex cursor-pointer items-center gap-2 border-t border-gray-100 pt-4 text-sm">
        <input
          type="checkbox"
          checked={transfer.appendMemo}
          disabled={disabled}
          onChange={(event) => onChange('appendMemo', event.target.checked)}
        />
        <span className="text-gray-900">옮긴 내용을 남길 물품 설명에 메모로 남기기</span>
      </label>
    </Card>
  );
}
