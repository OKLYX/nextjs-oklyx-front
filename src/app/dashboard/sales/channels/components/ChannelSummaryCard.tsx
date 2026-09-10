'use client';

import type { ChannelSales } from '@/domain/entities/SalesSummary';
import {
  FIXED_COST_HINT,
  PROFIT_PENDING_HINT,
  formatFixedCost,
  formatMoney,
  formatProfit,
} from '@/domain/entities/SalesSummary';

/**
 * 선택한 채널 <b>한 개</b>의 기간 합계 (FEATURE_2609_34).
 *
 * 🔴 <b>정산 금액(정산 추정·지급확정)은 싣지 않는다.</b> 여기는 매출 화면이고 그 둘은 매출인식월·현금주의
 * 축이라, 판매일 합계 옆에 두면 반드시 빼 보게 된다. 정산은 통합 매출과 정산 화면이 다룬다.
 *
 * 🔴 <b>서버가 계산한 값을 그대로 그린다.</b> 아래 매출 내역·판매 내역을 더해서 만들지 않는다 — 화면에서
 * 다시 더하기 시작하면 같은 채널의 숫자가 화면마다 달라지고, 어느 쪽이 맞는지 아무도 모르게 된다.
 *
 * ⚠️ 표시 전용이다.
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
    { label: '고정비', value: formatFixedCost(channel.fixedCost), hint: FIXED_COST_HINT },
    {
      label: '순이익(추정)',
      value: formatProfit(channel),
      hint: channel.costBasisReady ? undefined : PROFIT_PENDING_HINT,
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
