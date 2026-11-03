'use client';

import { Fragment } from 'react';
import type { ChannelSales, SellerSales } from '@/domain/entities/SalesSummary';
import type { PayoutSummary } from '@/domain/entities/Settlement';
import {
  FIXED_COST_HINT_MIXED,
  PROFIT_PENDING_HINT,
  SETTLEMENT_PENDING_HINT,
  formatFixedCost,
  formatMoney,
  formatProfit,
} from '@/domain/entities/SalesSummary';
import { SellerChannelRows } from './SellerChannelRows';
import { Card } from '@/presentation/components/ui/Card';
import { TableCard } from '@/presentation/components/ui/TableCard';
import { DataCard } from '@/presentation/components/DataCard';
import { SalesValueRow } from '../../components/SalesValueRow';
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
 * Sales table per seller (FEATURE_2609_30 / 04 Step 3). One row = one seller; a click opens its channel rows.
 *
 * 🔴 「정산 추정 금액」 follows the period and the switch like 「매출액」 (FEATURE_2611_05 D2 · D6), so it has no small
 * line under its name (D15). It is `—` when a line has no commission base, with the hint only then (D7 · D10).
 *
 * 🔴 No profit is `—`. Drawn as 0 it reads "nothing left" — the truth is "not known yet" (D15).
 *
 * 🔴 <b>Do not put the reconciliation status badge back into this table</b> (FEATURE_2609_34). Payouts are on the
 * revenue-recognition axis, so the count does not change with the period, and next to the period filter it reads as
 * "13 mismatched this month". Reconciliation status is shown per payout by the recognition-month list under an
 * opened seller.
 *
 * ⚠️ Display only. The Container owns the lookups and the open state.
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
      estSettlement: acc.estSettlement + (row.estSettlement ?? 0),
    }),
    { grossSales: 0, discount: 0, netQty: 0, fixedCost: 0, estNetProfit: 0, estSettlement: 0 }
  );
  // 한 행이라도 원가 스냅샷이 없으면 합계도 모르는 값이다 — 부분합을 총계처럼 보이면 안 된다.
  const totalProfitReady = rows.length > 0 && rows.every((row) => row.costBasisReady);
  // FEATURE_2611_05 D7 · D12: the same rule for the estimated settlement — one `—` row makes the total `—`.
  const totalSettlementReady = rows.length > 0 && rows.every((row) => row.estSettlement != null);

  // Narrow-screen cards (FEATURE_2610_31 D14 · D33): the app's seller sales card — 「▸ seller」, then 「판매수량」 · 「매출액」 ·
  // 「할인」 · 「고정비」 · 「순이익(추정)」 · 「정산 추정 금액」 lines; a tap opens the channel rows inside the card. The totals card
  // comes last, like the table's footer row.
  const renderCards = () => [
    ...rows.map((row) => {
      const isExpanded = expandedSellerId === row.sellerId;
      return (
        <DataCard
          key={row.sellerId}
          onClick={() => onToggle(row.sellerId)}
          title={
            <span className="font-semibold">
              {isExpanded ? '▾' : '▸'} {row.sellerName}
            </span>
          }
          body={
            <div className="space-y-0.5">
              <SalesValueRow
                label="판매수량"
                value={
                  row.holdQty > 0
                    ? `${row.netQty.toLocaleString('ko-KR')} (대기 ${row.holdQty})`
                    : row.netQty.toLocaleString('ko-KR')
                }
                hint={row.holdQty > 0 ? '환불대기 수량입니다. 아직 확정이 아니라 매출에서 빼지 않았습니다' : undefined}
              />
              <SalesValueRow label="매출액" value={formatMoney(row.grossSales)} bold />
              <SalesValueRow label="할인" value={formatMoney(row.discount)} />
              <SalesValueRow label="고정비" value={formatFixedCost(row.fixedCost)} hint={FIXED_COST_HINT_MIXED} />
              <SalesValueRow
                label="순이익(추정)"
                value={formatProfit(row)}
                hint={row.costBasisReady ? undefined : PROFIT_PENDING_HINT}
              />
              <SalesValueRow
                label="정산 추정 금액"
                value={formatMoney(row.estSettlement)}
                hint={row.estSettlement == null ? SETTLEMENT_PENDING_HINT : undefined}
              />
            </div>
          }
          expansion={
            isExpanded ? (
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
            ) : undefined
          }
        />
      );
    }),
    <DataCard
      key="total"
      title={<span className="font-semibold">합계</span>}
      body={
        <div className="space-y-0.5">
          <SalesValueRow label="판매수량" value={totals.netQty.toLocaleString('ko-KR')} bold />
          <SalesValueRow label="매출액" value={formatMoney(totals.grossSales)} bold />
          <SalesValueRow label="할인" value={formatMoney(totals.discount)} bold />
          <SalesValueRow label="고정비" value={formatFixedCost(totals.fixedCost)} bold />
          <SalesValueRow
            label="순이익(추정)"
            value={totalProfitReady ? formatMoney(totals.estNetProfit) : '—'}
            hint={totalProfitReady ? undefined : PROFIT_PENDING_HINT}
            bold
          />
          <SalesValueRow
            label="정산 추정 금액"
            value={totalSettlementReady ? formatMoney(totals.estSettlement) : '—'}
            hint={totalSettlementReady ? undefined : SETTLEMENT_PENDING_HINT}
            bold
          />
        </div>
      }
    />,
  ];

  return (
    // 첫 조회에만 로딩 블록. 기간을 바꾼 재조회는 이전 값을 지우지 않고 위에 로딩 줄만 띄운다(깜빡임 방지).
    <TableCard
      isLoading={loading && rows.length === 0}
      isEmpty={rows.length === 0}
      emptyMessage="해당 기간에 판매된 주문이 없습니다."
      renderCards={renderCards}
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
              title={FIXED_COST_HINT_MIXED}
            >
              고정비
            </th>
            <th className="px-6 py-3 text-right text-sm font-semibold text-gray-900">
              순이익(추정)
            </th>
            <th className="px-6 py-3 text-right text-sm font-semibold text-gray-900">
              정산 추정 금액
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
                  <td
                    className="px-6 py-3 text-sm text-right text-gray-900"
                    title={row.estSettlement == null ? SETTLEMENT_PENDING_HINT : undefined}
                  >
                    {formatMoney(row.estSettlement)}
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
              <td
                className="px-6 py-3 text-sm text-right font-semibold text-gray-900"
                title={totalSettlementReady ? undefined : SETTLEMENT_PENDING_HINT}
              >
                {totalSettlementReady ? formatMoney(totals.estSettlement) : '—'}
              </td>
            </tr>
          </tfoot>
        )}
      </table>
    </TableCard>
  );
}
