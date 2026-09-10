'use client';

import type { ProductProfit } from '@/domain/entities/SalesSummary';
import {
  PROFIT_PENDING_HINT,
  formatMoney,
  formatProfit,
} from '@/domain/entities/SalesSummary';

/**
 * 채널 하나의 <b>기간 매출 내역</b> — 그 채널에서 무엇이 얼마나 팔렸는지 (FEATURE_2609_34).
 *
 * 🔴 <b>이 화면의 존재 이유다.</b> 통합 매출은 플랫폼·판매자를 가로질러 보는 곳이고, 채널별 매출은
 * <b>그 채널 안</b>을 들여다보는 곳이다 — 채널 행에 합계만 있고 내역이 없으면 이 탭은 통합 매출의
 * 부분집합일 뿐이다.
 *
 * 🔴 <b>미분류 행을 숨기지 않는다</b> — 채널 옵션 연결이 없는 주문이라 상품명을 모를 뿐 매출은 실재한다.
 * 숨기면 이 목록의 합이 위 채널 행의 매출액과 어긋나고, 어긋나는 이유를 아무도 모른다.
 *
 * ⚠️ 표시 전용이다. 조회는 Container 가 <b>화면당 1회</b> 하고(채널마다 부르지 않는다) 여기로 내려준다.
 * ⚠️ 합계 줄을 만들지 않는다 — 위 요약이 서버가 계산한 합계다. 화면에서 다시 더하면 두 숫자가 갈린다.
 *
 * 🔴 열 너비를 고정하고 <b>상품명만 두 줄까지 줄바꿈</b>한다(판매 내역과 같은 규칙) — 상품명이 길다고
 * 표 전체가 가로로 밀리지 않게.
 */
interface ChannelSalesLinesProps {
  /** 이미 <b>이 채널 것만</b> 걸러진 목록. */
  rows: ProductProfit[];
  isLoading: boolean;
  error: string;
}

export function ChannelSalesLines({ rows, isLoading, error }: ChannelSalesLinesProps) {
  if (isLoading) {
    return <div className="h-5 w-64 bg-gray-200 rounded animate-pulse" />;
  }

  if (error) {
    return <p className="text-xs text-red-600">{error}</p>;
  }

  if (rows.length === 0) {
    return <p className="text-xs text-gray-500">이 기간에 이 채널에서 판매된 상품이 없습니다.</p>;
  }

  return (
    <table className="w-full table-fixed text-xs">
      {/* 🔴 상품 칸은 다른 칸의 약 2배다 — 상품명이 길어서 가로 스크롤을 만들던 자리다. */}
      <colgroup>
        <col className="w-[32%]" />
        <col className="w-[13%]" />
        <col className="w-[14%]" />
        <col className="w-[13%]" />
        <col className="w-[14%]" />
        <col className="w-[14%]" />
      </colgroup>
      <thead>
        <tr className="text-gray-500">
          <th className="px-2 py-1 text-left font-medium">상품</th>
          <th className="px-2 py-1 text-right font-medium">판매수량</th>
          <th className="px-2 py-1 text-right font-medium">매출액</th>
          <th className="px-2 py-1 text-right font-medium">할인</th>
          <th className="px-2 py-1 text-right font-medium">수수료(추정)</th>
          <th className="px-2 py-1 text-right font-medium">순이익(추정)</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-gray-200">
        {rows.map((row) => (
          <tr
            key={`${row.masterProductId ?? 'uncategorized'}-${row.accountId ?? 'all'}`}
            className="align-top"
          >
            <td className="px-2 py-1 text-gray-700">
              <span className="line-clamp-2 break-words" title={row.masterProductName}>
                {row.masterProductName}
                {row.uncategorized && (
                  <span
                    className="ml-1 text-gray-400"
                    title="채널 옵션에 연결되지 않은 주문입니다. 매출에는 포함됩니다"
                  >
                    (상품 미연결)
                  </span>
                )}
              </span>
            </td>
            <td className="px-2 py-1 text-right text-gray-700 whitespace-nowrap">
              {row.netQty.toLocaleString('ko-KR')}
            </td>
            <td className="px-2 py-1 text-right text-gray-900 whitespace-nowrap">
              {formatMoney(row.grossSales)}
            </td>
            <td className="px-2 py-1 text-right text-gray-500 whitespace-nowrap">
              {formatMoney(row.discount)}
            </td>
            <td className="px-2 py-1 text-right text-gray-500 whitespace-nowrap">
              {formatMoney(row.estFee)}
            </td>
            <td
              className="px-2 py-1 text-right text-gray-900 whitespace-nowrap"
              title={row.costBasisReady ? undefined : PROFIT_PENDING_HINT}
            >
              {formatProfit(row)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
