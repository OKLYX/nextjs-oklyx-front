'use client';

import { RefreshCw } from 'lucide-react';
import type { Seller } from '@/domain/entities/SellerEntity';

interface PurchaseListToolbarProps {
  sellers: Seller[];
  sellerId: number | null;
  onSellerChange: (sellerId: number | null) => void;
  onExtract: () => void;
  isExtracting: boolean;
  onAddManualClick: () => void;
  onSyncOrders: () => void;
  isSyncingOrders: boolean;
}

export function PurchaseListToolbar({
  sellers,
  sellerId,
  onSellerChange,
  onExtract,
  isExtracting,
  onAddManualClick,
  onSyncOrders,
  isSyncingOrders,
}: PurchaseListToolbarProps) {
  return (
    <div className="bg-white rounded-lg shadow px-6 py-4 flex flex-wrap items-center gap-3">
      <div className="flex items-center gap-2">
        <label className="text-sm font-medium text-gray-700">판매자</label>
        <select
          value={sellerId ?? ''}
          onChange={(e) => onSellerChange(e.target.value ? Number(e.target.value) : null)}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">전체</option>
          {sellers.map((seller) => (
            <option key={seller.id} value={seller.id}>
              {seller.sellerName}
            </option>
          ))}
        </select>
      </div>

      {/* 재고 고려: 준비 중(미구현) — 노출만, 비활성 */}
      <label className="flex items-center gap-2 text-sm text-gray-400 cursor-not-allowed">
        <input type="checkbox" disabled className="cursor-not-allowed" />
        재고 고려 <span className="text-xs">(준비 중)</span>
      </label>

      <div className="ml-auto flex items-center gap-2">
        {/* 주문내역 동기화: 마켓플레이스에서 최신 주문을 가져온 뒤 구매목록을 재구성 */}
        <button
          onClick={onSyncOrders}
          disabled={isSyncingOrders}
          title="주문내역 동기화"
          className="flex items-center gap-1.5 px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <RefreshCw size={16} className={isSyncingOrders ? 'animate-spin' : ''} />
          {isSyncingOrders ? '동기화 중...' : '주문내역 동기화'}
        </button>
        <button
          onClick={onAddManualClick}
          className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-100"
        >
          수동 추가
        </button>
        <button
          onClick={onExtract}
          disabled={isExtracting}
          className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400"
        >
          {isExtracting ? '동기화 중...' : '동기화'}
        </button>
      </div>
    </div>
  );
}
