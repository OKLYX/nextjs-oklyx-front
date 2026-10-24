'use client';

import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import type { ReconLineView } from '@/domain/entities/Settlement';
import { useShowCards } from '@/presentation/hooks/useShowCards';
import { ReconLineTable } from './ReconLineTable';

/**
 * The list of <b>which orders this payout settles</b>, laid out as is (FEATURE_2609_34).
 *
 * 🔴 <b>The same data</b> as the difference report's list below, but a different role. That one is a drill-down
 * narrowed by cause label ("why do the amounts differ"); this one is <b>the whole list, shown without asking</b> —
 * whether reconciliation matches or not, "which orders is this money for" must always be answerable.
 *
 * 🔴 <b>Only the list scrolls</b> (user request 2026-09-11). Hundreds of rows lengthening the page would mean
 * scrolling every time to reach the summary and cause analysis above — the table gets a height and a fixed
 * header, so the page stays and only the list moves.
 *
 * 🔴 <b>An empty list says why.</b> Lines come in only through the market's <b>revenue</b> lookup (Coupang ·
 * 11st, FEATURE_2610_20); a channel that has only loaded payouts has 0 rows here. Saying just "none" reads as
 * "the payout has no orders".
 *
 * ⚠️ The search filters <b>on screen only</b> (no server re-read) — the whole list is already here.
 * ⚠️ Display only — the lookup and the clipboard belong to `PayoutDetailContainer`.
 */
interface PayoutOrderListProps {
  lines: ReconLineView[];
  loading: boolean;
  error: string;
  onCopyIdentifiers: (line: ReconLineView) => void;
}

/** 검색 대상 = 눈에 보이는 식별자·이름. 공백을 지우고 소문자로 맞춰 비교한다. */
const haystack = (line: ReconLineView): string =>
  [line.externalOrderId, line.platformOptionId, line.productName]
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, '')
    .toLowerCase();

export function PayoutOrderList({
  lines,
  loading,
  error,
  onCopyIdentifiers,
}: PayoutOrderListProps) {
  const [query, setQuery] = useState('');
  const showCards = useShowCards();

  const visible = useMemo(() => {
    const needle = query.replace(/\s+/g, '').toLowerCase();
    return needle ? lines.filter((line) => haystack(line).includes(needle)) : lines;
  }, [lines, query]);

  const isEmpty = !loading && !error && lines.length === 0;

  return (
    // Narrow-screen card view: the box is not drawn and the cards run edge to edge (FEATURE_2610_31 D30).
    <section className={showCards ? undefined : 'bg-white rounded-lg shadow'}>
      <div className="px-6 py-4 flex flex-wrap items-center gap-x-3 gap-y-2">
        <h2 className="text-sm font-semibold text-gray-900">이 정산에 포함된 주문</h2>
        {!loading && !error && lines.length > 0 && (
          <span className="text-xs text-gray-500">
            {query ? `${visible.length.toLocaleString('ko-KR')} / ` : ''}
            {lines.length.toLocaleString('ko-KR')}건 · 판매일 기준
          </span>
        )}

        {!isEmpty && !error && (
          <div className="ml-auto relative">
            <Search
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
            />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="주문번호 · 옵션ID · 상품명"
              className="w-64 pl-8 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        )}
      </div>

      {isEmpty ? (
        <div className="px-6 pb-6 text-sm text-gray-500">
          판매 내역이 아직 적재되지 않았습니다. 정산 화면의 [갱신]으로 매출내역을 불러오면 이 정산에
          포함된 주문이 여기 나옵니다.
          {/* 🔴 이 문장을 지우지 말 것 — 0건의 이유가 "주문이 없다"가 아니라 "아직 안 가져왔다"다. */}
        </div>
      ) : query && visible.length === 0 ? (
        <div className="px-6 pb-6 text-sm text-gray-500">검색 결과가 없습니다.</div>
      ) : (
        // ⚠️ The height belongs to this wrapper around the table, not to `ReconLineTable` — there it would leave an
        //    empty scroll box during loading, error and empty states. In the narrow-screen card view the card list
        //    takes the same height (`cardsListClassName`) and this wrapper takes none (FEATURE_2610_31 D30).
        <div className={showCards ? undefined : 'max-h-[60vh] overflow-y-auto'}>
          <ReconLineTable
            lines={visible}
            loading={loading}
            error={error}
            stickyHeader
            cardsListClassName="max-h-[60vh] overflow-y-auto"
            onCopyIdentifiers={onCopyIdentifiers}
          />
        </div>
      )}
    </section>
  );
}
