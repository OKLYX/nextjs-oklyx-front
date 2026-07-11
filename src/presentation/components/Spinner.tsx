'use client';

import { Loader2 } from 'lucide-react';

interface SpinnerProps {
  size?: number;
  label?: string;
  className?: string;
}

/**
 * 앱 전역에서 사용하는 공통 로딩 스피너 컴포넌트
 *
 * 버튼 내부/영역 로딩 표시는 이 컴포넌트를 반드시 사용.
 * 인라인으로 `animate-spin`을 새로 붙여 스피너를 만들면 안됨 (규칙 위반).
 *
 * 색은 부모의 text 색을 상속(`currentColor`)하므로 별도 색 지정 불필요.
 *
 * @component
 * @example
 * // 버튼 로딩 (라벨 포함)
 * {isLoading ? <Spinner label="다운로드 중..." /> : <><Download size={16} />다운로드</>}
 *
 * @example
 * // 영역 로딩 (라벨 없음 — 스크린리더용 sr-only 텍스트 자동 포함)
 * {isLoading && <Spinner size={24} />}
 *
 * @param {number} [size=16] - 아이콘 크기(px)
 * @param {string} [label] - 있으면 아이콘 옆에 텍스트 표시, 없으면 sr-only "로딩 중"
 * @param {string} [className] - 래퍼 추가 클래스
 *
 * ❌ 금지 패턴:
 * - `<RefreshCw className="animate-spin" />` 등 인라인 스피너 신규 작성 → 이 컴포넌트 사용
 * - 색상 하드코딩 → 부모 text 색 상속(currentColor) 사용
 */
export function Spinner({ size = 16, label, className = '' }: SpinnerProps) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`} role="status">
      <Loader2 size={size} className="animate-spin" aria-hidden />
      {label ? <span>{label}</span> : <span className="sr-only">로딩 중</span>}
    </span>
  );
}
