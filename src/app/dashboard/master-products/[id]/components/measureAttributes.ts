// 중량/용량 either-or 페어링 — 백엔드가 동적으로 내려주는 필수속성(CategoryAttribute) 중
// "개당 중량"·"개당 용량" 처럼 단위만 다른 한 쌍을 감지해 택1 입력으로 묶기 위한 순수 헬퍼.
//
// 배경: 쿠팡 category-related-metas 는 중량/용량을 별도 attributeTypeName 으로 내려주고 둘 다
// MANDATORY 일 수 있으나, 상품 형태(고체=중량, 액체=용량)상 실제로는 하나만 기재한다.
// 페어를 감지해 "구분(중량/용량) 선택 + 값 1개" 로 렌더하고, 검증도 '둘 중 하나' 로 완화한다.

import type { CategoryAttribute } from '@/domain/entities/MasterProductEntity';
import { hasBoundaryToken, isOptionField } from './optionMetaFields';

const WEIGHT_TOKENS = ['중량', '무게'];
const VOLUME_TOKENS = ['용량', '부피'];

export interface MeasurePair {
  base: string; // 단위 토큰 제거한 공통 접두(그룹 식별자), 예: "개당"
  weight: CategoryAttribute; // 중량 쪽 속성(값은 attrValues[weight.name])
  volume: CategoryAttribute; // 용량 쪽 속성(값은 attrValues[volume.name])
}

export interface PairedAttributes {
  pairs: MeasurePair[];
  singles: CategoryAttribute[]; // 페어에 묶이지 않은 나머지
}

function hasToken(name: string, tokens: string[]): boolean {
  return tokens.some((t) => name.includes(t));
}

// 단위 토큰을 모두 제거하고 공백 제거 → 그룹 식별용 정규화 문자열.
function stripUnits(name: string): string {
  let s = name;
  for (const t of [...WEIGHT_TOKENS, ...VOLUME_TOKENS]) s = s.split(t).join('');
  return s.replace(/\s+/g, '');
}

/**
 * attributes 를 중량/용량 페어와 나머지(singles)로 분리. 원래 순서를 최대한 보존
 * (페어는 중량 쪽이 등장한 위치에 배치).
 */
export function pairMeasureAttributes(attributes: CategoryAttribute[]): PairedAttributes {
  const used = new Set<string>();
  const pairs: MeasurePair[] = [];

  for (const a of attributes) {
    if (used.has(a.name)) continue;
    // 중량 토큰만 있고 용량 토큰은 없는 속성을 페어 시작점으로.
    if (!hasToken(a.name, WEIGHT_TOKENS) || hasToken(a.name, VOLUME_TOKENS)) continue;
    const base = stripUnits(a.name);
    const volume = attributes.find(
      (b) =>
        !used.has(b.name) &&
        b.name !== a.name &&
        hasToken(b.name, VOLUME_TOKENS) &&
        !hasToken(b.name, WEIGHT_TOKENS) &&
        stripUnits(b.name) === base,
    );
    if (volume) {
      pairs.push({ base, weight: a, volume });
      used.add(a.name);
      used.add(volume.name);
    }
  }

  const singles = attributes.filter((a) => !used.has(a.name));
  return { pairs, singles };
}

// 페어가 필수인가(둘 중 하나라도 MANDATORY 면 필수 그룹).
export function isPairRequired(p: MeasurePair): boolean {
  return p.weight.required || p.volume.required;
}

// 저장값에서 현재 선택 단위 추론(중량 값 있으면 중량, 용량 값 있으면 용량, 없으면 '').
export function derivedUnit(p: MeasurePair, values: Record<string, string>): '중량' | '용량' | '' {
  if ((values[p.weight.name] ?? '').trim()) return '중량';
  if ((values[p.volume.name] ?? '').trim()) return '용량';
  return '';
}

// ─── 101: 계량 속성 지목 / 읽기 ──────────────────────────────────────────────
// 물품에서 도출한 `개당 중량/용량` 을 **어느 속성에** 넣을지 정하고, 반대로 현재 저장/입력된
// 계량값을 **한 곳에서** 읽는다. 어절 경계 판정은 optionMetaFields 의 규칙 1벌을 재사용한다.

const AXIS_TOKENS: Record<'중량' | '용량', string[]> = {
  중량: WEIGHT_TOKENS,
  용량: VOLUME_TOKENS,
};

// 이름이 그 축의 토큰을 어절 경계로 갖는가(반대 축 토큰은 없어야 한다).
function isAxisName(name: string, axis: '중량' | '용량'): boolean {
  const other = axis === '중량' ? VOLUME_TOKENS : WEIGHT_TOKENS;
  return (
    AXIS_TOKENS[axis].some((t) => hasBoundaryToken(name, t)) &&
    !other.some((t) => hasBoundaryToken(name, t))
  );
}

/**
 * 축에 해당하는 계량 속성 이름 1개. pair 면 그 축의 이름, pair 가 없으면 **singles 중** 같은 축
 * 토큰을 가진 것(예: 짝 없는 `내용량`). 없으면 ''.
 * ⚠️ pair 만 보면 안 된다 — 카테고리가 중량/용량 중 하나만 내려주면 pair 가 생기지 않는다.
 */
export function findMeasureAttrName(
  attributes: CategoryAttribute[],
  axis: '중량' | '용량',
): string {
  const optionAttrs = attributes.filter((a) => isOptionField(a.name));
  const { pairs, singles } = pairMeasureAttributes(optionAttrs);
  if (pairs.length > 0) {
    const p = pairs[0];
    return axis === '중량' ? p.weight.name : p.volume.name;
  }
  return singles.find((a) => isAxisName(a.name, axis))?.name ?? '';
}

/**
 * 이 카테고리에 **조합 소스가 되는 계량 속성이 있는가**(중량 또는 용량 축).
 * 계량 고시(`포장단위별 …용량(중량),수량`)를 자동 조합으로 소유할지 판정하는 단일 기준 —
 * 화면(읽기 전용 렌더)과 자동채움(덮어쓰기 여부)이 **같은 함수**를 봐야 갈라지지 않는다.
 */
export function hasMeasureAttr(attributes: CategoryAttribute[]): boolean {
  return (
    findMeasureAttrName(attributes, '중량') !== '' || findMeasureAttrName(attributes, '용량') !== ''
  );
}

/** 속성 이름이 어느 축인가('중량'|'용량'|''). 짝 없는 single 의 단위 목록을 고르는 데 쓴다. */
export function axisOfAttrName(name: string): '중량' | '용량' | '' {
  if (isAxisName(name, '중량')) return '중량';
  if (isAxisName(name, '용량')) return '용량';
  return '';
}

/**
 * 현재 저장/입력된 계량값(축 무관, 계량 속성 중 첫 비어있지 않은 값). 없으면 ''.
 * 저장값이 도출값을 이긴다는 D7 규칙을 호출부가 `readMeasureValue(...) || deriveMeasured(...)`
 * 한 줄로 쓰게 하는 읽기 전용 헬퍼다.
 */
export function readMeasureValue(
  attributes: CategoryAttribute[],
  values: Record<string, string>,
): string {
  // 🔴 **읽는 칸 = 쓰는 칸**. 자동채움이 값을 넣는 대상(`findMeasureAttrName`)과 **정확히 같은
  // 속성**만 읽는다 = 화면의 계량 셀(페어가 있으면 pairs[0], 없으면 같은 축 single)이 쓰는 칸.
  // ⚠️ 이름 휴리스틱(`개당` 포함 여부)으로 고르면 안 된다: 카테고리에 따라 **필수 페어가 `최소
  // 중량/최소 용량`이고 `개당 중량/개당 용량`은 선택으로 따로 존재**한다(실측 72882). 그때 `개당`
  // 이름만 읽으면 화면에 보이지도 않는 빈 선택 속성을 읽고 → 고시가 물품 도출값으로 되돌아간다.
  // ⚠️ 같은 이유로 `총 중량`·`총 용량` 도 자동으로 배제된다(페어를 이루지 못해 pairs[0] 이 아님).
  const names = [
    findMeasureAttrName(attributes, '중량'),
    findMeasureAttrName(attributes, '용량'),
  ].filter((n) => n !== '');
  for (const n of names) {
    const v = (values[n] ?? '').trim();
    if (v) return v;
  }
  return '';
}
