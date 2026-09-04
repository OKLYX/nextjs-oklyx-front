'use client';

import { X } from 'lucide-react';
import type { Seller } from '@/domain/entities/SellerEntity';
import type { OrderSearchField } from '@/domain/entities/OrderEntity';
import type { OrderPeriodOption } from '@/domain/entities/OrderPeriod';

/**
 * 채널(계정) 셀렉트 옵션. 출고관리 필터 카드도 같은 shape 을 쓴다.
 *
 * `syncable = false` = 조회는 되지만 동기화 대상이 아닌 채널(비활성 계정) — 주문내역은 이력
 * 조회라 목록에만 남은 계정도 옵션에 노출한다(PLAN 2609_15 D7-a).
 */
export interface ChannelOption {
  accountId: number;
  label: string;
  syncable: boolean;
}

/**
 * 채널 옵션 라벨. 별칭이 없으면 `채널 #{id}` 로 떨어진다.
 *
 * ⚠️ `??` 가 아니라 공백 판정이다 — 서버는 별칭 미설정을 `null` 이 아니라 **빈 문자열**로 주고,
 * `??` 만 쓰면 선택할 수 없는 빈 옵션이 그려진다(2026-09-04 dev 실측).
 */
export function channelOptionLabel(accountId: number, accountAlias: string | null): string {
  return accountAlias?.trim() ? accountAlias : `채널 #${accountId}`;
}

interface OrderSearchCardProps {
  sellers: Seller[];
  selectedSellerId: number | '';
  onSellerChange: (value: number | '') => void;
  onSearch: () => void;
  onSync: () => void;
  isLoading: boolean;
  isSyncing: boolean;
  resultCount: number;
  lastSyncedAt: string | null;
  channelOptions: ChannelOption[];
  selectedAccountId: number | '';
  onAccountChange: (value: number | '') => void;
  /** 있으면 [동기화] 를 비활성하고 그 사유를 보여준다(비활성 채널 선택 등). */
  syncDisabledReason?: string;
  periodOptions: OrderPeriodOption[];
  selectedPeriod: string;
  onPeriodChange: (value: string) => void;
  searchField: OrderSearchField;
  onSearchFieldChange: (field: OrderSearchField) => void;
  searchTerm: string;
  onSearchTermChange: (value: string) => void;
  /** The container decides this from the period the list actually holds — the card never judges. */
  showStaleNotice: boolean;
}

const CHIP_BASE = 'px-3 py-1 rounded-full text-sm';
const CHIP_ON = 'bg-blue-600 text-white';
const CHIP_OFF = 'bg-gray-100 text-gray-700 hover:bg-gray-200';

function formatSyncedAt(value: string | null): string {
  if (!value) return '동기화 기록 없음';
  const date = new Date(value);
  if (isNaN(date.getTime())) return '동기화 기록 없음';
  return date.toLocaleString('ko-KR');
}

export function OrderSearchCard({
  sellers,
  selectedSellerId,
  onSellerChange,
  onSearch,
  onSync,
  isLoading,
  isSyncing,
  resultCount,
  lastSyncedAt,
  channelOptions,
  selectedAccountId,
  onAccountChange,
  syncDisabledReason,
  periodOptions,
  selectedPeriod,
  onPeriodChange,
  searchField,
  onSearchFieldChange,
  searchTerm,
  onSearchTermChange,
  showStaleNotice,
}: OrderSearchCardProps) {
  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-semibold text-gray-900">주문내역</h2>
        <p className="text-sm text-gray-500">
          마지막 동기화: <span className="font-medium text-gray-700">{formatSyncedAt(lastSyncedAt)}</span>
        </p>
      </div>

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
          </div>
        </div>

        {/* No <form>: Enter would reload the page, and filtering happens as you type. */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">검색</label>
          <div className="flex items-center gap-2 mb-2">
            <button
              type="button"
              onClick={() => onSearchFieldChange('customer')}
              className={`${CHIP_BASE} ${searchField === 'customer' ? CHIP_ON : CHIP_OFF}`}
            >
              고객명
            </button>
            <button
              type="button"
              onClick={() => onSearchFieldChange('orderNo')}
              className={`${CHIP_BASE} ${searchField === 'orderNo' ? CHIP_ON : CHIP_OFF}`}
            >
              주문번호
            </button>
          </div>
          <div className="relative">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => onSearchTermChange(e.target.value)}
              placeholder={searchField === 'orderNo' ? '주문번호 검색' : '고객명 검색 (주문자·수취인)'}
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

        {showStaleNotice && (
          <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-4 py-2">
            최근 2주 이전 주문은 배송 상태가 최신이 아닐 수 있습니다 (동기화해도 갱신되지 않습니다).
          </p>
        )}

        <div className="flex items-center justify-between">
          <div>
            {resultCount > 0 && (
              <p className="text-sm text-gray-600">{resultCount}개의 결과</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            {syncDisabledReason && (
              <p className="text-xs text-gray-500">{syncDisabledReason}</p>
            )}
            <button
              onClick={onSync}
              disabled={isSyncing || syncDisabledReason != null}
              title={syncDisabledReason}
              className="px-6 py-2 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 transition-colors disabled:bg-green-400 disabled:cursor-not-allowed"
            >
              {isSyncing ? '동기화 중...' : '동기화'}
            </button>
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
    </div>
  );
}
