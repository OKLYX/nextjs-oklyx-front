'use client';

import { Fragment } from 'react';
import type { SaleMonthSettlement } from '@/domain/entities/Settlement';
import { formatMoney, monthLabel } from '@/domain/entities/Settlement';

/**
 * 판매월 기준 정산 표 — "그 달 판매가 언제 얼마로 정산됐나" (FEATURE_2609_34).
 *
 * 🔴 정산 건 목록과 <b>축이 반대</b>다. 저쪽은 "이 정산은 어떤 판매였나"(정산 → 판매)이고, 이쪽은
 * "이 달 판매는 언제 정산됐나"(판매 → 정산)다. 한 달 판매가 여러 번에 나눠 정산되면
 * (주정산 채널·추가정산·늦게 확정된 건) 그 갈라짐은 <b>이 화면에서만</b> 보인다.
 *
 * 🔴 <b>월 소계를 서버가 아니라 화면에서 더한다.</b> 서버는 "판매월 × 지급일" 한 줄씩만 주고, 월 묶음은
 * 그 줄들을 그대로 합친 것이라 다른 값이 나올 여지가 없다 — 합계가 두 축에서 어긋나는 위험이 없다.
 *
 * ⚠️ 아직 어느 정산에도 붙지 않은 판매는 정산 시점이 없어 이 목록에 없다(화면이 안내 문구로 말한다).
 * ⚠️ 표시 전용이다.
 */
interface SaleMonthTableProps {
  rows: SaleMonthSettlement[];
  loading: boolean;
  error: string;
  onRetry: () => void;
}

/** 판매월별 묶음. 서버가 판매월 내림차순·지급일 오름차순으로 주므로 순서를 그대로 쓴다. */
function groupByMonth(rows: SaleMonthSettlement[]): { month: string; rows: SaleMonthSettlement[] }[] {
  const groups: { month: string; rows: SaleMonthSettlement[] }[] = [];
  for (const row of rows) {
    const last = groups[groups.length - 1];
    if (last && last.month === row.saleMonth) {
      last.rows.push(row);
    } else {
      groups.push({ month: row.saleMonth, rows: [row] });
    }
  }
  return groups;
}

const sum = (rows: SaleMonthSettlement[], pick: (row: SaleMonthSettlement) => number): number =>
  rows.reduce((total, row) => total + pick(row), 0);

export function SaleMonthTable({ rows, loading, error, onRetry }: SaleMonthTableProps) {
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

  if (loading && rows.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-6 space-y-2">
        {[0, 1, 2].map((row) => (
          <div key={row} className="h-8 bg-gray-100 rounded animate-pulse" />
        ))}
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow px-6 py-8 text-center text-sm text-gray-500">
        이 기간에 정산된 판매가 없습니다. 아직 정산되지 않은 판매는 여기 나오지 않습니다.
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow list-table-scroll">
      <table className="w-full">
        <thead className="bg-gray-100 border-b border-gray-200">
          <tr>
            <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">판매월</th>
            <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">지급일</th>
            <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">지급</th>
            <th className="px-6 py-3 text-right text-sm font-semibold text-gray-900">판매 건수</th>
            <th className="px-6 py-3 text-right text-sm font-semibold text-gray-900">판매액</th>
            <th className="px-6 py-3 text-right text-sm font-semibold text-gray-900">정산액</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {groupByMonth(rows).map((group) => (
            <Fragment key={group.month}>
              {group.rows.map((row) => (
                <tr key={`${row.saleMonth}-${row.settlementDate}-${row.paid}`}>
                  <td className="px-6 py-3 text-sm text-gray-500">{monthLabel(row.saleMonth)}</td>
                  <td className="px-6 py-3 text-sm text-gray-700">{row.settlementDate ?? '—'}</td>
                  <td className="px-6 py-3 text-sm">
                    {row.paid ? (
                      <span className="text-green-700">완료</span>
                    ) : (
                      <span className="text-gray-500">예정</span>
                    )}
                  </td>
                  <td className="px-6 py-3 text-sm text-right text-gray-700">
                    {row.orders.toLocaleString('ko-KR')}
                  </td>
                  <td className="px-6 py-3 text-sm text-right text-gray-700">
                    {formatMoney(row.saleAmount)}
                  </td>
                  <td className="px-6 py-3 text-sm text-right text-gray-900">
                    {formatMoney(row.settlementAmount)}
                  </td>
                </tr>
              ))}
              {/* 🔴 한 달이 여러 번에 나뉘었을 때만 소계를 붙인다 — 한 줄짜리 달에 소계를 또 그리면
                  같은 숫자가 두 번 나와 무엇이 합계인지 흐려진다. */}
              {group.rows.length > 1 && (
                <tr className="bg-gray-50">
                  <td className="px-6 py-2 text-sm font-semibold text-gray-900">
                    {monthLabel(group.month)} 합계
                  </td>
                  <td className="px-6 py-2 text-sm text-gray-500" colSpan={2}>
                    {group.rows.length}번에 나눠 정산
                  </td>
                  <td className="px-6 py-2 text-sm text-right font-semibold text-gray-900">
                    {sum(group.rows, (row) => row.orders).toLocaleString('ko-KR')}
                  </td>
                  <td className="px-6 py-2 text-sm text-right font-semibold text-gray-700">
                    {formatMoney(sum(group.rows, (row) => row.saleAmount))}
                  </td>
                  <td className="px-6 py-2 text-sm text-right font-semibold text-gray-900">
                    {formatMoney(sum(group.rows, (row) => row.settlementAmount))}
                  </td>
                </tr>
              )}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}
