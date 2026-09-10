'use client';

import { Fragment } from 'react';
import type { ChannelSales } from '@/domain/entities/SalesSummary';
import type { PayoutSummary } from '@/domain/entities/Settlement';
import {
  FIXED_COST_HINT,
  PROFIT_PENDING_HINT,
  channelLabel,
  formatFixedCost,
  formatMoney,
  formatProfit,
} from '@/domain/entities/SalesSummary';
import { ChannelPayoutList } from './ChannelPayoutList';

interface SellerChannelRowsProps {
  channels: ChannelSales[];
  isLoading: boolean;
  error: string;
  /** 이 판매자의 <b>모든</b> 채널 정산 — 채널별 분배는 여기서 한다(요청은 판매자당 1회다). */
  payouts: PayoutSummary[];
  payoutsLoading: boolean;
  payoutsError: string;
  /** 정산 <b>목록</b> 화면(채널 필터). 건별 이동은 `onOpenPayout` 이다. */
  onOpenSettlement: (accountId: number) => void;
  /** 정산 <b>상세</b> 화면(건별). */
  onOpenPayout: (payoutId: number) => void;
}

// 🔴 열을 추가하면 이 수를 같이 올린다 — 채널마다 붙는 정산 목록 행의 `colSpan` 이 이 값을 먹는다.
const COLUMN_COUNT = 8;

/**
 * 판매자 행을 펼쳤을 때 나오는 채널 표 (FEATURE_2609_30 / 04 Step 3).
 *
 * 🔴 <b>지급확정(현금주의)은 여기에만 있다</b>(PLAN D4-1). 판매자 행으로 올리지 않는다 —
 * 채널마다 정산 주기(WEEKLY/MONTHLY/…)가 달라 합산하면 뜻을 잃는다.
 *
 * 🔴 <b>고정비는 이미 순이익에서 빠져 있다</b>(PLAN 2609_33 D6 · D7) — 여기서 다시 빼지 않는다.
 * 부과 여부 판정은 서버 몫이다(D2). 매출과 임계를 화면에서 비교하지 말 것.
 *
 * 🔴 <b>대사 상태 배지("금액 차이 N" · "금액 일치")를 이 표에 다시 넣지 말 것</b>(FEATURE_2609_34).
 * 그 건수는 기간이 걸리지 않는 채널 전체 집계라, 기간 행 옆에 두면 이 기간의 결과로 읽힌다.
 * 대사 상태는 아래 정산 목록이 건별로 보여준다 — 거기서는 어느 달 것인지도 함께 보인다.
 *
 * ⚠️ 표시 전용이다. 조회·상태 변경을 이 안에서 하지 않는다.
 */
export function SellerChannelRows({
  channels,
  isLoading,
  error,
  payouts,
  payoutsLoading,
  payoutsError,
  onOpenSettlement,
  onOpenPayout,
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
          <th className="px-3 py-2" />
        </tr>
      </thead>
      <tbody className="divide-y divide-gray-200">
        {channels.map((channel) => (
          <Fragment key={channel.accountId}>
          <tr>
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
          {/* 🔴 이 기간 매출에 대한 정산을 건별로 편다(FEATURE_2609_34). 합계 배지 하나로 뭉치면
              "13건이 어긋났다"로 읽히지만 실제로는 그 채널의 정산 전건이었다 — 건별 링크가 그 오해를 막는다. */}
          <tr>
            <td colSpan={COLUMN_COUNT} className="px-3 pb-3 pt-0 text-xs">
              <div className="ml-4 border-l border-gray-200 pl-3">
                <ChannelPayoutList
                  payouts={payouts.filter((payout) => payout.accountId === channel.accountId)}
                  isLoading={payoutsLoading}
                  error={payoutsError}
                  onOpen={onOpenPayout}
                />
              </div>
            </td>
          </tr>
          </Fragment>
        ))}
      </tbody>
    </table>
  );
}
