/**
 * 흰 표면(카드) 공통 컴포넌트 — 배경·모서리·그림자·기본 여백·카드 제목을 한 곳에서 소유한다.
 *
 * **용도**: 검색 폼, 요약 패널, 상세 섹션 등 페이지 위에 올라가는 흰 박스.
 * **파일**: src/presentation/components/ui/Card.tsx
 *
 * **필수 규칙**
 * - `bg-white rounded-lg shadow` 조합을 컴포넌트 밖에서 새로 작성하지 않는다.
 * - 카드 제목은 `title` props 로 올린다. 카드 안에서 직접 `<h2>` 를 쓰지 않는다.
 * - 표(목록)를 담는 카드는 이 컴포넌트가 아니라 `TableCard` 를 쓴다.
 * - 팝업 패널은 `Modal` 소관이다. 모달 본문을 이 컴포넌트로 감싸지 않는다.
 *
 * **Props**
 * - `title?`: 있으면 `<h2 className="text-lg font-semibold text-gray-900 mb-4">` 로 렌더링.
 * - `action?`: 제목 우측 영역(버튼 등). `title` 없이 단독으로 쓰지 않는다.
 * - `padded?`: 기본 `true` → `p-6`. 내용이 자체 여백을 가지면 `false`.
 * - `className?`: 레이아웃 보정용 추가 클래스(`space-y-4`, `flex-1` 등). 배경·그림자 재정의 ❌.
 *
 * **사용 예제**
 * ```tsx
 * <Card title="검색 조건">
 *   <SearchForm />
 * </Card>
 *
 * <Card title="정산 요약" action={<button onClick={refresh}>새로고침</button>} className="space-y-4">
 *   <SummaryRows />
 * </Card>
 *
 * // 내부가 자체 여백을 갖는 경우
 * <Card padded={false}><StateBlock variant="loading" message="불러오는 중..." /></Card>
 * ```
 *
 * ⚠️ 이전에 `p-4` 였던 카드도 이 컴포넌트로 오면 `p-6` 이 된다(밀도 통일이 목적).
 * ❌ `className` 으로 `bg-*` / `shadow-*` / `rounded-*` 를 덮어쓰지 않는다.
 * ❌ 테두리형 표면(`border border-gray-200 rounded-lg p-6 bg-white`)은 아직 이 컴포넌트 대상이 아니다.
 */
import type { ReactNode } from 'react';

export interface CardProps {
  /** 카드 제목. 넘기면 h2 를 이 컴포넌트가 렌더링한다 */
  title?: string;
  /** 제목 우측 영역 */
  action?: ReactNode;
  /** 기본 여백(p-6) 사용 여부. 기본 true */
  padded?: boolean;
  /** 레이아웃 보정용 추가 클래스 */
  className?: string;
  children: ReactNode;
}

export function Card({ title, action, padded = true, className, children }: CardProps) {
  const classes = ['bg-white rounded-lg shadow', padded ? 'p-6' : '', className]
    .filter(Boolean)
    .join(' ');

  return (
    <div className={classes}>
      {title && (
        <div
          className={
            action ? 'flex items-center justify-between gap-4 mb-4' : undefined
          }
        >
          <h2 className={`text-lg font-semibold text-gray-900 ${action ? '' : 'mb-4'}`}>{title}</h2>
          {action}
        </div>
      )}
      {children}
    </div>
  );
}
