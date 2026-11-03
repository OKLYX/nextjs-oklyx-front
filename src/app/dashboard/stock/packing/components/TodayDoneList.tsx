'use client';

import { StateBlock } from '@/presentation/components/ui/StateBlock';
import type { PackingHistoryRow } from '@/domain/entities/PackingEntity';

/**
 * 「오늘 완료」 탭 본문 — 오늘 이 화면에서 [이 박스 완료] 한 박스 목록 (2026-11-03 사용자 지시).
 *
 * **파일**: src/app/dashboard/stock/packing/components/TodayDoneList.tsx
 *
 * 🔴 데이터는 「포장 이력」 메뉴와 같은 `GET /api/admin/packing/history` 다 — 오늘 하루 · 「포장 완료」
 *    (PENDING → PACKED) 줄만 페이지가 골라서 넘긴다. 이 화면만의 조회 API 를 따로 만들지 않는다.
 * 🔴 자동 새로고침 없음 — 박스를 완료할 때 페이지가 다시 부른다(작업 대상 목록과 같은 자세).
 * 🔴 표면은 바깥(오른쪽 열 카드)의 것이다 — Card/TableCard 를 다시 씌우지 않는다(`PendingParcelList` compact 와 같다).
 * 🔴 번호는 오늘 완료한 순서다 — 첫 박스 = 1. 목록은 최근 것이 위(서버 `createdAt desc`)라 맨 위 번호 = 오늘 완료 수.
 */
export interface TodayDoneListProps {
  rows: PackingHistoryRow[];
  loading: boolean;
}

/** `yyyy-MM-ddTHH:mm:ss` KST 벽시계 → `HH:mm`. 서버가 이미 KST 로 준다 — 시간대 계산을 하지 않는다 */
const timeOf = (changedAt: string): string => changedAt.slice(11, 16) || '-';

export function TodayDoneList({ rows, loading }: TodayDoneListProps) {
  if (loading) return <StateBlock variant="loading" message="불러오는 중..." />;
  if (rows.length === 0) return <StateBlock variant="empty" message="오늘 완료한 박스가 없습니다" />;
  return (
    <table className="w-full text-xs">
      <thead className="bg-gray-100 border-b border-gray-200">
        <tr>
          <th className="px-2 py-1.5 text-right font-medium text-gray-700">No</th>
          <th className="px-2 py-1.5 text-left font-medium text-gray-700">시각</th>
          <th className="px-2 py-1.5 text-left font-medium text-gray-700">송장</th>
          <th className="px-2 py-1.5 text-left font-medium text-gray-700">상자</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row, index) => (
          <tr key={row.id} className="border-b border-gray-100" title={`주문 ${row.externalOrderId} · ${row.sellerName ?? '-'}`}>
            <td className="px-2 py-1.5 text-right tabular-nums text-gray-500">{rows.length - index}</td>
            <td className="px-2 py-1.5 text-gray-700">{timeOf(row.changedAt)}</td>
            <td className="px-2 py-1.5 font-mono text-gray-900">{row.invoiceNumber}</td>
            <td className="px-2 py-1.5 text-gray-700">{row.boxName ?? '-'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
