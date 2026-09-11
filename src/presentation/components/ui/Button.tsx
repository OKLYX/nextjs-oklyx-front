/**
 * 공용 버튼 — 크기 · 색 · 비활성 · 로딩 표시를 한 곳에서 소유한다.
 *
 * **용도**: 화면의 모든 동작 버튼(제출/실행/취소/삭제).
 * **파일**: src/presentation/components/ui/Button.tsx
 *
 * **필수 규칙**
 * - 신규 버튼은 이 컴포넌트를 쓴다. `bg-blue-600` / `bg-red-600` 클래스를 새로 작성하지 않는다.
 * - 색은 `globals.css` 의 BRAND PALETTE REMAP 이 브랜드 색으로 바꾼다 — 여기서 `bg-brand` 로
 *   바꾸지 말 것(리맵 경로 이탈).
 * - 크기 variant 는 `sm` / `md` 둘뿐이다. 세 번째를 만들지 않는다.
 * - 표 안 동작 버튼은 `size="sm"`, 폼 제출·페이지 동작 버튼은 기본 `md`.
 * - 아직 교체되지 않은 기존 버튼들은 해당 화면을 건드릴 때 함께 이관한다.
 *
 * **Props**
 * - `variant`: `primary`(기본) / `secondary` / `danger`.
 * - `size`: `sm`(`px-3 py-1.5 text-sm`) / `md`(기본, `px-4 py-2`).
 * - `isLoading`: `true` 면 `disabled` + `loadingText`(없으면 children) 표시.
 * - `className`: **레이아웃 보정 전용**(`flex items-center gap-1`, `w-full`, `flex-1` 등).
 * - 그 외 `<button>` 표준 속성 전부. `type` 기본값은 `'button'`.
 *
 * **사용 예제**
 * ```tsx
 * // 폼 제출
 * <Button type="submit" isLoading={isSubmitting} loadingText="저장 중...">저장</Button>
 *
 * // 표 안 동작 버튼 (아이콘 + 문구)
 * <Button size="sm" className="flex items-center gap-1" onClick={onEdit}>수정</Button>
 *
 * // 모달 footer
 * <Button variant="secondary" onClick={onClose}>취소</Button>
 * <Button variant="danger" onClick={onDelete} isLoading={isDeleting} loadingText="삭제 중...">삭제</Button>
 * ```
 *
 * ⚠️ `type` 기본값이 `'button'` 이다. 폼 제출 버튼은 반드시 `type="submit"` 을 넘긴다.
 * ❌ `className` 으로 `bg-*` / `rounded-*` / `px-*` / `py-*` 를 덮어쓰지 않는다
 *    (미세 조정이 필요하면 그 자리는 교체하지 않는다).
 */
import { ButtonHTMLAttributes, ReactNode, forwardRef } from 'react';

const BASE = 'rounded-lg font-medium transition-colors disabled:cursor-not-allowed';

const SIZE = {
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-4 py-2',
} as const;

const VARIANT = {
  primary: 'bg-blue-600 text-white hover:bg-blue-700 disabled:bg-blue-400',
  secondary: 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50',
  danger: 'bg-red-600 text-white hover:bg-red-700 disabled:opacity-50',
} as const;

export type ButtonVariant = keyof typeof VARIANT;
export type ButtonSize = keyof typeof SIZE;

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** 색 역할. 기본 `primary` */
  variant?: ButtonVariant;
  /** 크기. 표 안 동작 버튼은 `sm`. 기본 `md` */
  size?: ButtonSize;
  /** 진행 중이면 `true` → 자동 `disabled` */
  isLoading?: boolean;
  /** 진행 중 표시 문구. 없으면 children 을 그대로 보여준다 */
  loadingText?: ReactNode;
  /** 레이아웃 보정용 추가 클래스 */
  className?: string;
  children?: ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = 'primary',
    size = 'md',
    isLoading = false,
    loadingText,
    className,
    disabled,
    type = 'button',
    children,
    ...rest
  },
  ref,
) {
  const classes = [BASE, SIZE[size], VARIANT[variant], className].filter(Boolean).join(' ');

  return (
    <button
      ref={ref}
      type={type}
      disabled={isLoading || disabled}
      className={classes}
      {...rest}
    >
      {isLoading ? (loadingText ?? children) : children}
    </button>
  );
});
