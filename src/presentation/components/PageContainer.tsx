import type { ReactNode } from 'react';

/** 본문 최대폭 프리셋. 자유 문자열 대신 이 5종만 사용한다. */
export type PageWidth = 'sm' | 'md' | 'lg' | 'xl' | 'full';

const WIDTH_CLASS: Record<PageWidth, string> = {
  sm: 'max-w-2xl mx-auto',
  md: 'max-w-3xl mx-auto',
  lg: 'max-w-6xl mx-auto',
  xl: 'max-w-7xl mx-auto',
  full: '',
};

/**
 * 대시보드 페이지의 공통 레이아웃/배경/헤더 래퍼 컴포넌트.
 *
 * 모든 대시보드 페이지의 최상위 컨테이너는 이 Component를 사용해야 함.
 * 페이지 배경색·바깥 여백·본문 최대폭·세로 간격·페이지 제목을 한 곳에서 일관되게 관리한다.
 *
 * **역할**:
 * - 배경색: `bg-page` 토큰 (globals.css `--page-background`, 단일 출처)
 * - 가장자리 채움: `-m-4 md:-m-6`로 DashboardLayout `<main>`의 `p-4 md:p-6` 패딩을 상쇄
 * - 내부 여백: `p-4 md:p-6`로 콘텐츠 패딩 복원, `min-h-full`로 영역 채움
 * - 페이지 제목(`title`): `<h1>`을 이 컴포넌트가 렌더링한다. 페이지가 직접 `<h1>`을 쓰지 않는다
 * - 본문 최대폭(`width`): 프리셋 5종. 페이지가 임의의 `max-w-*`를 정하지 않는다
 * - 세로 간격: 항상 `space-y-6`. 페이지가 정하지 않는다
 * - 최소 가로폭 없음(콘텐츠 유동): 페이지 전체엔 min-width를 두지 않는다. 브라우저 폭이
 *   줄면 콘텐츠도 함께 줄어들고, **테이블만** 자체 최소폭(`.list-table-scroll` →
 *   `--list-table-min-w`, 햄버거 전환 md 폭 ≈720px)에서 멈춰 가로 스크롤된다.
 *   (예전 `md:min-w-[1080px]`는 제거 — 콘텐츠 전체가 1080px에서 얼어붙어 테이블이
 *   햄버거 전환 지점보다 훨씬 이른 폭에서 고정되던 문제 때문. 테이블 폭 정책은 테이블에만.)
 *
 * **파일**: src/presentation/components/PageContainer.tsx
 *
 * **Props**:
 * - `title?`: 페이지 제목. 넘기면 `<h1 className="text-2xl font-bold text-gray-900 truncate">`를
 *   렌더링한다. 없으면 헤더 영역 자체를 렌더링하지 않는다(제목 없는 페이지 허용).
 * - `action?`: 제목 우측 영역(버튼, 건수 표시 등). 있으면 제목 줄이
 *   `flex items-center justify-between`으로 배치된다.
 * - `width?`: 본문 최대폭. `sm`(max-w-2xl) / `md`(max-w-3xl) / `lg`(기본, max-w-6xl) /
 *   `xl`(max-w-7xl) / `full`(최대폭 없음). 모두 `mx-auto` 가운데 정렬.
 *
 * @example
 * // 기본 (가운데 정렬, max-w-6xl, 세로 간격 space-y-6)
 * <PageContainer title="택배비">
 *   <SearchCard />
 *   <DataTable />
 * </PageContainer>
 *
 * @example
 * // 넓은 목록 화면 + 제목 우측 액션
 * <PageContainer title="주문 내역" width="xl" action={<button>새로고침</button>}>
 *   <FilterBar />
 *   <OrderTable />
 * </PageContainer>
 *
 * ⚠️ 주의:
 * - 페이지 배경색을 바꾸려면 globals.css의 `--page-background`만 수정 (여기 수정 X)
 * - DashboardLayout `<main>`의 `p-6`에 의존하므로 레이아웃 변경 시 `-m-6` 함께 점검
 * - 제목이 동적(상품명 등)이어도 `title`로 넘긴다. `<h1>`에 `truncate`가 상시 적용돼 있다
 *
 * ❌ 금지 패턴:
 * - 페이지마다 `bg-gray-50` 등 색상 하드코딩 → `bg-page` 토큰만 사용
 * - 직접 `-m-6 p-6 bg-page min-h-full` div 작성 → 이 Component 사용
 * - 페이지에서 직접 `<h1>` 작성 → `title` props 사용
 * - 페이지에서 `max-w-*` / `space-y-*`로 본문 폭·간격 재정의 → `width` props 사용
 * - 제목 아래 부제(description) 추가 → 부제는 두지 않기로 결정됨(2026-09-11 `34cee44`)
 */
interface PageContainerProps {
  children: ReactNode;
  /** 페이지 제목. 넘기면 h1 을 이 컴포넌트가 렌더링한다. */
  title?: string;
  /** 제목 우측 영역 (버튼, 건수 표시 등) */
  action?: ReactNode;
  /** 본문 최대폭. 기본 'lg' */
  width?: PageWidth;
}

export function PageContainer({ children, title, action, width = 'lg' }: PageContainerProps) {
  return (
    <div className="-m-4 md:-m-6 p-4 md:p-6 bg-page min-h-full">
      <div className={`${WIDTH_CLASS[width]} space-y-6`.trim()}>
        {title && (
          <div className={action ? 'flex items-center justify-between gap-4' : undefined}>
            <h1 className="text-2xl font-bold text-gray-900 truncate">{title}</h1>
            {action}
          </div>
        )}
        {children}
      </div>
    </div>
  );
}
