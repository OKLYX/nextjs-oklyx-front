'use client';

import type { Seller } from '@/domain/entities/SellerEntity';
import type { SettlementSyncTarget } from '@/domain/entities/Settlement';
import { platformLabel } from '@/domain/entities/Settlement';

/**
 * 지급 묶음 목록 필터 (FEATURE_2609_30 / 05 Step 2).
 *
 * **순수 controlled**: 값은 부모(`PayoutListContainer`)가 소유한다. 여기서 상태를 들지 않는다.
 *
 * ⚠️ 기간은 <b>지급일</b> 축이다(백엔드 `SettlementPayoutRepository.search`). 매출 화면의 판매일 기간과
 * 다른 축이라 두 화면의 숫자가 같아지지 않는다 — 라벨에 "지급일"을 반드시 남긴다.
 *
 * ⚠️ 채널 목록의 출처는 `/sync/targets` 다. 판매자를 고르면 그 판매자의 채널만 남기고, 이전 선택이
 * 목록에서 사라지면 부모가 채널 선택을 비운다.
 */
export interface PayoutFilterValue {
  sellerId: number | '';
  accountId: number | '';
  from: string;
  to: string;
}

interface PayoutFilterProps {
  value: PayoutFilterValue;
  sellers: Seller[];
  channels: SettlementSyncTarget[];
  disabled: boolean;
  onChange: (next: PayoutFilterValue) => void;
}

export function PayoutFilter({ value, sellers, channels, disabled, onChange }: PayoutFilterProps) {
  const patch = (partial: Partial<PayoutFilterValue>) => onChange({ ...value, ...partial });

  return (
    <div className="bg-white rounded-lg shadow px-6 py-4 flex flex-wrap items-end gap-3">
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-gray-700">판매자</label>
        <select
          value={value.sellerId}
          disabled={disabled}
          onChange={(e) => patch({ sellerId: e.target.value === '' ? '' : Number(e.target.value) })}
          className="w-44 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">전체</option>
          {sellers.map((seller) => (
            <option key={seller.id} value={seller.id}>
              {seller.sellerName}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-gray-700">채널</label>
        <select
          value={value.accountId}
          disabled={disabled}
          onChange={(e) => patch({ accountId: e.target.value === '' ? '' : Number(e.target.value) })}
          className="w-52 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">전체</option>
          {channels.map((channel) => (
            <option key={channel.accountId} value={channel.accountId}>
              {platformLabel(channel.platform)} ·{' '}
              {channel.accountAlias?.trim() ? channel.accountAlias : `채널 #${channel.accountId}`}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-gray-700">지급일 시작</label>
        <input
          type="date"
          value={value.from}
          max={value.to || undefined}
          disabled={disabled}
          onChange={(e) => patch({ from: e.target.value })}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-gray-700">지급일 종료</label>
        <input
          type="date"
          value={value.to}
          min={value.from || undefined}
          disabled={disabled}
          onChange={(e) => patch({ to: e.target.value })}
          className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {(value.from || value.to) && (
        <button
          type="button"
          disabled={disabled}
          onClick={() => patch({ from: '', to: '' })}
          className="px-3 py-2 text-sm rounded-lg border border-gray-300 bg-white text-gray-700 hover:bg-gray-100 disabled:opacity-50"
        >
          기간 해제
        </button>
      )}
    </div>
  );
}
