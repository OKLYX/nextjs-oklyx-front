'use client';

/**
 * Shared quantity input (stepper).
 * File: src/presentation/components/QuantityStepper.tsx
 *
 * **Purpose**: a field for **an integer of 1 or more**, like a component quantity. The ▲▼ attached on the right raise
 *   and lower the value with the mouse (keyboard ↑↓ do the same). A new quantity field uses this instead of a bare
 *   `<input>` (「마켓 상품 추가하기」 window · option add/edit form · component change grid · the parcel quantity of the
 *   narrow-screen cards of the order detail and the shipping label preview — FEATURE_2610_31 D28).
 *
 * **String contract**: the value is a `string` — it is not turned into a number while typing (the value would jump the
 *   moment it is cleared). An empty string is passed up as is, so **validation and number conversion happen once, in
 *   the caller, right before submit**. Typing is not filtered (same behaviour as the existing
 *   `type="text" inputMode="numeric"` fields).
 *
 * **What ▲▼ do**: read the current value as a number, add or subtract `step`, then clamp to `[min, max]`.
 *   - Empty or not a number starts from `min` (either ▲ or ▼ on an empty field → `min`).
 *   - At an end the matching button is disabled (▼ at or below `min`, ▲ at or above `max`).
 *   - ⚠️ From a wrong value (`0` with `min=1`) ▲ still brings it into range. Telling why the field is wrong is the
 *     caller's message (the caller may also pass `invalid` for a red border) — this component does not block input.
 *
 * **Props**
 * - `value` / `onChange(next: string)` — fully controlled. No internal state.
 * - `min` (default 1) · `max` (optional) · `step` (default 1)
 * - `disabled` · `title` · `ariaLabel` — give `ariaLabel` in a grid cell with no visible label.
 * - `className` — **layout only, like width** (`w-24`). ❌ No border or padding override.
 * - `invalid` (default false) — red border when the caller judges the value wrong.
 *
 * **Usage**
 * ```tsx
 * <QuantityStepper
 *   className="w-24"
 *   value={qty}
 *   onChange={(next) => setQty(next)}
 *   disabled={busy}
 *   ariaLabel={`${productName} 수량`}
 * />
 * ```
 *
 * ⚠️ ▲▼ are left out of the tab order (`tabIndex={-1}`) — so that in a grid of many quantity fields Tab moves field to
 *    field. Keyboard users do the same with ↑↓ in the input.
 * ❌ Do not use it as is for a field where `min=0` has a meaning, like a stock quantity — pass `min` explicitly.
 */

import { KeyboardEvent } from 'react';

interface QuantityStepperProps {
  /** 입력 문자열(빈 문자열 허용). 숫자 변환은 호출부가 제출 직전에 한다. */
  value: string;
  onChange: (next: string) => void;
  /** 하한(기본 1). ▲▼ 결과는 항상 이 값 이상이다. */
  min?: number;
  /** 상한(선택). 없으면 ▲ 가 계속 올라간다. */
  max?: number;
  /** ▲▼ 한 번의 증감폭(기본 1). */
  step?: number;
  disabled?: boolean;
  /** 화면에 라벨이 없는 자리(격자 칸)에서 쓸 접근성 이름. */
  ariaLabel?: string;
  title?: string;
  /** 폭 등 레이아웃 보정용 클래스. */
  className?: string;
  /** true = the value is wrong — red border (the caller decides; FEATURE_2610_31 D28). */
  invalid?: boolean;
}

export function QuantityStepper({
  value,
  onChange,
  min = 1,
  max,
  step = 1,
  disabled = false,
  ariaLabel,
  title,
  className,
  invalid = false,
}: QuantityStepperProps) {
  const parsed = Number(value);
  const current = value.trim() !== '' && Number.isFinite(parsed) ? parsed : null;

  const clamp = (n: number) => {
    const lower = Math.max(n, min);
    return max != null ? Math.min(lower, max) : lower;
  };

  /** 비어 있으면 min 부터 센다 — 빈 칸에서 ▲ 를 누르면 min 이 들어온다. */
  const bump = (delta: number) => {
    const next = current == null ? min : clamp(current + delta);
    onChange(String(next));
  };

  const atMin = current != null && current <= min;
  const atMax = max != null && current != null && current >= max;

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowUp') {
      e.preventDefault(); // 캐럿이 줄 끝으로 튀지 않게
      if (!atMax) bump(step);
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!atMin) bump(-step);
    }
  };

  const arrowClasses =
    'flex h-1/2 w-full items-center justify-center text-[9px] leading-none text-gray-500 hover:bg-gray-100 disabled:cursor-not-allowed disabled:text-gray-300 disabled:hover:bg-transparent';

  return (
    <div
      className={[
        'inline-flex items-stretch overflow-hidden rounded border bg-white focus-within:ring-2 focus-within:ring-blue-500',
        invalid ? 'border-red-500 ring-2 ring-red-300' : 'border-gray-300',
        disabled ? 'bg-gray-100' : '',
        className ?? '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <input
        type="text"
        inputMode="numeric"
        disabled={disabled}
        aria-label={ariaLabel}
        title={title}
        className="min-w-0 flex-1 bg-transparent px-2 py-1 text-right text-sm text-gray-900 focus:outline-none disabled:cursor-not-allowed disabled:text-gray-500"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
      />
      <div className="flex w-5 shrink-0 flex-col border-l border-gray-300">
        <button
          type="button"
          tabIndex={-1}
          disabled={disabled || atMax}
          aria-label="수량 1 올리기"
          // 눌러도 입력칸 포커스를 뺏지 않는다 — 연달아 누르기 편하다.
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => bump(step)}
          className={arrowClasses}
        >
          ▲
        </button>
        <button
          type="button"
          tabIndex={-1}
          disabled={disabled || atMin}
          aria-label="수량 1 내리기"
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => bump(-step)}
          className={`${arrowClasses} border-t border-gray-300`}
        >
          ▼
        </button>
      </div>
    </div>
  );
}
