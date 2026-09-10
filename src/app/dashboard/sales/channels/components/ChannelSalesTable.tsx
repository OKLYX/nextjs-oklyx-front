'use client';

import { Fragment } from 'react';
import type { ChannelSales } from '@/domain/entities/SalesSummary';
import {
  FIXED_COST_HINT,
  PROFIT_PENDING_HINT,
  channelLabel,
  formatFixedCost,
  formatMoney,
  formatProfit,
} from '@/domain/entities/SalesSummary';
import type { ProductProfit } from '@/domain/entities/SalesSummary';
import type { PayoutSummary } from '@/domain/entities/Settlement';
import { ChannelPayoutList } from '../../components/ChannelPayoutList';
import { ChannelSalesLines } from './ChannelSalesLines';

// 🔴 열을 추가하면 이 수를 같이 올린다 — 빈 상태 행과 정산 목록 행의 `colSpan` 이 이 값을 먹는다.
const COLUMN_COUNT = 8;

interface ChannelSalesTableProps {
  rows: ChannelSales[];
  loading: boolean;
  error: string;
  /** 조회 기간의 <b>전 채널</b> 상품별 매출. 채널별 분배는 이 컴포넌트가 한다(요청은 1회다). */
  lines: ProductProfit[];
  linesLoading: boolean;
  linesError: string;
  /** 조회 기간에 걸치는 <b>전 채널</b>의 정산 건. 채널별 분배는 이 컴포넌트가 한다(요청은 1회다). */
  payouts: PayoutSummary[];
  payoutsLoading: boolean;
  payoutsError: string;
  /** 펼친 채널 1개. 통합 매출에서 넘어오면 그 채널이 열린 채로 시작한다. */
  expandedAccountId: number | null;
  onToggle: (accountId: number) => void;
  onRetry: () => void;
  onOpenPayout: (payoutId: number) => void;
}

/**
 * 채널(계정)별 매출 표 (FEATURE_2609_34).
 *
 * 🔴 <b>통합 매출의 채널 행과 같은 값을 같은 순서로 보여준다</b> — 두 화면이 같은 API(`by-channel`)를 쓰고
 * 서버가 계산한 값을 그대로 그린다. 어느 한쪽에서 다시 더하기 시작하면 같은 채널의 숫자가 화면마다 달라진다.
 *
 * 🔴 <b>대사 상태 배지를 넣지 말 것</b>(FEATURE_2609_34). 그 건수는 기간이 걸리지 않는 채널 전체 집계라
 * 기간 필터 옆에 두면 이 기간의 결과로 읽힌다. 대사 상태는 펼쳤을 때 나오는 정산 목록이 건별로 보여준다.
 *
 * ⚠️ 표시 전용이다. 조회·펼침 상태는 Container 가 소유한다.
 */
export function ChannelSalesTable({
  rows,
  loading,
  error,
  lines,
  linesLoading,
  linesError,
  payouts,
  payoutsLoading,
  payoutsError,
  expandedAccountId,
  onToggle,
  onRetry,
  onOpenPayout,
}: ChannelSalesTableProps) {
  if (error) {
    return (
      <div className="bg-white rounded-lg shadow p-6 space-y-3">
        <p className="text-sm text-red-600">{error}</p>
        <button
          type="button"
          onClick={onRetry}
          className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          다시 시도
        </button>
      </div>
    );
  }

  // 첫 조회에만 스켈레톤. 기간을 바꾼 재조회는 이전 값을 지우지 않는다(깜빡임 방지).
  if (loading && rows.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-6 space-y-2">
        {[0, 1, 2].map((row) => (
          <div key={row} className="h-8 bg-gray-100 rounded animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow list-table-scroll">
      {loading && rows.length > 0 && (
        <div className="px-6 py-2 text-xs text-gray-500 bg-gray-50 border-b border-gray-200">
          조회 중...
        </div>
      )}
      <table className="w-full">
        <thead className="bg-gray-100 border-b border-gray-200">
          <tr>
            <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">채널</th>
            <th className="px-6 py-3 text-right text-sm font-semibold text-gray-900">판매수량</th>
            <th className="px-6 py-3 text-right text-sm font-semibold text-gray-900">매출액</th>
            <th className="px-6 py-3 text-right text-sm font-semibold text-gray-900">할인</th>
            <th
              className="px-6 py-3 text-right text-sm font-semibold text-gray-900"
              title={FIXED_COST_HINT}
            >
              고정비
            </th>
            <th className="px-6 py-3 text-right text-sm font-semibold text-gray-900">순이익(추정)</th>
            <th className="px-6 py-3 text-right text-sm font-semibold text-gray-900">
              정산 추정 금액
              {/* 🔴 이 라벨이 없으면 "기간을 바꿨는데 값이 안 변한다"가 버그 신고로 온다(D4). */}
              <span className="block text-[11px] font-normal text-gray-500">기간 무관 · 미지급 잔액</span>
            </th>
            <th className="px-6 py-3 text-right text-sm font-semibold text-gray-900">
              지급확정
              <span className="block text-[11px] font-normal text-gray-500">기간 내 입금</span>
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {rows.length === 0 ? (
            <tr>
              <td colSpan={COLUMN_COUNT} className="px-6 py-8 text-center text-gray-500">
                조회된 판매채널이 없습니다.
              </td>
            </tr>
          ) : (
            rows.map((channel) => {
              const isExpanded = expandedAccountId === channel.accountId;
              return (
                <Fragment key={channel.accountId}>
                  <tr
                    onClick={() => onToggle(channel.accountId)}
                    className="hover:bg-gray-50 cursor-pointer"
                  >
                    <td className="px-6 py-3 text-sm text-gray-700">
                      {isExpanded ? '▾' : '▸'} {channelLabel(channel)}
                    </td>
                    <td className="px-6 py-3 text-sm text-right text-gray-700">
                      {channel.netQty.toLocaleString('ko-KR')}
                      {channel.holdQty > 0 && (
                        // 환불대기는 유효수량에서 빼지 않는다(D14) — 빼면 확정될 때마다 매출이 출렁인다.
                        <span
                          className="ml-1 text-xs text-gray-500"
                          title="환불대기 수량입니다. 아직 확정이 아니라 매출에서 빼지 않았습니다"
                        >
                          (대기 {channel.holdQty})
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-3 text-sm text-right font-semibold text-gray-900">
                      {formatMoney(channel.grossSales)}
                    </td>
                    <td className="px-6 py-3 text-sm text-right text-gray-500">
                      {formatMoney(channel.discount)}
                    </td>
                    {/* 🔴 경고색을 쓰지 않는다 — 정상 비용이다. 순이익이 `—`(원가 미확정)여도 이 칸은 숫자다(D6). */}
                    <td
                      className="px-6 py-3 text-sm text-right text-gray-700"
                      title={
                        (channel.fixedCost ?? 0) > 0 ? `${channel.fixedCostMonths ?? 0}개월분` : undefined
                      }
                    >
                      {formatFixedCost(channel.fixedCost)}
                    </td>
                    <td
                      className="px-6 py-3 text-sm text-right text-gray-900"
                      title={channel.costBasisReady ? undefined : PROFIT_PENDING_HINT}
                    >
                      {formatProfit(channel)}
                    </td>
                    <td className="px-6 py-3 text-sm text-right text-gray-900">
                      {formatMoney(channel.pendingPayout)}
                    </td>
                    <td className="px-6 py-3 text-sm text-right text-gray-900">
                      {formatMoney(channel.paidAmount)}
                    </td>
                  </tr>
                  {isExpanded && (
                    <tr className="bg-gray-50">
                      <td colSpan={COLUMN_COUNT} className="px-6 py-3 space-y-4">
                        {/* 🔴 매출 내역이 먼저다 — 이 탭에 들어온 이유가 "이 채널에서 뭐가 팔렸나"이고,
                            정산은 그 매출이 언제 얼마로 들어오는지를 뒤에서 설명한다. */}
                        <div className="space-y-1">
                          <p className="text-xs font-semibold text-gray-700">매출 내역</p>
                          <ChannelSalesLines
                            rows={lines.filter((line) => line.accountId === channel.accountId)}
                            isLoading={linesLoading}
                            error={linesError}
                          />
                        </div>
                        <div className="space-y-1">
                          <p className="text-xs font-semibold text-gray-700">
                            정산 내역
                            {/* 🔴 축이 다르다는 것을 여기서 한 번 더 말한다 — 위 매출은 판매일,
                                아래 정산은 매출인식월이라 두 숫자가 나란히 있으면 반드시 빼 본다. */}
                            <span className="ml-1 text-[11px] font-normal text-gray-400">
                              매출인식월 기준
                            </span>
                          </p>
                          <div className="text-xs">
                            <ChannelPayoutList
                              payouts={payouts.filter(
                                (payout) => payout.accountId === channel.accountId
                              )}
                              isLoading={payoutsLoading}
                              error={payoutsError}
                              onOpen={onOpenPayout}
                            />
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}
