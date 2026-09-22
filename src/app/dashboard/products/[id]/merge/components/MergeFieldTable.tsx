'use client';

import type { Product } from '@/domain/entities/Product';
import { Card } from '@/presentation/components/ui/Card';
import {
  MERGE_FIELDS,
  fieldText,
  fieldValue,
  isSameField,
  otherSide,
  type MergeFieldKey,
  type MergeSide,
} from './mergeFields';

/**
 * 항목별 취사선택 표 (FEATURE_2609_69 / B).
 *
 * - 양쪽 값이 **같은 항목은 숨긴다** — 고를 것이 없는 줄을 보여주면 다른 값이 묻힌다.
 * - 값이 **비어 있는 쪽은 고를 수 없다**. 값을 비우는 일은 수정 화면에서 한다.
 * - 바코드 충돌(409)은 서버 문구 그대로 바코드 줄 아래에 붙인다.
 */
export interface MergeFieldTableProps {
  keep: Product;
  discard: Product;
  keepSide: MergeSide;
  choices: Record<MergeFieldKey, MergeSide>;
  onChange: (key: MergeFieldKey, side: MergeSide) => void;
  /** 바코드 줄 아래에 그대로 표시할 서버 409 문구 */
  barcodeConflict: string | null;
  disabled?: boolean;
}

export function MergeFieldTable({
  keep,
  discard,
  keepSide,
  choices,
  onChange,
  barcodeConflict,
  disabled = false,
}: MergeFieldTableProps) {
  const discardSide = otherSide(keepSide);
  const rows = MERGE_FIELDS.filter(({ key }) => !isSameField(keep, discard, key));

  return (
    <Card title="항목별로 어느 값을 쓸지">
      {rows.length === 0 ? (
        <p className="text-sm text-gray-600">두 물품의 값이 모두 같습니다. 고를 것이 없습니다.</p>
      ) : (
        <>
          <p className="mb-4 text-sm text-gray-600">
            값이 같은 항목은 숨겼습니다. 고르지 않은 항목은 남길 물품의 값이 그대로 남습니다.
          </p>
          <table className="w-full text-sm">
            <thead className="border-b border-gray-200 bg-gray-100">
              <tr className="text-left text-gray-600">
                <th className="w-28 px-4 py-2">항목</th>
                <th className="px-4 py-2">남길 쪽</th>
                <th className="px-4 py-2">버릴 쪽</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ key, label }) => (
                <tr key={key} className="border-b border-gray-100 align-top last:border-b-0">
                  <td className="px-4 py-3 text-gray-600">{label}</td>
                  <td className="px-4 py-3">
                    <ValueRadio
                      name={`merge-field-${key}`}
                      checked={choices[key] === keepSide}
                      value={fieldText(keep, key)}
                      empty={fieldValue(keep, key) === null}
                      disabled={disabled}
                      onSelect={() => onChange(key, keepSide)}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <ValueRadio
                      name={`merge-field-${key}`}
                      checked={choices[key] === discardSide}
                      value={fieldText(discard, key)}
                      empty={fieldValue(discard, key) === null}
                      disabled={disabled}
                      onSelect={() => onChange(key, discardSide)}
                    />
                    {key === 'barcodeId' && barcodeConflict && (
                      <p className="mt-2 text-sm text-red-600">{barcodeConflict}</p>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </Card>
  );
}

function ValueRadio({
  name,
  checked,
  value,
  empty,
  disabled,
  onSelect,
}: {
  name: string;
  checked: boolean;
  value: string;
  empty: boolean;
  disabled: boolean;
  onSelect: () => void;
}) {
  return (
    <label
      className={`flex items-start gap-2 ${empty || disabled ? 'cursor-not-allowed text-gray-400' : 'cursor-pointer text-gray-900'}`}
    >
      <input
        type="radio"
        name={name}
        className="mt-1"
        checked={checked}
        disabled={empty || disabled}
        onChange={onSelect}
      />
      <span className="whitespace-pre-wrap break-words">{empty ? '(비어 있음)' : value}</span>
    </label>
  );
}
