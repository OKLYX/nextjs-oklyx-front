/**
 * The white surface that holds a list table, plus the loading / empty / error branches, in one place.
 *
 * **Purpose**: the `<table>` container of list screens. Not every table sits in it — a list that must not scroll
 *   sideways (`ChannelSaleRecords`) or a table inside a popup or a row draws its own surface.
 * **File**: src/presentation/components/ui/TableCard.tsx
 *
 * **Required rules**
 * - A list table sits inside this component. Do not write `bg-white rounded-lg shadow overflow-hidden` again
 *   elsewhere. The horizontal-scroll policy (`.list-table-scroll` → `--list-table-min-w`) is applied by this
 *   component whenever the table is drawn — in the narrow-screen card view (`renderCards`, FEATURE_2610_31 D13)
 *   the cards take the table's place and the box is not drawn.
 * - Do not branch on loading / empty / error in the screen — pass them as props. They render through `StateBlock`,
 *   so the list screens that use this component look the same.
 * - Priority: `error` → `isLoading` → `isEmpty` → `children` (in card view, the cards in place of the `<table>`).
 * - This component does **not** own the table header style. Each screen draws its `<thead>`, with the classes
 *   `bg-gray-100 border-b border-gray-200`.
 * - Not a generic DataTable. Columns differ per screen, so the `<table>` is a child.
 *
 * **Props**
 * - `isLoading` / `isEmpty`: state flags. Pass the screen's existing branches as they are.
 * - `error?`: when a string is given, a red error block is rendered instead.
 * - `loadingMessage?`: default `'불러오는 중...'`
 * - `emptyMessage?`: default `'결과가 없습니다.'` — a screen that tells "not searched yet" from "0 results" passes
 *   another text.
 * - `className?`: extra layout classes. ❌ No background or shadow override.
 * - `renderCards?` · `cardsToolbar?`: the narrow-screen cards and the controls above them (see the props below).
 * - Elements that sat in the same card, like pagination, are passed as children right after the `<table>`.
 *
 * **Usage**
 * ```tsx
 * <TableCard
 *   isLoading={isLoading}
 *   isEmpty={rows.length === 0}
 *   error={error}
 *   emptyMessage={hasSearched ? '검색 결과가 없습니다.' : '조건을 입력해 검색하세요.'}
 *   renderCards={() => rows.map((row) => <DataCard key={row.id} title={row.name} />)}
 * >
 *   <table className="min-w-full divide-y divide-gray-200">
 *     <thead className="bg-gray-100 border-b border-gray-200">…</thead>
 *     <tbody>…</tbody>
 *   </table>
 * </TableCard>
 * ```
 *
 * ⚠️ Lists that used `overflow-hidden` only now scroll horizontally inside the table (an intended improvement).
 * ❌ Do not put the table outside this component with a scroll wrapper of its own.
 */
'use client';

import { Children, isValidElement, type ReactNode } from 'react';
import { DataCardList } from '@/presentation/components/DataCard';
import { ViewModeToggle } from '@/presentation/components/ViewModeToggle';
import { useShowCards } from '@/presentation/hooks/useShowCards';
import { StateBlock } from './StateBlock';

export interface TableCardProps {
  /** 로딩 중이면 표 대신 로딩 블록 */
  isLoading?: boolean;
  /** 결과 0건이면 표 대신 빈 상태 블록 */
  isEmpty?: boolean;
  /** 에러 문구. 있으면 최우선으로 에러 블록 */
  error?: string | null;
  /** 로딩 문구. 기본 '불러오는 중...' */
  loadingMessage?: string;
  /** 빈 상태 문구. 기본 '결과가 없습니다.' */
  emptyMessage?: string;
  /** 레이아웃 보정용 추가 클래스 */
  className?: string;
  /**
   * The list's narrow-screen cards (FEATURE_2610_31 D13 · D25) — the `DataCard`s of the rows. When given, a
   * table/card switch (`ViewModeToggle`) sits above the list below 768px, and in card view the white box (and
   * `className`) is not drawn and the cards (in a page `DataCardList`) take the place of the `<table>` child — the
   * other children (pagination etc.) stay where they are. Loading, empty and error blocks keep the box.
   */
  renderCards?: () => ReactNode;
  /** Controls above the cards, left of the switch, in card view only (「전체 선택」 · sort — D13 · D31). */
  cardsToolbar?: ReactNode;
  /** `<table>` (+ 같은 카드에 놓이는 페이지네이션 등) */
  children: ReactNode;
}

export function TableCard({
  isLoading = false,
  isEmpty = false,
  error,
  loadingMessage = '불러오는 중...',
  emptyMessage = '결과가 없습니다.',
  className,
  renderCards,
  cardsToolbar,
  children,
}: TableCardProps) {
  const showCards = useShowCards();
  const classes = ['bg-white rounded-lg shadow list-table-scroll', className]
    .filter(Boolean)
    .join(' ');

  if (error) {
    return (
      <div className="bg-white rounded-lg shadow">
        <StateBlock variant="error" message={error} />
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow">
        <StateBlock variant="loading" message={loadingMessage} />
      </div>
    );
  }

  if (isEmpty) {
    return (
      <div className="bg-white rounded-lg shadow">
        <StateBlock variant="empty" message={emptyMessage} />
      </div>
    );
  }

  if (renderCards === undefined) return <div className={classes}>{children}</div>;

  return (
    <>
      <div className="flex flex-wrap items-center gap-2 md:hidden">
        {showCards && cardsToolbar}
        <ViewModeToggle className="ml-auto" />
      </div>
      {showCards ? (
        <div>
          {Children.map(children, (child) =>
            isValidElement(child) && child.type === 'table' ? (
              <DataCardList placement="page">{renderCards()}</DataCardList>
            ) : (
              child
            )
          )}
        </div>
      ) : (
        <div className={classes}>{children}</div>
      )}
    </>
  );
}
