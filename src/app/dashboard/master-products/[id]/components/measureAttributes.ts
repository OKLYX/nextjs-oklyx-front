// 중량/용량 either-or 페어링 — 백엔드가 동적으로 내려주는 필수속성(CategoryAttribute) 중
// "개당 중량"·"개당 용량" 처럼 단위만 다른 한 쌍을 감지해 택1 입력으로 묶기 위한 순수 헬퍼.
//
// 배경: 쿠팡 category-related-metas 는 중량/용량을 별도 attributeTypeName 으로 내려주고 둘 다
// MANDATORY 일 수 있으나, 상품 형태(고체=중량, 액체=용량)상 실제로는 하나만 기재한다.
// 페어를 감지해 "구분(중량/용량) 선택 + 값 1개" 로 렌더하고, 검증도 '둘 중 하나' 로 완화한다.

import type { CategoryAttribute } from '@/domain/entities/MasterProductEntity';

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
