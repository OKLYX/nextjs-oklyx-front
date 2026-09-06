'use client';

import type { InquiryTypeOption } from '@/domain/entities/InquiryEntity';

/**
 * 문의 유형 탭. `ClaimTypeTabs` 와 같은 모양·같은 의미다 — 탭은 **서버 축**(`type` 쿼리 파라미터)이라
 * 전환하면 재조회하고, 아래 상태 칩은 로컬 목록을 거른다.
 *
 * ⚠️ 유형 목록도 라벨도 `GET /api/inquiries/types` 가 준 것을 그대로 쓴다(D4).
 * 여기에 `PRODUCT_QNA: '상품문의'` 같은 표를 만들면 플랫폼이 늘 때 화면을 다시 짠다.
 */
interface InquiryTypeTabsProps {
  types: InquiryTypeOption[];
  value: string;
  onChange: (code: string) => void;
  // Blocks double-clicks while a fetch is in flight
  disabled: boolean;
}

export function InquiryTypeTabs({ types, value, onChange, disabled }: InquiryTypeTabsProps) {
  return (
    <div className="flex gap-1 border-b border-gray-200">
      {types.map((type) => {
        const isActive = value === type.code;
        return (
          <button
            key={type.code}
            type="button"
            onClick={() => onChange(type.code)}
            disabled={disabled}
            // Same shape as ClaimTypeTabs: the inactive tab keeps a transparent bottom border so
            // the bar does not jump 2px on every switch.
            className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium disabled:cursor-not-allowed ${
              isActive
                ? 'border-blue-600 text-blue-700'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {type.label}
          </button>
        );
      })}
    </div>
  );
}
