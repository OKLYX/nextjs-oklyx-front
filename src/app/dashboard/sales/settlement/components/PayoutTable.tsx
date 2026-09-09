'use client';

import type { PayoutSummary } from '@/domain/entities/Settlement';
import {
  channelLabel,
  formatDateRange,
  formatMoney,
  payoutStatusLabel,
  settlementTypeLabel,
} from '@/domain/entities/Settlement';

/**
 * 지급 묶음 목록 표 (FEATURE_2609_30 / 05 Step 2).
 *
 * 한 행 = <b>지급 묶음</b>이다. 같은 인식 기간에 여러 건이 정상적으로 온다(주정산 + 중간 추가정산, D5-3).
 * 기간으로 묶어 한 줄로 합치지 말 것 — 통장에 찍힌 건수와 화면 건수가 달라진다.
 *
 * 🔴 <b>대사 상태 색 규칙</b>(둘 다 지키지 않으면 정상 입금이 매번 경고로 뜬다):
 * - `AMOUNT_ONLY` 를 경고색으로 칠하지 않는다 — 정상 입금이고 내역을 쿠팡이 안 주는 것뿐이다(D5-5).
 * - `PENDING` 을 실패처럼 빨갛게 칠하지 않는다 — 아직 채점할 답안지가 없는 정상 상태다.
 *
 * ⚠️ 표시 전용이다. 조회·필터는 `PayoutListContainer` 가 소유한다.
 * ⚠️ 차액 <b>금액</b>은 목록 응답에 없다(검증식은 서버가 상세에서 계산한다) — 여기서 추정해 그리지 않는다.
 */
interface PayoutTableProps {
  rows: PayoutSummary[];
  loading: boolean;
  error: string;
  onOpen: (payoutId: number) => void;
  onRetry: () => void;
}

const COLUMN_COUNT = 6;

type Badge = { text: string; className: string };

function reconBadge(row: PayoutSummary): Badge {
  switch (row.reconStatus) {
    case 'RECONCILED':
      return {
        text: `✅ 대사완료 (라인 ${row.lineCount.toLocaleString('ko-KR')}건)`,
        className: 'bg-green-50 text-green-700 border-green-200',
      };
    case 'UNRECONCILED':
      return {
        text: '⚠ 미대사 — 상세에서 차액 확인',
        className: 'bg-amber-50 text-amber-800 border-amber-200',
      };
    case 'AMOUNT_ONLY':
      // 🔴 경고색 금지. 라인 대조가 불가능할 뿐 정상 입금이다.
      return {
        text: 'ⓘ 금액만 기록 — 판매 라인 대조 불가',
        className: 'bg-gray-50 text-gray-600 border-gray-200',
      };
    default:
      // 🔴 PENDING 은 실패가 아니다.
      return {
        text: '⏳ 지급내역 대기',
        className: 'bg-gray-50 text-gray-600 border-gray-200',
      };
  }
}

export function PayoutTable({ rows, loading, error, onOpen, onRetry }: PayoutTableProps) {
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

  // 첫 조회에만 스켈레톤. 필터를 바꾼 재조회는 이전 값을 지우지 않는다(깜빡임 방지).
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
            <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">유형</th>
            <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
              인식기간
              <span className="block text-[11px] font-normal text-gray-500">매출인식일 축</span>
            </th>
            <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">지급일</th>
            <th className="px-6 py-3 text-right text-sm font-semibold text-gray-900">지급액</th>
            <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">대사</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {rows.length === 0 ? (
            <tr>
              <td colSpan={COLUMN_COUNT} className="px-6 py-8 text-center text-gray-500">
                아직 수신된 정산 내역이 없습니다. [갱신] 을 눌러 불러오세요.
              </td>
            </tr>
          ) : (
            rows.map((row) => {
              const badge = reconBadge(row);
              return (
                <tr
                  key={row.payoutId}
                  onClick={() => onOpen(row.payoutId)}
                  className="hover:bg-gray-50 cursor-pointer"
                >
                  <td className="px-6 py-3 text-sm text-gray-900">
                    {channelLabel(row)}
                    <span className="block text-xs text-gray-500">{row.sellerName ?? '—'}</span>
                  </td>
                  <td className="px-6 py-3 text-sm text-gray-900">
                    {settlementTypeLabel(row.settlementType)}
                  </td>
                  <td className="px-6 py-3 text-sm text-gray-900">
                    {formatDateRange(row.recognitionFrom, row.recognitionTo)}
                    <span className="block text-xs text-gray-500">
                      {row.revenueRecognitionMonth ?? '—'}
                    </span>
                  </td>
                  <td className="px-6 py-3 text-sm text-gray-900">
                    {row.finalSettlementDate ?? row.settlementDate ?? '—'}
                    <span className="block text-xs text-gray-500">
                      {payoutStatusLabel(row.status)}
                    </span>
                  </td>
                  <td className="px-6 py-3 text-sm text-right text-gray-900 font-medium">
                    {formatMoney(row.finalAmount)}
                  </td>
                  <td className="px-6 py-3 text-sm">
                    <span className={`inline-block px-2 py-1 rounded border text-xs ${badge.className}`}>
                      {badge.text}
                    </span>
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}
