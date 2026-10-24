'use client';

import type { ReturnCandidate } from '@/domain/entities/StockEntity';
import { DataCard, DataCardSwitch } from '@/presentation/components/DataCard';
import { useShowCards } from '@/presentation/hooks/useShowCards';

interface ReturnCandidateTableProps {
  candidates: ReturnCandidate[];
  isLoading: boolean;
  error: string;
  onSelect: (candidate: ReturnCandidate) => void;
}

/**
 * 반품 대기 — 물건이 돌아왔는지 사람이 확인할 클레임 목록 (FEATURE_2609_28 / PLAN D6).
 *
 * ⚠️ 상태로 거르지 않는다. 클레임 상태 매핑이 실계정으로 검증된 적이 없어 화이트리스트를 걸면
 * 실제로 돌아온 물건을 입고하지 못한다 — 상태는 보여주고 판단은 사람이 한다.
 * ⚠️ 클레임은 판매 옵션 단위라 물품(Product)이 없다. 어떤 물품이 돌아왔는지는 폼에서 고른다.
 */
export function ReturnCandidateTable({
  candidates,
  isLoading,
  error,
  onSelect,
}: ReturnCandidateTableProps) {
  const showCards = useShowCards();

  // Narrow-screen cards (FEATURE_2610_31 D14 · D30 · D37): the app's return pick line — product name, then
  // 「주문번호 · 반품 N / 입고 N · 남은 N · 상태 · 회수」 and [반품입고] in the button row. No field is added at the
  // bottom (D37): the table's 「회수」 is already the last part of that line.
  const renderCards = () =>
    candidates.map((candidate) => (
      <DataCard
        key={candidate.orderClaimId}
        body={
          <div>
            <p className="truncate text-sm text-gray-900">{candidate.itemName ?? '—'}</p>
            <p className="text-[11px] text-gray-500">
              {[
                candidate.externalOrderId,
                `반품 ${candidate.claimQty} / 입고 ${candidate.receivedQty} · 남은 ${candidate.remainingQty}`,
                candidate.claimStatus,
                candidate.collectStatus,
              ]
                .filter((part) => part != null)
                .join(' · ')}
            </p>
          </div>
        }
        actions={
          <button
            type="button"
            onClick={() => onSelect(candidate)}
            className="px-3 py-1 text-xs border border-gray-300 rounded hover:bg-gray-100"
          >
            반품입고
          </button>
        }
      />
    ));

  return (
    // Narrow-screen card view: no box padding — the heading sits in the page padding (FEATURE_2610_31 D30).
    <div className={showCards ? 'space-y-3' : 'p-6 space-y-3'}>
      <h2 className="text-base font-semibold text-gray-900">반품 대기 (반품입고 확인)</h2>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
          {error}
        </div>
      )}

      {isLoading ? (
        <p className="text-sm text-gray-500">불러오는 중...</p>
      ) : candidates.length === 0 ? (
        <p className="text-sm text-gray-500">반품입고를 기다리는 건이 없습니다.</p>
      ) : (
        <DataCardSwitch placement="page" renderCards={renderCards} className="list-table-scroll">
          <table className="w-full">
            <thead className="bg-gray-100 border-b border-gray-200">
              <tr>
                <th className="px-4 py-2 text-left text-sm font-semibold text-gray-900">주문번호</th>
                <th className="px-4 py-2 text-left text-sm font-semibold text-gray-900">상품</th>
                <th className="px-4 py-2 text-left text-sm font-semibold text-gray-900">상태</th>
                <th className="px-4 py-2 text-left text-sm font-semibold text-gray-900">회수</th>
                <th className="px-4 py-2 text-right text-sm font-semibold text-gray-900">신청</th>
                <th className="px-4 py-2 text-right text-sm font-semibold text-gray-900">입고</th>
                <th className="px-4 py-2 text-right text-sm font-semibold text-gray-900">잔여</th>
                <th className="px-4 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {candidates.map((candidate) => (
                <tr key={candidate.orderClaimId} className="hover:bg-gray-50">
                  <td className="px-4 py-2 text-sm text-gray-700">
                    {candidate.externalOrderId ?? '—'}
                    {/* 주문 미매칭 클레임은 판매자를 유도할 곳이 없어 폼에서 직접 골라야 한다. */}
                    {candidate.orderLineId == null && (
                      <span className="ml-1 text-xs text-amber-700">(주문 미매칭)</span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-sm text-gray-700">{candidate.itemName ?? '—'}</td>
                  <td className="px-4 py-2 text-sm text-gray-700">{candidate.claimStatus ?? '—'}</td>
                  <td className="px-4 py-2 text-sm text-gray-700">
                    {candidate.collectStatus ?? '—'}
                  </td>
                  <td className="px-4 py-2 text-sm text-gray-700 text-right">
                    {candidate.claimQty}
                  </td>
                  <td className="px-4 py-2 text-sm text-gray-700 text-right">
                    {candidate.receivedQty}
                  </td>
                  <td className="px-4 py-2 text-sm font-semibold text-gray-900 text-right">
                    {candidate.remainingQty}
                  </td>
                  <td className="px-4 py-2 text-right">
                    <button
                      type="button"
                      onClick={() => onSelect(candidate)}
                      className="px-3 py-1 text-xs border border-gray-300 rounded hover:bg-gray-100"
                    >
                      반품입고
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
