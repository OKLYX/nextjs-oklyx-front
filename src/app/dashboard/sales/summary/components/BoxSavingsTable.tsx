'use client';

import type { BoxSaving } from '@/domain/entities/PackingSavingsEntity';
import { formatSaving, savingToneClass } from '@/domain/entities/PackingSavingsEntity';
import { BoxShape } from '@/presentation/components/BoxShape';
import { TableCard } from '@/presentation/components/ui/TableCard';

interface BoxSavingsTableProps {
  rows: BoxSaving[];
  isLoading: boolean;
  error: string;
}

/**
 * 어떤 상자가 절약에 얼마나 기여했나 (FEATURE_2609_41 / PLAN 2609_41 S9 · S10 · S12).
 *
 * "재활용 상자를 더 모을 가치가 있나"에 답하는 유일한 숫자다.
 *
 * 🔴 <b>이 표는 매출 요약 화면 안 섹션이다</b>(S9). 탭을 하나 더하지 말 것 — `SalesTabs` 는 탭이 곧
 * 라우트라 탭 추가 = 새 페이지다. 섹션이면 필요 없다고 판단될 때 지우기도 쉽다.
 *
 * 🔴 <b>음수도 그대로 보여준다</b>(S12) — 큰 상자를 쓴 경우가 보여야 상자 선택이 교정된다.
 *
 * ⚠️ 상자 사진이 있으면 사진을, 없으면 치수 비율 도형(`BoxShape`)을 그린다(2609_40 D26).
 * 치수·사진은 절약 응답에 함께 들어 있다 — 상자 목록을 따로 부르지 않는다.
 * ⚠️ 정렬은 서버가 합계 내림차순으로 준다. 표시 전용이다.
 */
export function BoxSavingsTable({ rows, isLoading, error }: BoxSavingsTableProps) {
  return (
    <TableCard
      isLoading={isLoading && rows.length === 0}
      isEmpty={rows.length === 0}
      error={error || undefined}
      emptyMessage="이 기간에 포장한 박스가 없습니다."
    >
      {isLoading && rows.length > 0 && (
        <div className="px-6 py-2 text-xs text-gray-500 bg-gray-50 border-b border-gray-200">
          조회 중...
        </div>
      )}
      <table className="w-full">
        <thead className="bg-gray-100 border-b border-gray-200">
          <tr>
            <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">상자</th>
            <th className="px-6 py-3 text-right text-sm font-semibold text-gray-900">박스 수</th>
            <th className="px-6 py-3 text-right text-sm font-semibold text-gray-900">상자 절약</th>
            <th className="px-6 py-3 text-right text-sm font-semibold text-gray-900">택배 절약</th>
            <th className="px-6 py-3 text-right text-sm font-semibold text-gray-900">합계</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {rows.map((row) => (
            <tr key={row.packageId}>
              <td className="px-6 py-3 text-sm text-gray-700">
                <span className="flex items-center gap-2">
                  {/* 사진이 있으면 사진, 없으면 치수 비율 도형(PLAN 2609_40 D26) */}
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center">
                    {row.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={row.imageUrl}
                        alt={`${row.type} 상자 사진`}
                        className="h-11 w-11 rounded border border-gray-200 object-contain"
                      />
                    ) : (
                      <BoxShape
                        widthCm={row.widthCm}
                        lengthCm={row.lengthCm}
                        heightCm={row.heightCm}
                      />
                    )}
                  </span>
                  <span>
                    {row.type}
                    {row.boxKind === 'RECYCLED' && (
                      <span className="ml-2 rounded bg-green-50 px-1.5 py-0.5 text-xs text-green-700">
                        재활용
                      </span>
                    )}
                  </span>
                </span>
              </td>
              <td className="px-6 py-3 text-sm text-right text-gray-700">
                {row.parcelCount.toLocaleString('ko-KR')}
              </td>
              <td className={`px-6 py-3 text-sm text-right ${savingToneClass(row.boxSaving)}`}>
                {formatSaving(row.boxSaving)}
              </td>
              <td className={`px-6 py-3 text-sm text-right ${savingToneClass(row.deliverySaving)}`}>
                {formatSaving(row.deliverySaving)}
              </td>
              <td
                className={`px-6 py-3 text-sm text-right font-semibold ${savingToneClass(row.totalSaving)}`}
              >
                {formatSaving(row.totalSaving)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </TableCard>
  );
}
