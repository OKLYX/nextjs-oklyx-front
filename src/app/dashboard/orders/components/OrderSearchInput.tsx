'use client';

import { X } from 'lucide-react';
import type { OrderSearchField } from '@/domain/entities/OrderEntity';

/**
 * 주문 검색 입력(대상 칩 4개 + 검색어 입력).
 *
 * **용도**: 주문내역(`OrderSearchCard`)·출고관리(`ShipmentFilterCard`) 두 카드가 **같은** 검색
 * UI 를 쓰기 위한 공용 조각. 검색은 클라이언트 필터라 서버를 부르지 않는다.
 * **파일**: src/app/dashboard/orders/components/OrderSearchInput.tsx
 *
 * **사용 예제**:
 * ```tsx
 * <OrderSearchInput
 *   searchField={searchField}
 *   onSearchFieldChange={setSearchField}
 *   searchTerm={searchTerm}
 *   onSearchTermChange={setSearchTerm}
 * />
 * ```
 *
 * ⚠️ 판정은 `matchesOrderSearch`(도메인) 하나만 쓴다 — 화면에서 문자열 비교를 다시 만들지 말 것.
 * ❌ 칩 목록·placeholder 를 화면마다 복사하지 말 것. 칩이 늘어나면 여기 한 곳만 고친다.
 */
interface OrderSearchInputProps {
  searchField: OrderSearchField;
  onSearchFieldChange: (field: OrderSearchField) => void;
  searchTerm: string;
  onSearchTermChange: (value: string) => void;
}

const CHIP_BASE = 'px-3 py-1 rounded-full text-sm';
const CHIP_ON = 'bg-blue-600 text-white';
const CHIP_OFF = 'bg-gray-100 text-gray-700 hover:bg-gray-200';

// Chip order is fixed: the existing two keep their place and the new two are appended
// (PLAN 2609_27 D3 — moving 고객명 would silently change what an existing user's first search means).
const SEARCH_FIELDS: ReadonlyArray<{ value: OrderSearchField; label: string }> = [
  { value: 'customer', label: '고객명' },
  { value: 'orderNo', label: '주문번호' },
  { value: 'product', label: '상품명' },
  { value: 'all', label: '전체' },
];

// One map instead of nested ternaries (PLAN 2609_27 D8).
const SEARCH_PLACEHOLDER: Record<OrderSearchField, string> = {
  customer: '고객명 검색 (주문자·수취인)',
  orderNo: '주문번호 검색',
  product: '상품명 검색',
  all: '고객명·주문번호·상품명 검색',
};

export function OrderSearchInput({
  searchField,
  onSearchFieldChange,
  searchTerm,
  onSearchTermChange,
}: OrderSearchInputProps) {
  return (
    /* No <form>: Enter would reload the page, and filtering happens as you type. */
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">검색</label>
      <div className="flex items-center gap-2 mb-2 flex-wrap">
        {SEARCH_FIELDS.map(({ value, label }) => (
          <button
            key={value}
            type="button"
            onClick={() => onSearchFieldChange(value)}
            className={`${CHIP_BASE} ${searchField === value ? CHIP_ON : CHIP_OFF}`}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="relative">
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => onSearchTermChange(e.target.value)}
          placeholder={SEARCH_PLACEHOLDER[searchField]}
          className="w-full px-4 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
        />
        {searchTerm && (
          <button
            type="button"
            onClick={() => onSearchTermChange('')}
            aria-label="검색어 지우기"
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            <X size={16} />
          </button>
        )}
      </div>
    </div>
  );
}
