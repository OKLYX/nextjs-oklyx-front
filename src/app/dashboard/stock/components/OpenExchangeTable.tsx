'use client';

import { CLAIM_STATUS_LABEL, type ClaimStatus } from '@/domain/entities/ClaimEntity';
import type { ClaimWork } from '@/domain/entities/StockWorkEntity';
import { salesChannelLabel } from '@/domain/entities/OrderEntity';
import { NameText } from '@/presentation/components/NameText';

/**
 * 「보낼 교환」 — exchange claims not fully shipped yet (FEATURE_2611_34 D42 · R8 · R19).
 *
 * **Purpose**: pick one exchange claim to ship; the row already carries its `items`, so picking needs no request.
 * **File**: `src/app/dashboard/stock/components/OpenExchangeTable.tsx`
 * **Used by**: `ClaimWorkPanel` — 「출고 작업」 「교환 발송」.
 *
 * **Example**:
 * ```tsx
 * <OpenExchangeTable claims={exchanges} isLoading={isListLoading} onPick={(claim) => openClaims([claim])} />
 * ```
 *
 * ⚠️ Props only — it calls no server. Rows keep the server order (newest received first).
 * ❌ Do not filter by `claimStatus` here — the server already chose the rows (D42).
 */
export interface OpenExchangeTableProps {
  claims: ClaimWork[];
  isLoading: boolean;
  onPick: (claim: ClaimWork) => void;
}

const TH_CLASS = 'px-4 py-2 text-left text-sm font-semibold text-gray-900';
const TD_CLASS = 'px-4 py-2 text-sm text-gray-700';

export function OpenExchangeTable({ claims, isLoading, onPick }: OpenExchangeTableProps) {
  return (
    <div className="bg-white rounded-lg shadow p-4 space-y-3">
      <h2 className="text-base font-semibold text-gray-900">보낼 교환</h2>
      {isLoading ? (
        <p className="text-sm text-gray-500">불러오는 중...</p>
      ) : claims.length === 0 ? (
        <p className="text-sm text-gray-500">보낼 교환이 없습니다.</p>
      ) : (
        <div className="list-table-scroll">
          <table className="w-full">
            <thead className="bg-gray-100 border-b border-gray-200">
              <tr>
                <th className={TH_CLASS}>접수일</th>
                <th className={TH_CLASS}>주문번호</th>
                <th className={TH_CLASS}>판매처</th>
                <th className={TH_CLASS}>상품</th>
                <th className="px-4 py-2 text-right text-sm font-semibold text-gray-900">교환 수량</th>
                <th className={TH_CLASS}>상태</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {claims.map((claim) => (
                <tr key={claim.orderClaimId} className="hover:bg-gray-50">
                  <td className={TD_CLASS}>{claim.receivedAt.slice(0, 10)}</td>
                  <td className={TD_CLASS}>{claim.externalOrderId}</td>
                  <td className={TD_CLASS}>{salesChannelLabel(claim.platform, claim.accountAlias)}</td>
                  <td className={TD_CLASS}>
                    <NameText kind="product" name={claim.itemName} inTable expandable />
                  </td>
                  <td className="px-4 py-2 text-sm text-gray-700 text-right">{claim.claimQty}</td>
                  <td className={TD_CLASS}>
                    {CLAIM_STATUS_LABEL[claim.claimStatus as ClaimStatus] ?? claim.claimStatus}
                  </td>
                  <td className="px-4 py-2 text-right">
                    <button
                      type="button"
                      onClick={() => onPick(claim)}
                      className="px-3 py-1 text-xs border border-gray-300 rounded hover:bg-gray-100"
                    >
                      고르기
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
