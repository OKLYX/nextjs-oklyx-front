'use client';

import type { ChannelSales } from '@/domain/entities/SalesSummary';
import {
  PROFIT_PENDING_HINT,
  channelLabel,
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
          <th className="px-3 py-2 text-right font-medium">순이익(추정)</th>
          <th className="px-3 py-2 text-right font-medium">
            받을 돈
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
            <td
              className="px-3 py-2 text-right text-gray-900"
              title={channel.costBasisReady ? undefined : PROFIT_PENDING_HINT}
            >
              {formatProfit(channel)}
            </td>
            <td className="px-3 py-2 text-right text-gray-900">{formatMoney(channel.pendingPayout)}</td>
            <td className="px-3 py-2 text-right text-gray-900">{formatMoney(channel.paidAmount)}</td>
            <td className="px-3 py-2">
              {channel.unreconciledPayouts > 0 ? (
                <span className="text-orange-600">⚠ 미대사 {channel.unreconciledPayouts}</span>
              ) : (
                <span className="text-green-700">✅ 대사완료</span>
              )}
              {channel.amountOnlyPayouts > 0 && (
                // 라인 없이 금액만 있는 묶음은 정상이다(D5-5) — 미대사와 섞어 보이면 오해한다.
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
