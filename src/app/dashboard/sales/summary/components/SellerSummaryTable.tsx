'use client';

import { Fragment } from 'react';
import type { ChannelSales, SellerSales } from '@/domain/entities/SalesSummary';
import type { PayoutSummary } from '@/domain/entities/Settlement';
import {
  FIXED_COST_HINT,
  PROFIT_PENDING_HINT,
  formatFixedCost,
  formatMoney,
  formatProfit,
} from '@/domain/entities/SalesSummary';
import { SellerChannelRows } from './SellerChannelRows';
import { Card } from '@/presentation/components/ui/Card';
import { TableCard } from '@/presentation/components/ui/TableCard';
import { Button } from '@/presentation/components/ui/Button';

interface SellerSummaryTableProps {
  rows: SellerSales[];
  loading: boolean;
  error: string;
  expandedSellerId: number | null;
  channels: ChannelSales[];
  channelsLoading: boolean;
  channelsError: string;
  /** 펼친 판매자의 정산 건(인식월 축). 채널별 분배는 `SellerChannelRows` 가 한다. */
  payouts: PayoutSummary[];
  payoutsLoading: boolean;
  payoutsError: string;
  onToggle: (sellerId: number) => void;
  onRetry: () => void;
  /** 채널 행 클릭 — 그 채널로 좁힌 채널별 매출 화면으로 간다. */
  onOpenChannel: (accountId: number) => void;
  /** 정산 건 클릭 — 그 지급 묶음 상세로 바로 간다. */
  onOpenPayout: (payoutId: number) => void;
}

// 🔴 열을 추가하면 이 수를 같이 올린다 — 빈 상태 행과 채널 펼침 블록의 `colSpan` 이 이 값을 먹는다.
const COLUMN_COUNT = 7;

/**
 * 판매자별 매출 표 (FEATURE_2609_30 / 04 Step 3). 한 행 = 판매자, 클릭하면 채널 행이 펼쳐진다.
 *
 * 🔴 <b>"정산 추정 금액" 헤더의 `기간 무관 · 미지급 잔액` 라벨을 지우지 말 것</b>(PLAN D4). 이 값만 기간
 * 필터를 따라 움직이지 않아서, 라벨이 없으면 사용자가 버그로 신고한다. 툴팁으로 대체 불가.
 *
 * 🔴 순이익이 없으면 `—` 다. 0 으로 그리면 "안 남았다"로 읽힌다 — 실제는 "아직 모른다"다(D15).
 *
 * 🔴 <b>대사 상태 배지를 이 표에 다시 넣지 말 것</b>(FEATURE_2609_34). 지급 묶음은 매출인식일 축이라
 * 기간을 바꿔도 건수가 안 변하는데, 기간 필터 옆에 있으면 "이번 달에 13건이 어긋났다"로 읽힌다.
 * 대사 상태는 판매자를 펼쳤을 때 나오는 인식월별 정산 목록이 건별로 보여준다.
 *
 * ⚠️ 표시 전용이다. 조회·펼침 상태는 Container 가 소유한다.
 */
export function SellerSummaryTable({
  rows,
  loading,
  error,
  expandedSellerId,
  channels,
  channelsLoading,
  channelsError,
  payouts,
  payoutsLoading,
  payoutsError,
  onToggle,
  onRetry,
  onOpenChannel,
  onOpenPayout,
}: SellerSummaryTableProps) {
  if (error) {
    return (
      <Card className="space-y-3">
        <p className="text-sm text-red-600">{error}</p>
        <Button
          type="button"
          onClick={onRetry}
        >
          다시 시도
        </Button>
      </Card>
    );
  }

  const totals = rows.reduce(
    (acc, row) => ({
      grossSales: acc.grossSales + row.grossSales,
      discount: acc.discount + row.discount,
      netQty: acc.netQty + row.netQty,
      // 고정비 합계는 `totalProfitReady` 와 무관하게 항상 숫자다 — 원가가 미확정이어도 나가는 돈은 안다(D6).
      fixedCost: acc.fixedCost + (row.fixedCost ?? 0),
      estNetProfit: acc.estNetProfit + (row.estNetProfit ?? 0),
      pendingPayout: acc.pendingPayout + row.pendingPayout,
    }),
    { grossSales: 0, discount: 0, netQty: 0, fixedCost: 0, estNetProfit: 0, pendingPayout: 0 }
  );
  // 한 행이라도 원가 스냅샷이 없으면 합계도 모르는 값이다 — 부분합을 총계처럼 보이면 안 된다.
  const totalProfitReady = rows.length > 0 && rows.every((row) => row.costBasisReady);

  return (
    // 첫 조회에만 로딩 블록. 기간을 바꾼 재조회는 이전 값을 지우지 않고 위에 로딩 줄만 띄운다(깜빡임 방지).
    <TableCard
      isLoading={loading && rows.length === 0}
      isEmpty={rows.length === 0}
      emptyMessage="해당 기간에 판매된 주문이 없습니다."
    >
      {loading && rows.length > 0 && (
        <div className="px-6 py-2 text-xs text-gray-500 bg-gray-50 border-b border-gray-200">
          조회 중...
        </div>
      )}
      <table className="w-full">
        <thead className="bg-gray-100 border-b border-gray-200">
          <tr>
            <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">판매자</th>
            <th className="px-6 py-3 text-right text-sm font-semibold text-gray-900">판매수량</th>
            <th className="px-6 py-3 text-right text-sm font-semibold text-gray-900">매출액</th>
            <th className="px-6 py-3 text-right text-sm font-semibold text-gray-900">할인</th>
            <th
              className="px-6 py-3 text-right text-sm font-semibold text-gray-900"
              title={FIXED_COST_HINT}
            >
              고정비
            </th>
            <th className="px-6 py-3 text-right text-sm font-semibold text-gray-900">
              순이익(추정)
            </th>
            <th className="px-6 py-3 text-right text-sm font-semibold text-gray-900">
              정산 추정 금액
              {/* 🔴 이 라벨이 없으면 "기간을 바꿨는데 값이 안 변한다"가 버그 신고로 온다(D4). */}
              <span className="block text-[11px] font-normal text-gray-500">
                기간 무관 · 미지급 잔액
              </span>
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {rows.map((row) => {
            const isExpanded = expandedSellerId === row.sellerId;
            return (
              <Fragment key={row.sellerId}>
                <tr
                  onClick={() => onToggle(row.sellerId)}
                  className="hover:bg-gray-50 cursor-pointer"
                >
                  <td className="px-6 py-3 text-sm text-gray-700">
                    {isExpanded ? '▾' : '▸'} {row.sellerName}
                  </td>
                  <td className="px-6 py-3 text-sm text-right text-gray-700">
                    {row.netQty.toLocaleString('ko-KR')}
                    {row.holdQty > 0 && (
                      // 환불대기는 유효수량에서 빼지 않는다(D14) — 빼면 확정될 때마다 매출이 출렁인다.
                      <span
                        className="ml-1 text-xs text-gray-500"
                        title="환불대기 수량입니다. 아직 확정이 아니라 매출에서 빼지 않았습니다"
                      >
                        (대기 {row.holdQty})
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-3 text-sm text-right font-semibold text-gray-900">
                    {formatMoney(row.grossSales)}
                  </td>
                  <td className="px-6 py-3 text-sm text-right text-gray-500">
                    {formatMoney(row.discount)}
                  </td>
                  {/* 🔴 서버가 준 판매자 행의 값이다 — 채널 값을 화면에서 더하지 않는다(D7). */}
                  <td className="px-6 py-3 text-sm text-right text-gray-700">
                    {formatFixedCost(row.fixedCost)}
                  </td>
                  <td
                    className="px-6 py-3 text-sm text-right text-gray-900"
                    title={row.costBasisReady ? undefined : PROFIT_PENDING_HINT}
                  >
                    {formatProfit(row)}
                  </td>
                  <td className="px-6 py-3 text-sm text-right text-gray-900">
                    {formatMoney(row.pendingPayout)}
                  </td>
                </tr>
                {isExpanded && (
                  <tr className="bg-gray-50">
                    <td colSpan={COLUMN_COUNT} className="px-6 py-3">
                      <SellerChannelRows
                        channels={channels}
                        isLoading={channelsLoading}
                        error={channelsError}
                        payouts={payouts}
                        payoutsLoading={payoutsLoading}
                        payoutsError={payoutsError}
                        onOpenChannel={onOpenChannel}
                        onOpenPayout={onOpenPayout}
                      />
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
        {rows.length > 0 && (
          <tfoot className="bg-gray-50 border-t border-gray-200">
            <tr>
              <td className="px-6 py-3 text-sm font-semibold text-gray-900">합계</td>
              <td className="px-6 py-3 text-sm text-right font-semibold text-gray-900">
                {totals.netQty.toLocaleString('ko-KR')}
              </td>
              <td className="px-6 py-3 text-sm text-right font-semibold text-gray-900">
                {formatMoney(totals.grossSales)}
              </td>
              <td className="px-6 py-3 text-sm text-right font-semibold text-gray-700">
                {formatMoney(totals.discount)}
              </td>
              <td className="px-6 py-3 text-sm text-right font-semibold text-gray-700">
                {formatFixedCost(totals.fixedCost)}
              </td>
              <td
                className="px-6 py-3 text-sm text-right font-semibold text-gray-900"
                title={totalProfitReady ? undefined : PROFIT_PENDING_HINT}
              >
                {totalProfitReady ? formatMoney(totals.estNetProfit) : '—'}
              </td>
              <td className="px-6 py-3 text-sm text-right font-semibold text-gray-900">
                {formatMoney(totals.pendingPayout)}
              </td>
            </tr>
          </tfoot>
        )}
      </table>
    </TableCard>
  );
}
