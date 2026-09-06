'use client';

import { X } from 'lucide-react';
import type { Seller } from '@/domain/entities/SellerEntity';
import type { OrderPeriodOption } from '@/domain/entities/OrderPeriod';
import type { ChannelOption } from '@/app/dashboard/orders/components/OrderSearchCard';

/**
 * 고객문의 조회 조건 카드 — `ClaimSearchCard` + `OrderSearchCard` 의 채널 select 를 합친 형태다.
 *
 * ❌ 동기화 버튼을 두지 않는다: 문의는 주문 동기화 회차에 얹혀 적재된다(D12). 별도 트리거를 만들면
 * 계정 단위 진행/결과 UX 가 두 벌이 된다.
 */
interface InquirySearchCardProps {
  channelOptions: ChannelOption[];
  selectedAccountId: number | '';
  onAccountChange: (value: number | '') => void;
  sellers: Seller[];
  selectedSellerId: number | '';
  onSellerChange: (value: number | '') => void;
  periodOptions: OrderPeriodOption[];
  selectedPeriod: string;
  onPeriodChange: (value: string) => void;
  searchTerm: string;
  onSearchTermChange: (value: string) => void;
  onSearch: () => void;
  isLoading: boolean;
  resultCount: number;
}

export function InquirySearchCard({
  channelOptions,
  selectedAccountId,
  onAccountChange,
  sellers,
  selectedSellerId,
  onSellerChange,
  periodOptions,
  selectedPeriod,
  onPeriodChange,
  searchTerm,
  onSearchTermChange,
  onSearch,
  isLoading,
  resultCount,
}: InquirySearchCardProps) {
  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-semibold text-gray-900">고객문의</h2>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">채널</label>
          <div className="flex items-center gap-2">
            <select
              value={selectedAccountId}
              onChange={(e) => onAccountChange(e.target.value === '' ? '' : Number(e.target.value))}
              aria-label="채널"
              className="w-48 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
            >
              <option value="">전체 채널</option>
              {channelOptions.map((option) => (
                <option key={option.accountId} value={option.accountId}>
                  {option.label}
                </option>
              ))}
            </select>
            <select
              value={selectedSellerId}
              onChange={(e) => onSellerChange(e.target.value === '' ? '' : Number(e.target.value))}
              aria-label="판매자"
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
            >
              <option value="">전체</option>
              {sellers.map((seller) => (
                <option key={seller.id} value={seller.id}>
                  {seller.sellerName}
                </option>
              ))}
            </select>
            <select
              value={selectedPeriod}
              onChange={(e) => onPeriodChange(e.target.value)}
              aria-label="기간"
              className="w-40 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
            >
              {periodOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* No <form>: Enter would reload the page. The search runs on [조회] only. */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">검색</label>
          <div className="relative">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => onSearchTermChange(e.target.value)}
              placeholder="문의 내용 · 상품명 · 주문번호"
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

        <div className="flex items-center justify-between">
          <div>
            {resultCount > 0 && <p className="text-sm text-gray-600">{resultCount}개의 결과</p>}
          </div>
          <button
            onClick={onSearch}
            disabled={isLoading}
            className="px-6 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors disabled:bg-blue-400 disabled:cursor-not-allowed"
          >
            {isLoading ? '조회 중...' : '조회'}
          </button>
        </div>
      </div>
    </div>
  );
}
