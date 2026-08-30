// 물품(Product) 계량값 → 옵션 `개당 중량/용량` 도출 (101).
//
// 배경: `개당 중량/용량` 은 이미 구성상품 물품이 `netContent`/`netContentUnit` 으로 갖고 있다.
// 옵션에서 손으로 다시 입력하면 값이 어긋난다(dev: 물품 320 G ↔ 옵션 손입력 100).
// 여기 헬퍼들은 **상태를 읽지 않는 순수 함수** — 호출부가 계산해 속성 주입과 고시 조합에
// **같은 값**을 넘긴다(속성 `320kg` ↔ 고시 `320g 1개` 어긋남 원천 차단).

import type { MasterComponent } from '@/domain/entities/MasterProductEntity';

/**
 * 물품 저장 단위(G/KG/L/ML) → 마켓 표기(g/kg/l/ml).
 * 물품 폼 select 의 option label 과 **동일한 표**다
 * (`products/[id]/components/ProductEditForm.tsx` `<option value="G">g</option>` …).
 * ⚠️ 여기에 없는 단위는 도출 대상이 아니다(축 판정 불가) — 임의로 늘리지 말 것.
 */
export const MARKET_UNIT: Record<string, string> = { G: 'g', KG: 'kg', L: 'l', ML: 'ml' };

const MASS_UNITS = new Set(['G', 'KG']);

/** 질량 계열인가(→ MeasurePair 의 weight 쪽). L/ML 이면 false(용량 쪽). */
export function isMassUnit(u: string): boolean {
  return MASS_UNITS.has((u ?? '').trim().toUpperCase());
}

/**
 * 숫자만이면 단위를 붙이고, 이미 단위가 있으면 그대로 둔다.
 * 백엔드 `CoupangListingAdapter.withUnit` 과 동형 — 저장값이 숫자뿐이면 어댑터가 카테고리
 * `basicUnit`(대개 g)을 붙이므로 `500`(KG) 이 조용히 `500g` 이 된다. 저장 시점에 단위를
 * 붙여 그 경로를 막는다.
 * ⚠️ 빈 값이면 반드시 `''` — `kg` 만 저장되면 97 필수 게이트가 "채워짐" 으로 오판한다.
 */
export function withUnit(value: string, unit: string): string {
  const v = (value ?? '').trim();
  if (!v) return '';
  const u = (unit ?? '').trim();
  if (!u) return v;
  return /^[0-9]+(\.[0-9]+)?$/.test(v) ? `${v}${u}` : v;
}

// 도출 조건 3개(AND)를 만족하는 단일 구성상품을 돌려준다. 아니면 null.
// - components 가 정확히 1종 (2종 이상 = 어느 물품 기준인지 모호 · 쿠팡 AB 는 속성 자체를 안 보낸다)
// - netContent 가 비어있지 않음
// - netContentUnit 이 MARKET_UNIT 에 있음 (단위 없으면 중량/용량 축 판정 자체가 불가)
function soleMeasuredComponent(components: MasterComponent[]): MasterComponent | null {
  if (components.length !== 1) return null;
  const c = components[0];
  const value = (c.netContent ?? '').trim();
  const unit = (c.netContentUnit ?? '').trim().toUpperCase();
  if (!value || !MARKET_UNIT[unit]) return null;
  return c;
}

/**
 * D1 도출: 구성상품 1종 + netContent + 매핑 가능한 단위, 3개 다 만족할 때만 `320g`. 아니면 ''.
 * ⚠️ 순수 함수(상태 미참조) — 호출부가 계산해 속성 주입과 고시 조합에 **같은 값**을 쓴다.
 */
export function deriveMeasured(components: MasterComponent[]): string {
  const c = soleMeasuredComponent(components);
  if (!c) return '';
  const unit = MARKET_UNIT[(c.netContentUnit ?? '').trim().toUpperCase()];
  return withUnit((c.netContent ?? '').trim(), unit);
}

/** 도출된 축('중량'|'용량'|''). components 가 도출 조건을 못 채우면 ''. */
export function derivedAxis(components: MasterComponent[]): '중량' | '용량' | '' {
  const c = soleMeasuredComponent(components);
  if (!c) return '';
  return isMassUnit(c.netContentUnit ?? '') ? '중량' : '용량';
}

// ─── 옵션 계량 입력 = 숫자 + 단위 select (사용자 결정 2026-08-30) ────────────────
// 옵션에서 `320g` 를 통째로 타이핑하게 두지 않는다. 물품(99)이 값과 단위를 나눠 갖는 이유가
// 이것이다 — 옵션도 **숫자 입력칸 + 단위 select** 로 받고, 저장 시 하나로 합친다(`320g`).
// ⚠️ 단위 목록은 여기 MARKET_UNIT 한 표에서만 파생한다(물품 폼 select 와 같은 표).
// 임의로 `mg`·`L` 같은 값을 늘리지 말 것 — 물품 쪽과 어긋나면 어느 쪽이 진짜인지 판정 불가.

/** 축별 선택 가능한 단위(표기형). 중량 → g·kg, 용량 → l·ml. */
export const MEASURE_UNITS_BY_AXIS: Record<'중량' | '용량', string[]> = {
  중량: Object.keys(MARKET_UNIT)
    .filter((code) => isMassUnit(code))
    .map((code) => MARKET_UNIT[code]),
  용량: Object.keys(MARKET_UNIT)
    .filter((code) => !isMassUnit(code))
    .map((code) => MARKET_UNIT[code]),
};

export interface SplitMeasured {
  amount: string; // 숫자부 ('' 가능)
  unit: string; // 표기형 단위 ('' = 미지정)
  parsed: boolean; // false = `숫자+단위` 로 못 쪼갬(레거시 자유입력) → 원문 그대로 편집
}

const MEASURED_RE = /^\s*([0-9]+(?:\.[0-9]+)?)\s*([a-zA-Z]*)\s*$/;

/**
 * 저장값(`320g`)을 숫자·단위로 분해. 빈 값은 `parsed: true` + 둘 다 ''.
 * ⚠️ 못 쪼개는 값(`약 300g` 같은 레거시 자유입력)은 `parsed: false` — 호출부는 이때
 * **원문 텍스트 입력**으로 폴백해야 한다. 숫자칸에 빈 값을 보이면 "화면은 비었는데 저장값은
 * 차 있는" 상태가 되어 97 게이트가 통과시킨다(101 이 없애려던 바로 그 부류의 버그).
 */
export function splitMeasured(value: string): SplitMeasured {
  const v = (value ?? '').trim();
  if (!v) return { amount: '', unit: '', parsed: true };
  const m = MEASURED_RE.exec(v);
  if (!m) return { amount: v, unit: '', parsed: false };
  return { amount: m[1], unit: m[2].toLowerCase(), parsed: true };
}

/** 숫자·단위 → 저장값. 숫자가 비면 '' (단위만 저장되면 97 게이트가 오판한다). */
export function joinMeasured(amount: string, unit: string): string {
  return withUnit(amount, unit);
}

// 계량 숫자칸이 허용하는 입력. 정수·소수(`200`·`23.9`)와 **타이핑 중간 상태**(`23.`)까지 허용하되
// 그 외(문자·부호·지수표기·선행 소수점)는 키 입력 시점에 거부한다.
// ⚠️ 선행 소수점(`.9`)은 일부러 막는다 — 허용하면 저장값이 `withUnit` 의 숫자 판정을 통과하지 못해
// 단위가 안 붙고, 그 값은 다시 splitMeasured 로 못 쪼개져 레거시 폴백으로 떨어진다.
const AMOUNT_INPUT_RE = /^(\d+(\.\d*)?)?$/;

/** 계량 숫자칸에 그대로 넣어도 되는 입력인가(빈 값·`200`·`23.`·`23.9`). */
export function isAmountInput(value: string): boolean {
  return AMOUNT_INPUT_RE.test(value);
}

/**
 * 화면 입력(`23.`) → 저장용 숫자(`23`). 끝의 소수점은 **저장값에 남기지 않는다** —
 * 남기면 `withUnit` 이 단위를 못 붙이고(숫자 판정 실패) 단위 select 가 순간적으로 초기화된다.
 */
export function normalizeAmount(value: string): string {
  return value.endsWith('.') ? value.slice(0, -1) : value;
}
