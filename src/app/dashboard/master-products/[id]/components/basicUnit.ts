// Base-unit (쿠팡 basicUnit, backend 94) display helpers — pure, display-only.
//
// **용도**: 카테고리 속성 입력 옆에 단위(`g`/`ml`/`개`)를 표시해, 사용자가 `500` 인지 `500g` 인지
// 판단할 근거를 준다. 표시 전용 — 저장 값(`attrValues[name]`)에는 단위를 붙이지 않는다.
// **파일**: src/app/dashboard/master-products/[id]/components/basicUnit.ts
//
// **사용 예제**:
//   {unitSuffix(a) && <span className="ml-1 font-normal text-gray-400">{unitSuffix(a)}</span>}
//   <input placeholder={unitPlaceholder(a) || '값 입력'} />   // override 싱글 (기존 폴백 유지)
//   <input placeholder={unitPlaceholder(a)} />                // 마스터 싱글 (폴백 없음이 현행)
//
// ⚠️ 폴백 문구를 헬퍼에 굽지 말 것 — 호출부마다 현행 placeholder 가 다르다(마스터 싱글=없음,
//    override 싱글=`값 입력`, 페어=`구분 먼저 선택`). 헬퍼가 기본값을 들면 단위 없는 속성에
//    없던 placeholder 가 새로 생긴다. 폴백은 각 호출부가 `|| '기존 문구'` 로 정한다.
// ❌ 단위 문자열의 대소문자를 프론트에서 손보지 말 것 — 백엔드 실값 그대로 쓴다.

type UnitBearing = { basicUnit?: string | null };

// null/undefined/blank → '' (단위 없음 = 아무것도 그리지 않는다).
function unitOf(a?: UnitBearing): string {
  return a?.basicUnit?.trim() ?? '';
}

/** 라벨 접미: 단위가 있으면 `(g)`, 없으면 ''. */
export function unitSuffix(a?: UnitBearing): string {
  const u = unitOf(a);
  return u ? `(${u})` : '';
}

/** 입력 placeholder: 단위가 있으면 `단위: g`, 없으면 ''. */
export function unitPlaceholder(a?: UnitBearing): string {
  const u = unitOf(a);
  return u ? `단위: ${u}` : '';
}
