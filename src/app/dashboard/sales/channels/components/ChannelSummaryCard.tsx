'use client';

import type { ChannelSales } from '@/domain/entities/SalesSummary';
import {
  PROFIT_PENDING_HINT,
  SETTLEMENT_PENDING_HINT,
  fixedCostHintFor,
  formatFixedCost,
  formatMoney,
  formatProfit,
} from '@/domain/entities/SalesSummary';

/**
 * Period totals of <b>one</b> selected channel (FEATURE_2609_34).
 *
 * 🔴 <b>「정산 추정 금액」 sits right after 「순이익(추정)」</b> — it is on the sale-date axis like the other totals
 * here (FEATURE_2611_05 D3 · D11 · D14). 「지급확정」 (cash basis) is still <b>not</b> shown here: next to sale-date
 * totals it would be read as part of them. Payouts belong to the combined sales view and the settlement screen.
 *
 * 🔴 <b>Draw the server's values as they are.</b> Do not build them by adding up the sales / order lists below —
 * once the screen starts re-adding, the same channel shows different numbers on different screens and nobody
 * knows which one is right.
 *
 * ⚠️ Display only.
 */
interface ChannelSummaryCardProps {
  channel: ChannelSales;
}

export function ChannelSummaryCard({ channel }: ChannelSummaryCardProps) {
  const cells: { label: string; value: string; hint?: string }[] = [
    { label: '판매수량', value: channel.netQty.toLocaleString('ko-KR') },
    { label: '매출액', value: formatMoney(channel.grossSales) },
    { label: '할인', value: formatMoney(channel.discount) },
    { label: '수수료(추정)', value: formatMoney(channel.estFee) },
    { label: '고정비', value: formatFixedCost(channel.fixedCost), hint: fixedCostHintFor(channel.platform) },
    {
      label: '순이익(추정)',
      value: formatProfit(channel),
      hint: channel.costBasisReady ? undefined : PROFIT_PENDING_HINT,
    },
    {
      label: '정산 추정 금액',
      value: formatMoney(channel.estSettlement),
      hint: channel.estSettlement == null ? SETTLEMENT_PENDING_HINT : undefined,
    },
    {
      label: '취소수량',
      // ⚠️ 백엔드가 먼저 배포되지 않은 순간에도 화면이 죽지 않게 — `formatMoney` 는 이미 null 을 받는다.
      value: (channel.cancelQty ?? 0).toLocaleString('ko-KR'),
      hint: '취소가 확정된 수량입니다. 매출액에서는 이미 빠져 있습니다',
    },
    {
      label: '환불완료 금액',
      value: formatMoney(channel.refundedAmount),
      hint: '취소 확정으로 매출에서 빠진 금액입니다',
    },
    {
      label: '환불대기 금액',
      value: formatMoney(channel.pendingRefundAmount),
      hint: '아직 매출에 남아 있지만, 취소가 확정되면 빠질 금액입니다',
    },
  ];

  return (
    <div className="bg-white rounded-lg shadow px-6 py-4">
      <dl className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-4">
        {cells.map((cell) => (
          <div key={cell.label} title={cell.hint}>
            <dt className="text-xs text-gray-500">{cell.label}</dt>
            <dd className="text-lg font-semibold text-gray-900 tabular-nums">{cell.value}</dd>
          </div>
        ))}
      </dl>
      {channel.holdQty > 0 && (
        // 환불대기는 유효수량에서 빼지 않는다(D14) — 빼면 확정될 때마다 매출이 출렁인다.
        <p className="mt-3 text-xs text-gray-500">
          환불대기 {channel.holdQty.toLocaleString('ko-KR')}개는 아직 확정이 아니라 매출액에 남아
          있습니다.
        </p>
      )}
    </div>
  );
}
