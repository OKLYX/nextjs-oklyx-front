'use client';

import { X } from 'lucide-react';
import type { Seller } from '@/domain/entities/SellerEntity';
import type { OrderPeriodOption } from '@/domain/entities/OrderPeriod';
import { Card } from '@/presentation/components/ui/Card';
import { Button } from '@/presentation/components/ui/Button';

/**
 * 반품/교환 조회 조건 카드. `OrderSearchCard` 에서 채널 select 를 뺀 형태다 — 클레임 목록에는
 * 채널 축이 없다(조회 조건은 판매자·기간·검색어뿐).
 *
 * ⚠️ [동기화] 는 **반품·교환만** 다시 가져온다(FEATURE_2609_70 / D14). 2609_18 의 "클레임은 주문
 * 동기화에 얹혀 적재되므로 별도 동기화 트리거가 없다" 를 의도적으로 뒤집었다 — 반품만 보려고
 * 주문 전체를 돌릴 이유가 없고, 지금 보는 목록이 언제 것인지도 알 수 없었다. 채널 단위 진행/결과는
 * 주문내역·고객문의와 같은 훅·같은 모달을 쓰므로 UX 가 여러 벌이 되지 않는다.
 */
interface ClaimSearchCardProps {
  sellers: Seller[];
  selectedSellerId: number | '';
  onSellerChange: (value: number | '') => void;
  periodOptions: OrderPeriodOption[];
  selectedPeriod: string;
  onPeriodChange: (value: string) => void;
  searchTerm: string;
  onSearchTermChange: (value: string) => void;
  onSearch: () => void;
  /** 반품·교환만 다시 가져오기. 채널 루프·진행 모달은 컨테이너가 소유한다. */
  onSync: () => void;
  isLoading: boolean;
  isSyncing: boolean;
  /** 있으면 [동기화] 를 비활성하고 그 사유를 보여준다(가져올 채널이 없을 때 등). */
  syncDisabledReason?: string;
  resultCount: number;
}

export function ClaimSearchCard({
  sellers,
  selectedSellerId,
  onSellerChange,
  periodOptions,
  selectedPeriod,
  onPeriodChange,
  searchTerm,
  onSearchTermChange,
  onSearch,
  onSync,
  isLoading,
  isSyncing,
  syncDisabledReason,
  resultCount,
}: ClaimSearchCardProps) {
  return (
    <Card>
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">판매자</label>
          <div className="flex items-center gap-2">
            <select
              value={selectedSellerId}
              onChange={(e) => onSellerChange(e.target.value === '' ? '' : Number(e.target.value))}
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
              placeholder="주문번호 · 고객명 · 상품명"
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
            {resultCount > 0 && (
              <p className="text-sm text-gray-600">{resultCount}개의 결과</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            {syncDisabledReason && <p className="text-xs text-gray-500">{syncDisabledReason}</p>}
            <button
              onClick={onSync}
              disabled={isSyncing || syncDisabledReason != null}
              title={syncDisabledReason}
              className="px-6 py-2 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 transition-colors disabled:bg-green-400 disabled:cursor-not-allowed"
            >
              {isSyncing ? '동기화 중...' : '동기화'}
            </button>
            <Button
              onClick={onSearch}
              disabled={isLoading}
            >
              {isLoading ? '조회 중...' : '조회'}
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
}
