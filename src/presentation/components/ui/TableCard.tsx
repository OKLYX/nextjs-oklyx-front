/**
 * 목록 표를 담는 흰 표면 + 로딩 / 빈 상태 / 에러 분기를 한 곳에서 소유한다.
 *
 * **용도**: 모든 목록 화면의 `<table>` 컨테이너.
 * **파일**: src/presentation/components/ui/TableCard.tsx
 *
 * **필수 규칙**
 * - 목록 표는 이 컴포넌트 안에 둔다. `bg-white rounded-lg shadow overflow-hidden` 을
 *   새로 작성하지 않는다. 가로 스크롤 정책(`.list-table-scroll` → `--list-table-min-w`)은
 *   이 컴포넌트가 항상 적용한다.
 * - 로딩 / 빈 상태 / 에러는 화면에서 분기하지 말고 props 로 올린다. 내부에서 `StateBlock`
 *   으로 렌더링되므로 목록 화면끼리 모양이 같아진다.
 * - 우선순위는 `error` → `isLoading` → `isEmpty` → `children` 이다.
 * - 표 헤더 스타일은 이 컴포넌트가 소유하지 **않는다**. `<thead>` 는 각 화면이 그리되
 *   클래스는 `bg-gray-100 border-b border-gray-200` 로 통일한다.
 * - 범용 DataTable 이 아니다. 컬럼 구성은 화면마다 다르므로 `<table>` 은 children 이다.
 *
 * **Props**
 * - `isLoading` / `isEmpty`: 상태 플래그. 화면의 기존 분기를 그대로 올린다.
 * - `error?`: 문자열이 있으면 빨간 에러 블록을 대신 렌더링한다.
 * - `loadingMessage?`: 기본 `'불러오는 중...'`
 * - `emptyMessage?`: 기본 `'결과가 없습니다.'` — "아직 검색 안 함"과 "결과 0건"을 구분하는
 *   화면은 호출부에서 다른 문구를 넘긴다.
 * - `className?`: 레이아웃 보정용 추가 클래스. 배경·그림자 재정의 ❌.
 * - 페이지네이션처럼 같은 카드 안에 놓이던 요소는 `<table>` 뒤에 children 으로 나란히 넘긴다.
 *
 * **사용 예제**
 * ```tsx
 * <TableCard
 *   isLoading={isLoading}
 *   isEmpty={rows.length === 0}
 *   error={error}
 *   emptyMessage={hasSearched ? '검색 결과가 없습니다.' : '조건을 입력해 검색하세요.'}
 * >
 *   <table className="min-w-full divide-y divide-gray-200">
 *     <thead className="bg-gray-100 border-b border-gray-200">…</thead>
 *     <tbody>…</tbody>
 *   </table>
 * </TableCard>
 * ```
 *
 * ⚠️ `overflow-hidden` 만 쓰던 목록도 이제 표 안에서 가로 스크롤된다(의도된 개선).
 * ❌ 표를 이 컴포넌트 밖에 두고 별도 스크롤 래퍼를 만들지 않는다.
 */
import type { ReactNode } from 'react';
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
  children,
}: TableCardProps) {
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

  return <div className={classes}>{children}</div>;
}
