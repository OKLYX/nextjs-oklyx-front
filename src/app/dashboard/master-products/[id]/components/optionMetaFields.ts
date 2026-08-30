// Which category required-attributes / notice fields are OWNED BY THE OPTION, not the master.
//
// 개당 용량/중량·수량 은 옵션(30포/60포)마다 물리적으로 다르므로 마스터에서는 입력하지 않고
// 각 옵션에서 직접 설정한다(사용자 결정 2026-08-26). 나머지 속성/고시는 마스터 공통값.
// 크기(크기 토큰)는 옵션 대상에서 제외.
//
// 이 술어는 두 방향으로 쓰인다:
// - 옵션(CategoryMetaOverrideFields): isOption* == true 인 필드만 노출.
// - 마스터(CategoryMetaFields / computeMissingRequired): isOption* == true 인 필드는 제외.

import type { CategoryAttribute, CategoryNotice } from '@/domain/entities/MasterProductEntity';

const OPTION_FIELD_TOKENS = ['수량', '용량', '중량', '무게', '부피'];
const HANGUL = /[가-힣]/;

// A field name names an option-owned physical concept (용량/중량/수량, incl. 무게/부피).
//
// ⚠️ 부분문자열이 아니라 **어절 경계**로 판정한다: 토큰이 이름 끝이거나 뒤 문자가 한글이 아닐 때만
// 계량어로 본다. 이래야 "대용량식품"(용량+식품 = 식품 분류, 개당 물리치 아님)을 걸러내면서
// "개당 용량"·"내용량"·"총 수량"·"포장단위별 수량" 은 그대로 잡는다. 필수 여부는 여기서 정하지
// 않는다(스키마 required 플래그가 담당) — 이 술어는 마스터/옵션 배치만 가른다.
//
// hasBoundaryToken 은 그 어절 경계 규칙 **1벌**을 토큰 단위로 노출한다(101). isOptionField 는
// 토큰 OR 이라 "수량 ∩ 계량" 같은 교집합 판정에 쓸 수 없어서 — 계량 고시 판정(optionNoticeCompose)
// 과 계량 속성 지목(measureAttributes)이 같은 경계 규칙을 재사용한다.
/** 이름이 토큰을 **어절 경계**로 포함하는가(`대용량식품` 배제, `개당 용량`·`내용량` 포함). */
export function hasBoundaryToken(name: string, token: string): boolean {
  let idx = name.indexOf(token);
  while (idx !== -1) {
    const after = name[idx + token.length];
    if (after === undefined || !HANGUL.test(after)) return true; // 어절 끝 / 비-한글 경계
    idx = name.indexOf(token, idx + 1);
  }
  return false;
}

export function isOptionField(name: string): boolean {
  return OPTION_FIELD_TOKENS.some((t) => hasBoundaryToken(name, t));
}

// A category attribute belongs to the option layer (weight/volume/quantity).
export function isOptionAttribute(a: CategoryAttribute): boolean {
  return isOptionField(a.name);
}

// A backend notice is option-owned when its key names a whitelisted physical concept
// (용량/중량/수량 등). 백엔드 key === label = 한글 개념어 → isOptionField(notice.key).
export function isOptionNotice(notice: CategoryNotice): boolean {
  return isOptionField(notice.key);
}

/**
 * 구성상품 수량 합을 넣어도 되는 "수량" 필드인가 = **자동채움이 소유하는 수량 속성**.
 *
 * ⚠️ 이름에 "수량" 이 들었다고 전부 채우면 안 된다 — 쿠팡 카테고리는 `수량`·`총 수량` 과
 * **`개당 수량`**(낱개 1개에 든 개수)을 **별개 속성**으로 준다(기타스낵 72900 · 72882 실측).
 * `개당 수량` 에 구성상품 수량 합을 넣으면 틀린 값이 마켓까지 간다. 개당 값은 물품에서 도출할
 * 수도 없으므로(물품은 `netContent` 만 가진다) 사용자 입력으로 남긴다.
 *
 * 🔴 **화면(읽기 전용 렌더)과 자동채움(값 주입)이 이 술어 하나를 공유**해야 한다 — 갈라지면
 * "잠겼는데 아무도 안 채우는" 칸이나 "손으로 고쳐도 덮어써지는" 칸이 생긴다.
 */
export function isTotalQuantityName(name: string): boolean {
  return name.includes('수량') && !name.includes('개당');
}
