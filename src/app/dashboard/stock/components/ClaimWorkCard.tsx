'use client';

import {
  CLAIM_STATUS_LABEL,
  CLAIM_TYPE_LABEL,
  collectStatusText,
  type ClaimStatus,
} from '@/domain/entities/ClaimEntity';
import { salesChannelLabel } from '@/domain/entities/OrderEntity';
import {
  CLAIM_WORK_TEXT,
  claimItemKey,
  type ClaimWork,
  type ClaimWorkKind,
} from '@/domain/entities/StockWorkEntity';
import { StockProductThumb } from '@/app/dashboard/stock/components/StockProductThumb';
import { NameText } from '@/presentation/components/NameText';

/**
 * One opened claim of the claim work tabs (FEATURE_2611_34 D19 · D20 · D31 · R15).
 *
 * **Purpose**: the claim head (type · order number · sales channel · seller · requester · status · collect status +
 * the claim's item name) and, below, one row per product with the entered quantity input.
 * **File**: `src/app/dashboard/stock/components/ClaimWorkCard.tsx`
 * **Used by**: `ClaimWorkPanel` — 「입고 작업」 「반품 재입고」 and 「출고 작업」 「교환 발송」.
 *
 * **Example**:
 * ```tsx
 * <ClaimWorkCard claim={claim} kind="RETURN_IN" entered={entered} onChangeEntered={changeEntered} />
 * ```
 *
 * ⚠️ Props only — it calls no server. The entered values live in the panel, keyed by `claimItemKey`.
 * ⚠️ A claim with `failure` shows the kind's 「unknown items」 words only, no table (D31 · R27).
 * ❌ Do not build the head words by hand — the labels come from `CLAIM_TYPE_LABEL` · `salesChannelLabel` ·
 *   `CLAIM_STATUS_LABEL` · `collectStatusText` (R15).
 */
export interface ClaimWorkCardProps {
  claim: ClaimWork;
  kind: ClaimWorkKind;
  entered: Record<string, string>;
  onChangeEntered: (key: string, value: string) => void;
}

const TH_CLASS = 'px-3 py-2 text-left text-sm font-semibold text-gray-900';
const TH_NUM_CLASS = 'px-3 py-2 text-right text-sm font-semibold text-gray-900';
const TD_CLASS = 'px-3 py-2 text-sm text-gray-700';
const TD_NUM_CLASS = 'px-3 py-2 text-sm text-gray-700 text-right';

export function ClaimWorkCard(props: ClaimWorkCardProps) {
  const { claim, kind, entered, onChangeEntered } = props;
  const text = CLAIM_WORK_TEXT[kind];
  const head = [
    CLAIM_TYPE_LABEL[claim.claimType],
    claim.externalOrderId,
    salesChannelLabel(claim.platform, claim.accountAlias),
    `판매자 ${claim.sellerName ?? '-'}`,
    `요청자 ${claim.requesterName ?? '-'}`,
    `상태 ${CLAIM_STATUS_LABEL[claim.claimStatus as ClaimStatus] ?? claim.claimStatus}`,
    `회수 ${collectStatusText(claim.collectStatus)}`,
  ].join(' · ');

  return (
    <div className="bg-white rounded-lg shadow p-4 space-y-3">
      <div className="space-y-1">
        <p className="text-sm font-medium text-gray-900">{head}</p>
        <NameText kind="product" name={claim.itemName} expandable className="text-sm text-gray-700" />
      </div>
      {claim.failure !== null ? (
        <p className="text-sm text-amber-700">{text.unknownItems}</p>
      ) : (
        <div className="list-table-scroll">
          <table className="w-full">
            <thead className="bg-gray-100 border-b border-gray-200">
              <tr>
                <th className={TH_CLASS}>물건</th>
                <th className={TH_CLASS}>바코드</th>
                <th className={TH_NUM_CLASS}>{text.requiredHeader}</th>
                <th className={TH_NUM_CLASS}>{text.doneHeader}</th>
                <th className={TH_NUM_CLASS}>남은 수량</th>
                <th className={TH_NUM_CLASS}>{text.enteredHeader}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {claim.items.map((item) => {
                const key = claimItemKey(claim.orderClaimId, item.productId);
                return (
                  <tr key={key}>
                    <td className={TD_CLASS}>
                      <div className="flex items-center gap-2">
                        <StockProductThumb imageUrl={item.imageUrl} productId={item.productId} alt={item.productName} />
                        <NameText kind="product" name={item.productName} inTable expandable />
                      </div>
                    </td>
                    <td className={TD_CLASS}>{item.barcode ?? '-'}</td>
                    <td className={TD_NUM_CLASS}>{item.requiredQty}</td>
                    <td className={TD_NUM_CLASS}>{item.doneQty}</td>
                    <td className={TD_NUM_CLASS}>{item.remainingQty}</td>
                    <td className={TD_NUM_CLASS}>
                      <input
                        type="number"
                        min={0}
                        max={item.remainingQty}
                        value={entered[key] ?? '0'}
                        onChange={(e) => onChangeEntered(key, e.target.value)}
                        className="w-24 px-2 py-1 border border-gray-300 rounded text-sm text-right focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
