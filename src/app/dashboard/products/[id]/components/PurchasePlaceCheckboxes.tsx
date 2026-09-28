'use client';

import type { PurchasePlace } from '@/domain/entities/PurchasePlace';

/**
 * 물품의 구매처 체크 목록 (FEATURE_2609_76 / D1 · D5).
 *
 * **용도**: 물품 등록·수정 폼에서 구매처를 **여러 개** 고른다. 한 물품을 여러 곳에서 살 수 있다.
 * **파일**: src/app/dashboard/products/[id]/components/PurchasePlaceCheckboxes.tsx
 * **쓰는 곳**: `ProductRegistrationForm` · `ProductEditForm` — 물품 구매처 입력은 이 컴포넌트 하나다.
 *
 * **Props**
 * - `places`: 선택지(`usePurchasePlaces().places`). 서버 목록 순서 그대로 그린다.
 * - `value`: 고른 구매처 id 목록. `onChange`: 새 id 목록(누른 순서가 아니라 체크 상태만 의미가 있다).
 * - `loading` · `failed`: `usePurchasePlaces()` 의 값 그대로.
 *
 * **사용 예제**
 * ```tsx
 * const { places, loading, failed } = usePurchasePlaces();
 * <PurchasePlaceCheckboxes
 *   places={places} loading={loading} failed={failed}
 *   value={watch('purchasePlaceIds')}
 *   onChange={(ids) => setValue('purchasePlaceIds', ids, { shouldDirty: true })}
 * />
 * ```
 *
 * ⚠️ 이름표는 「구매처」 하나다(D8). 「판매처」「상점」「스토어」 금지.
 * ❌ 하나만 고르는 `<select>` 로 되돌리지 말 것(D1).
 * ❌ 여기서 새 구매처를 추가하지 않는다 — 추가는 설정 > 구매처 관리에서만(D14).
 */
export interface PurchasePlaceCheckboxesProps {
  places: PurchasePlace[];
  value: number[];
  onChange: (ids: number[]) => void;
  loading: boolean;
  failed: boolean;
  disabled?: boolean;
}

export function PurchasePlaceCheckboxes({
  places,
  value,
  onChange,
  loading,
  failed,
  disabled = false,
}: PurchasePlaceCheckboxesProps) {
  const toggle = (id: number) =>
    onChange(value.includes(id) ? value.filter((selected) => selected !== id) : [...value, id]);

  return (
    <fieldset>
      <legend className="block text-sm font-medium text-gray-900 mb-1">구매처</legend>
      {loading ? (
        <p className="text-sm text-gray-500">구매처를 불러오는 중…</p>
      ) : failed ? (
        <p className="text-sm text-red-600">구매처 목록을 불러오지 못했습니다.</p>
      ) : places.length === 0 ? (
        <p className="text-sm text-gray-500">등록된 구매처가 없습니다. 설정 &gt; 구매처 관리에서 추가하세요.</p>
      ) : (
        <div className="flex flex-wrap gap-x-4 gap-y-2 py-2">
          {places.map((place) => (
            <label key={place.id} className="inline-flex items-center gap-2 text-sm text-gray-900">
              <input
                type="checkbox"
                className="h-4 w-4"
                checked={value.includes(place.id)}
                disabled={disabled}
                onChange={() => toggle(place.id)}
              />
              {place.name}
            </label>
          ))}
        </div>
      )}
    </fieldset>
  );
}
