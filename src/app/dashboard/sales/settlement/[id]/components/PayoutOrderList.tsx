'use client';

import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import type { ReconLineView } from '@/domain/entities/Settlement';
import { ReconLineTable } from './ReconLineTable';

/**
 * 이 지급 묶음이 <b>어떤 주문에 대한 정산인지</b> 그대로 펼친 목록 (FEATURE_2609_34).
 *
 * 🔴 아래 차이 리포트의 목록과 <b>같은 데이터</b>지만 성격이 다르다. 저쪽은 "왜 금액이 어긋났나"를 원인
 * 라벨로 좁혀 들어가는 드릴다운이고, 이쪽은 <b>묻지 않아도 보이는 전체 목록</b>이다 — 대사가 맞든 안 맞든
 * "이 돈이 어느 주문 값인가"는 언제나 답할 수 있어야 한다.
 *
 * 🔴 <b>목록만 스크롤한다</b>(사용자 요청 2026-09-11). 수백 줄이 페이지를 늘리면 위의 요약·원인 분석에
 * 닿으려고 매번 스크롤해야 한다 — 표에 높이를 주고 머리글을 고정해, 페이지는 그대로 두고 목록 안에서만
 * 움직이게 한다.
 *
 * 🔴 <b>비어 있을 때 이유를 밝힌다.</b> 라인은 쿠팡 <b>매출내역</b> 조회로만 들어오고, 지급내역만 받아 둔
 * 채널은 이 목록이 0건이다. 그냥 "없습니다" 라고만 하면 정산에 주문이 없다는 뜻으로 읽힌다.
 *
 * ⚠️ 검색은 <b>화면 안에서만</b> 거른다(서버 재조회 없음) — 목록이 이미 전부 와 있어서 왕복할 이유가 없다.
 * ⚠️ 표시 전용이다 — 조회·클립보드는 `PayoutDetailContainer` 가 소유한다.
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

  const visible = useMemo(() => {
    const needle = query.replace(/\s+/g, '').toLowerCase();
    return needle ? lines.filter((line) => haystack(line).includes(needle)) : lines;
  }, [lines, query]);

  const isEmpty = !loading && !error && lines.length === 0;

  return (
    <section className="bg-white rounded-lg shadow">
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
        // ⚠️ 높이는 표를 감싼 이 래퍼가 갖는다 — `ReconLineTable` 안에 두면 로딩·에러·빈 상태에도
        //    빈 스크롤 상자가 생긴다.
        <div className="max-h-[60vh] overflow-y-auto">
          <ReconLineTable
            lines={visible}
            loading={loading}
            error={error}
            stickyHeader
            onCopyIdentifiers={onCopyIdentifiers}
          />
        </div>
      )}
    </section>
  );
}
