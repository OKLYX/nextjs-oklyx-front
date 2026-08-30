// 계량 고시 판정 + 조합 (101).
//
// 쿠팡 고시 `포장단위별 내용물의 용량(중량), 수량` 은 **용량(중량)과 수량 둘 다** 요구하는데
// 종전에는 수량만 넣어 `1` 을 보냈다. 계량값과 수량을 한 문자열로 조합한다.
//
// ⚠️ 형식 리터럴(`개`)은 이 파일 밖으로 새지 않게 한다 — 쿠팡 수용 여부가 미검증이라
// 틀린 것으로 판명되면 composeMeasureNotice 한 곳만 고쳐야 한다.

import { hasBoundaryToken } from './optionMetaFields';

const MEASURE_TOKENS = ['용량', '중량', '무게', '부피'];

/** 계량 고시인가 = 키가 `수량` **과** (용량|중량|무게|부피) 중 하나를 **둘 다** 어절 경계로 가진다. */
export function isMeasureNotice(key: string): boolean {
  return (
    hasBoundaryToken(key, '수량') && MEASURE_TOKENS.some((t) => hasBoundaryToken(key, t))
  );
}

/**
 * `${계량값} ${수량}개`. 계량값이 비면 '' (조합 불가 → 채우지 않는다).
 * ⚠️ `measured` 는 **이미 단위가 붙은 값**(`320g`)을 받는다 — 여기서 다시 붙이지 않는다(`320gg` 방지).
 * ⚠️ 계량값이 비었을 때 수량만으로 `" 1개"` 같은 반쪽 값을 만들면 97 필수 게이트가 통과시킨다.
 */
export function composeMeasureNotice(measured: string, qty: number): string {
  const m = (measured ?? '').trim();
  if (!m || qty <= 0) return '';
  return `${m} ${qty}개`;
}
