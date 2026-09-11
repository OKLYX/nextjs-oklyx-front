/**
 * 목록·카드 안의 로딩 / 빈 상태 / 에러 문구 블록.
 *
 * **용도**: "불러오는 중...", "결과가 없습니다.", 에러 문구처럼 본문 대신 표시되는 한 줄 상태.
 * **파일**: src/presentation/components/ui/StateBlock.tsx
 *
 * **필수 규칙**
 * - 상태 문구를 `p-8 text-center text-gray-500` 같은 클래스로 새로 조립하지 않는다.
 * - 표(목록) 안쪽 상태는 이 컴포넌트를 직접 쓰지 말고 `TableCard` 의 props 로 넘긴다.
 *   `TableCard` 가 내부에서 이 컴포넌트를 렌더링한다.
 * - 흰 표면이 필요하면 `Card` 로 감싼다. 이 컴포넌트는 배경을 갖지 않는다.
 *
 * **사용 예제**
 * ```tsx
 * // 카드 안의 로딩
 * <Card padded={false}><StateBlock variant="loading" message="불러오는 중..." /></Card>
 *
 * // 표 밖의 에러
 * <Card padded={false}><StateBlock variant="error" message={error} /></Card>
 * ```
 *
 * ❌ 배경(`bg-white rounded-lg shadow`)을 이 컴포넌트에 넣지 않는다 — 표면은 `Card` 소관.
 */
import type { ReactNode } from 'react';

export type StateBlockVariant = 'loading' | 'empty' | 'error';

const TONE: Record<StateBlockVariant, string> = {
  loading: 'text-gray-500',
  empty: 'text-gray-500',
  error: 'text-red-600',
};

export interface StateBlockProps {
  /** 상태 종류. `error` 만 빨간 글씨, 나머지는 회색 */
  variant: StateBlockVariant;
  /** 사용자에게 보여줄 문구 */
  message: ReactNode;
}

export function StateBlock({ variant, message }: StateBlockProps) {
  return <div className={`p-8 text-center ${TONE[variant]}`}>{message}</div>;
}
