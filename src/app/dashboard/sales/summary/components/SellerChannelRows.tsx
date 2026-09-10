'use client';

import type { ChannelSales } from '@/domain/entities/SalesSummary';
import {
  FIXED_COST_HINT,
  PROFIT_PENDING_HINT,
  channelLabel,
  formatFixedCost,
  formatMoney,
  formatProfit,
} from '@/domain/entities/SalesSummary';

interface SellerChannelRowsProps {
  channels: ChannelSales[];
  isLoading: boolean;
  error: string;
  /** `05` 정산 화면으로 가는 유일한 진입점. */
  onOpenSettlement: (accountId: number) => void;
}

/**
 * 판매자 행을 펼쳤을 때 나오는 채널 표 (FEATURE_2609_30 / 04 Step 3).
 *
 * 🔴 <b>지급확정(현금주의)은 여기에만 있다</b>(PLAN D4-1). 판매자 행으로 올리지 않는다 —
 * 채널마다 정산 주기(WEEKLY/MONTHLY/…)가 달라 합산하면 뜻을 잃는다.
 *
 * 🔴 <b>고정비는 이미 순이익에서 빠져 있다</b>(PLAN 2609_33 D6 · D7) — 여기서 다시 빼지 않는다.
 * 부과 여부 판정은 서버 몫이다(D2). 매출과 임계를 화면에서 비교하지 말 것.
 *
 * ⚠️ 표시 전용이다. 조회·상태 변경을 이 안에서 하지 않는다.
 */
export function SellerChannelRows({
  channels,
  isLoading,
  error,
  onOpenSettlement,
}: SellerChannelRowsProps) {
  if (isLoading) {
    return (
      <div className="space-y-2 py-1">
        {[0, 1].map((row) => (
          <div key={row} className="h-6 bg-gray-200 rounded animate-pulse" />
        ))}
      </div>
    );
  }

  if (error) {
    return <div className="py-2 text-sm text-red-600">{error}</div>;
  }

  if (channels.length === 0) {
    return <div className="py-2 text-sm text-gray-500">이 판매자에게 연결된 판매채널이 없습니다.</div>;
  }

  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="text-gray-500">
          <th className="px-3 py-2 text-left font-medium">채널</th>
          <th className="px-3 py-2 text-right font-medium">매출액</th>
          <th className="px-3 py-2 text-right font-medium">할인</th>
          <th className="px-3 py-2 text-right font-medium" title={FIXED_COST_HINT}>
            고정비
          </th>
          <th className="px-3 py-2 text-right font-medium">순이익(추정)</th>
          <th className="px-3 py-2 text-right font-medium">
            정산 예정 금액
            <span className="block text-[11px] font-normal text-gray-400">기간 무관 · 미지급 잔액</span>
          </th>
          <th className="px-3 py-2 text-right font-medium">
            지급확정
            <span className="block text-[11px] font-normal text-gray-400">기간 내 입금</span>
          </th>
          <th className="px-3 py-2 text-left font-medium">상태</th>
          <th className="px-3 py-2" />
        </tr>
      </thead>
      <tbody className="divide-y divide-gray-200">
        {channels.map((channel) => (
          <tr key={channel.accountId}>
            <td className="px-3 py-2 text-gray-700">└ {channelLabel(channel)}</td>
            <td className="px-3 py-2 text-right text-gray-900">{formatMoney(channel.grossSales)}</td>
            <td className="px-3 py-2 text-right text-gray-500">{formatMoney(channel.discount)}</td>
            {/* 🔴 경고색을 쓰지 않는다 — 정상 비용이다. 순이익이 `—`(원가 미확정)여도 이 칸은 숫자다(D6). */}
            <td
              className="px-3 py-2 text-right text-gray-700"
              title={
                (channel.fixedCost ?? 0) > 0 ? `${channel.fixedCostMonths ?? 0}개월분` : undefined
              }
            >
              {formatFixedCost(channel.fixedCost)}
            </td>
            <td
              className="px-3 py-2 text-right text-gray-900"
              title={channel.costBasisReady ? undefined : PROFIT_PENDING_HINT}
            >
              {formatProfit(channel)}
            </td>
            <td className="px-3 py-2 text-right text-gray-900">{formatMoney(channel.pendingPayout)}</td>
            <td className="px-3 py-2 text-right text-gray-900">{formatMoney(channel.paidAmount)}</td>
            <td className="px-3 py-2">
              {/* 🔴 3분기다. `payoutCount === 0`(정산 이력 없음)을 초록으로 칠하지 말 것 —
                  아직 정산이 안 들어온 채널이 "금액이 다 맞았다"로 보인다. 정산 전이 훨씬 흔하다. */}
              {channel.payoutCount === 0 ? (
                <span className="text-gray-400">— 정산 이력 없음</span>
              ) : channel.unreconciledPayouts > 0 ? (
                <span className="text-orange-600">⚠ 금액 차이 {channel.unreconciledPayouts}</span>
              ) : (
                <span className="text-green-700">✅ 금액 일치</span>
              )}
              {channel.amountOnlyPayouts > 0 && (
                // 라인 없이 금액만 있는 묶음은 정상이다(D5-5) — 금액 차이와 섞어 보이면 오해한다.
                <span
                  className="ml-2 text-gray-500"
                  title="추가정산·유보금 등 판매 라인 없이 금액만 있는 지급 묶음입니다"
                >
                  금액만 {channel.amountOnlyPayouts}
                </span>
              )}
            </td>
            <td className="px-3 py-2 text-right">
              <button
                type="button"
                onClick={() => onOpenSettlement(channel.accountId)}
                className="text-blue-700 hover:underline"
              >
                정산 내역 →
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
