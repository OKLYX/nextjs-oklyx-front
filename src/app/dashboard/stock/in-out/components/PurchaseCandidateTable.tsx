'use client';

import type { PurchaseCandidate } from '@/domain/entities/StockEntity';
import { DataCard, DataCardSwitch } from '@/presentation/components/DataCard';
import { useShowCards } from '@/presentation/hooks/useShowCards';

interface PurchaseCandidateTableProps {
  candidates: PurchaseCandidate[];
  isLoading: boolean;
  error: string;
  onSelect: (candidate: PurchaseCandidate) => void;
}

/**
 * 입고 대기 — 구매기록은 있는데 실물 입고가 (전량) 안 잡힌 건 (FEATURE_2609_28 / 2609_29).
 *
 * ⚠️ 구매목록의 [입고] 한 번이 두 원장을 함께 쓰므로(2609_29 D1) 이 목록은 <b>비어 있는 것이 정상</b>이다.
 * 값이 생기는 경우 = 재고 반영 없이 기록된 구매. 그때 여기서 실물 입고를 이어 붙인다.
 */
export function PurchaseCandidateTable({
  candidates,
  isLoading,
  error,
  onSelect,
}: PurchaseCandidateTableProps) {
  const showCards = useShowCards();

  // Narrow-screen cards (FEATURE_2610_31 D14 · D30 · D37): the app's purchase pick line — product name, then
  // 「구매일 · 판매자 · 구매 N / 입고 N · 남은 N」; the table's 「단가」 at the bottom and [입고] in the button row.
  const renderCards = () =>
    candidates.map((candidate) => (
      <DataCard
        key={candidate.purchaseRecordId}
        body={
          <div>
            <p className="truncate text-sm text-gray-900">{candidate.productName}</p>
            <p className="text-[11px] text-gray-500">
              {candidate.purchasedOn} · {candidate.sellerName} · 구매 {candidate.purchasedQty} / 입고{' '}
              {candidate.receivedQty} · 남은 {candidate.remainingQty}
            </p>
          </div>
        }
        extraFields={[
          {
            label: '단가',
            value: candidate.unitPrice == null ? '미기입' : candidate.unitPrice.toLocaleString('ko-KR'),
          },
        ]}
        actions={
          <button
            type="button"
            onClick={() => onSelect(candidate)}
            className="px-3 py-1 text-xs border border-gray-300 rounded hover:bg-gray-100"
          >
            입고
          </button>
        }
      />
    ));

  return (
    // Narrow-screen card view: no box padding — the heading sits in the page padding (FEATURE_2610_31 D30).
    <div className={showCards ? 'space-y-3' : 'p-6 space-y-3'}>
      <h2 className="text-base font-semibold text-gray-900">입고 대기 (구매 후 미입고)</h2>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
          {error}
        </div>
      )}

      {isLoading ? (
        <p className="text-sm text-gray-500">불러오는 중...</p>
      ) : candidates.length === 0 ? (
        <p className="text-sm text-gray-500">
          입고 대기 중인 구매기록이 없습니다. (구매목록의 [입고]가 재고까지 함께 기록합니다)
        </p>
      ) : (
        <DataCardSwitch placement="page" renderCards={renderCards} className="list-table-scroll">
          <table className="w-full">
            <thead className="bg-gray-100 border-b border-gray-200">
              <tr>
                <th className="px-4 py-2 text-left text-sm font-semibold text-gray-900">구매일</th>
                <th className="px-4 py-2 text-left text-sm font-semibold text-gray-900">상품</th>
                <th className="px-4 py-2 text-left text-sm font-semibold text-gray-900">판매자</th>
                <th className="px-4 py-2 text-right text-sm font-semibold text-gray-900">구매</th>
                <th className="px-4 py-2 text-right text-sm font-semibold text-gray-900">입고</th>
                <th className="px-4 py-2 text-right text-sm font-semibold text-gray-900">잔여</th>
                <th className="px-4 py-2 text-right text-sm font-semibold text-gray-900">단가</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {candidates.map((candidate) => (
                <tr key={candidate.purchaseRecordId} className="hover:bg-gray-50">
                  <td className="px-4 py-2 text-sm text-gray-700">{candidate.purchasedOn}</td>
                  <td className="px-4 py-2 text-sm text-gray-700">{candidate.productName}</td>
                  <td className="px-4 py-2 text-sm text-gray-700">{candidate.sellerName}</td>
                  <td className="px-4 py-2 text-sm text-gray-700 text-right">
                    {candidate.purchasedQty}
                  </td>
                  <td className="px-4 py-2 text-sm text-gray-700 text-right">
                    {candidate.receivedQty}
                  </td>
                  <td className="px-4 py-2 text-sm font-semibold text-gray-900 text-right">
                    {candidate.remainingQty}
                  </td>
                  <td className="px-4 py-2 text-sm text-gray-700 text-right">
                    {/* null = amount not entered (FEATURE_2610_18 D68 「미기입」). Drawing 0 would read as a free purchase. */}
                    {candidate.unitPrice == null
                      ? '미기입'
                      : candidate.unitPrice.toLocaleString('ko-KR')}
                  </td>
                  <td className="px-4 py-2 text-right">
                    <button
                      type="button"
                      onClick={() => onSelect(candidate)}
                      className="px-3 py-1 text-xs border border-gray-300 rounded hover:bg-gray-100"
                    >
                      입고
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </DataCardSwitch>
      )}
    </div>
  );
}
