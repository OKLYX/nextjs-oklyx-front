import type { ReactNode } from 'react';

/**
 * 대시보드 페이지의 공통 레이아웃/배경 래퍼 컴포넌트.
 *
 * 모든 대시보드 페이지의 최상위 컨테이너는 이 Component를 사용해야 함.
 * 페이지 배경색과 가장자리까지 채워지는 레이아웃을 한 곳에서 일관되게 관리한다.
 *
 * **역할**:
 * - 배경색: `bg-page` 토큰 (globals.css `--page-background`, 단일 출처)
 * - 가장자리 채움: `-m-6`로 DashboardLayout `<main>`의 `p-6` 패딩을 상쇄
 * - 내부 여백: `p-6`로 콘텐츠 패딩 복원, `min-h-full`로 영역 채움
 * - 최소 가로폭: `min-w-[1080px]`로 콘텐츠가 일정 폭 미만으로 줄지 않도록 보장
 *   (주문내역의 주문상태 chip 6개가 한 줄에 들어가는 최소 폭 기준).
 *   이보다 좁아지면 가로 스크롤이 생기고, 사이드바는 햄버거로 전환된다
 *   (전환 기준폭은 DashboardLayout 참고: 1080 + 사이드바 224 = 1304px).
 *   ⚠️ chip이 줄바꿈되면 이 값만 키우면 됨 (단일 조정 지점).
 *
 * **파일**: src/presentation/components/PageContainer.tsx
 *
 * @example
 * // 기본 (중앙 정렬, max-w-6xl, 세로 간격) — 대부분의 페이지
 * <PageContainer>
 *   <h1>택배비</h1>
 *   <SearchCard />
 *   <DataTable />
 * </PageContainer>
 *
 * @example
 * // 전체 폭 flex 레이아웃 — 입출고/수수료 등
 * <PageContainer contentClassName="flex flex-col gap-6">
 *   <Header />
 *   <Form />
 * </PageContainer>
 *
 * ⚠️ 주의:
 * - 페이지 배경색을 바꾸려면 globals.css의 `--page-background`만 수정 (여기 수정 X)
 * - DashboardLayout `<main>`의 `p-6`에 의존하므로 레이아웃 변경 시 `-m-6` 함께 점검
 *
 * ❌ 금지 패턴:
 * - 페이지마다 `bg-gray-50` 등 색상 하드코딩 → `bg-page` 토큰만 사용
 * - 직접 `-m-6 p-6 bg-page min-h-full` div 작성 → 이 Component 사용
 */
interface PageContainerProps {
  children: ReactNode;
  /** 내부 콘텐츠 래퍼 클래스. 기본값은 중앙 정렬 레이아웃. */
  contentClassName?: string;
}

export function PageContainer({
  children,
  contentClassName = 'max-w-6xl mx-auto space-y-6',
}: PageContainerProps) {
  return (
    <div className="-m-6 p-6 bg-page min-h-full min-w-[1080px]">
      <div className={contentClassName}>{children}</div>
    </div>
  );
}
