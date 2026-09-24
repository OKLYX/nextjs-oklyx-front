'use client';

/**
 * 수량 입력(스테퍼) 공용 컴포넌트.
 * File: src/presentation/components/QuantityStepper.tsx
 *
 * **용도**: 구성상품 수량처럼 **1 이상의 정수**를 넣는 칸. 오른쪽에 붙은 ▲▼ 를 마우스로 눌러
 *   값을 올리고 내린다(키보드 ↑↓ 도 같다). 수량 칸을 새로 만들 때는 맨 `<input>` 대신 이것을 쓴다
 *   (쿠팡 상품 가져오기 팝업 · 옵션 추가/수정 폼 · 구성상품 변경 격자 · 쿠팡 상품으로 마스터 만들기).
 *
 * **문자열 계약**: 값은 `string` 이다 — 입력 중에는 숫자로 바꾸지 않는다(지우는 순간 값이 튄다).
 *   빈 문자열을 그대로 올려 보내므로 **검증·숫자 변환은 호출부가 제출 직전에 한 번만** 한다.
 *   타자는 걸러내지 않는다(기존 `type="text" inputMode="numeric"` 칸과 동작이 같다).
 *
 * **▲▼ 가 하는 일**: 현재 값을 숫자로 읽어 `step` 만큼 더하거나 뺀 뒤 `[min, max]` 로 자른다.
 *   - 비었거나 숫자가 아니면 `min` 부터 시작한다(빈 칸에서 ▲▼ 아무거나 → `min`).
 *   - 끝에 닿으면 해당 버튼이 비활성된다(`min` 이하에서 ▼, `max` 이상에서 ▲).
 *   - ⚠️ 잘못된 값(`min=1` 인데 `0`)에서도 ▲ 를 누르면 유효 범위로 올라온다. 그 칸이 왜 잘못됐는지
 *     알리는 일은 호출부 안내 문구 소관이다 — 이 컴포넌트는 입력을 막지 않는다.
 *
 * **Props**
 * - `value` / `onChange(next: string)` — 완전 controlled. 내부 state 없음.
 * - `min`(기본 1) · `max`(선택) · `step`(기본 1)
 * - `disabled` · `title` · `ariaLabel` — 라벨이 화면에 없는 격자 칸이면 `ariaLabel` 을 준다.
 * - `className` — **폭 등 레이아웃만**(`w-24`). 테두리·여백 재정의 ❌.
 *
 * **사용 예제**
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
 * ⚠️ ▲▼ 는 탭 순서에서 빠진다(`tabIndex={-1}`) — 수량 칸이 여러 개인 격자에서 탭이 칸→칸으로
 *    흐르게 하려는 것이다. 키보드 사용자는 입력칸에서 ↑↓ 로 같은 일을 한다.
 * ❌ 재고수량처럼 `min=0` 이 뜻을 갖는 칸에 그대로 쓰지 말 것 — `min` 을 명시해 넘긴다.
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
        'inline-flex items-stretch overflow-hidden rounded border border-gray-300 bg-white focus-within:ring-2 focus-within:ring-blue-500',
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
