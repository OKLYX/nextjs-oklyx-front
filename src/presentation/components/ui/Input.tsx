'use client';

/**
 * 공용 텍스트 입력 — 테두리 · 포커스 링 · 크기 · 라벨 · 에러 문구를 한 곳에서 소유한다.
 *
 * **용도**: 폼 입력(`<input>`). 표 안 인라인 입력도 같은 컴포넌트를 `size="sm"` 으로 쓴다.
 * **파일**: src/presentation/components/ui/Input.tsx
 *
 * **필수 규칙**
 * - 신규 입력은 이 컴포넌트를 쓴다. `border border-gray-300 focus:ring-2 …` 조합을
 *   새로 작성하지 않는다.
 * - 색 클래스는 팔레트 그대로다(`focus:ring-blue-500`). `globals.css` 리맵이 브랜드 색으로
 *   바꾼다 — 여기서 브랜드 토큰으로 바꾸지 말 것(리맵 경로 이탈).
 * - **크기를 섞지 않는다.** 폼 입력은 `md`, 표 안 입력은 `sm`. 표 안 입력을 `md` 로 올리면
 *   행 높이가 전부 달라진다.
 * - `select` / `textarea` 는 이 컴포넌트 대상이 아니다(아직 공용 컴포넌트가 없다).
 *
 * **Props**
 * - `size`: `md`(기본, `px-4 py-2 rounded-lg`) / `sm`(`px-2 py-1.5 text-sm rounded`).
 *   ⚠️ HTML `<input size>` 속성이 아니다(가려져 있다).
 * - `label?`: 넘기면 `useId()` 로 연결된 `<label>` 을 이 컴포넌트가 렌더링한다.
 * - `error?`: 있으면 테두리가 빨강 + 하단에 빨간 문구. 검증 로직은 호출부 소유다.
 * - `hint?`: 에러가 없을 때만 보이는 회색 보조 문구.
 * - `className?`: 레이아웃 보정용 추가 클래스. 테두리·여백 재정의 ❌.
 * - 그 외 `<input>` 표준 속성 전부.
 *
 * **DOM 구조**: `label` / `error` / `hint` 중 하나라도 있으면 `<div>` 로 감싸고, 셋 다 없으면
 * `<input>` 만 렌더링한다(표 안 입력처럼 부모가 크기를 잡는 자리의 레이아웃 보존).
 *
 * **사용 예제**
 * ```tsx
 * // useState 제어 폼
 * <Input label="상품명" value={name} onChange={(e) => setName(e.target.value)} />
 *
 * // 에러 표시
 * <Input label="이메일" type="email" error={errors.email?.message} {...register('email')} />
 *
 * // 표 안 인라인 입력
 * <Input size="sm" type="number" value={qty} onChange={onChange} />
 * ```
 *
 * ⚠️ `forwardRef` 필수 — 빠뜨리면 `react-hook-form` 의 `register()` 가 값을 못 읽고
 *    에러 없이 빈 값으로 제출된다.
 * ❌ `className` 으로 `border-*` / `px-*` / `py-*` 를 덮어쓰지 않는다.
 */
import { InputHTMLAttributes, forwardRef, useId } from 'react';

const BASE = 'w-full border focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed';

const SIZE = {
  sm: 'px-2 py-1.5 text-sm rounded',
  md: 'px-4 py-2 rounded-lg',
} as const;

export type InputSize = keyof typeof SIZE;

export interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> {
  /** 크기. 표 안 입력은 `sm`. 기본 `md` */
  size?: InputSize;
  /** 라벨 문구. 넘기면 label 을 이 컴포넌트가 렌더링한다 */
  label?: string;
  /** 에러 문구. 있으면 빨간 테두리 + 하단 문구 */
  error?: string;
  /** 보조 설명. 에러가 없을 때만 표시 */
  hint?: string;
  /** 레이아웃 보정용 추가 클래스 */
  className?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { size = 'md', label, error, hint, className, id, ...rest },
  ref,
) {
  const generatedId = useId();
  const inputId = id ?? generatedId;

  const classes = [
    BASE,
    SIZE[size],
    error ? 'border-red-500' : 'border-gray-300',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  // 라벨·에러·힌트가 하나도 없으면 래퍼 없이 input 만 그린다
  // (표 안 입력처럼 부모가 flex/grid 로 크기를 잡는 자리에서 레이아웃이 바뀌지 않도록).
  if (!label && !error && !hint) {
    return <input ref={ref} id={inputId} className={classes} {...rest} />;
  }

  return (
    <div>
      {label && (
        <label htmlFor={inputId} className="block text-sm font-medium text-gray-700 mb-1">
          {label}
        </label>
      )}
      <input ref={ref} id={inputId} className={classes} {...rest} />
      {error ? (
        <p className="mt-1 text-sm text-red-600">{error}</p>
      ) : hint ? (
        <p className="mt-1 text-sm text-gray-500">{hint}</p>
      ) : null}
    </div>
  );
});
