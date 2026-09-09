'use client';

import { RefreshCw } from 'lucide-react';

// 🔴 판매자 드롭다운과 [재적재] 버튼은 없앴다(PLAN 2609_29 D11·D12).
// 조회·동기화는 항상 전체이고, [주문내역 동기화] 가 이미 동기화→재추출을 함께 한다.
interface PurchaseListToolbarProps {
  onAddManualClick: () => void;
  onSyncOrders: () => void;
  isSyncingOrders: boolean;
}

export function PurchaseListToolbar({
  onAddManualClick,
  onSyncOrders,
  isSyncingOrders,
}: PurchaseListToolbarProps) {
  return (
    <div className="bg-white rounded-lg shadow px-6 py-4 flex flex-wrap items-center gap-3">
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
      </div>
    </div>
  );
}
