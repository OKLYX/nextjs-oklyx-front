// Pure required-field validation shared by the detail save gate and the create-modal
// submit gate — kept separate from the display-only "필수 항목만 보기" filter.
//
// Extracted from CategoryMetaPanel so the detail container and the create modal apply
// an identical rule. The presentation component (CategoryMetaFields) carries no validation.
//
// 개당 용량/중량·수량 은 옵션 소유(각 옵션이 설정)이므로 마스터 게이트에서는 제외하고,
// 옵션 게이트(computeMissingOptionRequired)에서만 검증한다.

import type { CategoryAttribute, CategoryNotice } from '@/domain/entities/MasterProductEntity';
import {
  isNoticeRefAll,
  noticeGroupName,
  noticesForGroup,
  resolveNoticeGroup,
} from './noticeTemplates';
import {
  derivedUnit,
  isPairRequired,
  pairMeasureAttributes,
  type MeasurePair,
} from './measureAttributes';
import { isOptionField, isOptionNotice } from './optionMetaFields';

const pairFilled = (p: MeasurePair, values: Record<string, string>): boolean => {
  const u = derivedUnit(p, values);
  const name = u === '용량' ? p.volume.name : u === '중량' ? p.weight.name : '';
  return !!name && (values[name] ?? '').trim().length > 0;
};

/**
 * True when any MASTER-owned required field is still missing. Excludes the option-owned
 * physical fields (용량/중량/수량) — those are validated per option. A weight/volume pair is
 * satisfied when the chosen unit's value is filled (one-of).
 */
export function computeMissingRequired(
  attributes: CategoryAttribute[],
  attrValues: Record<string, string>,
  notices: CategoryNotice[],
  noticeValues: Record<string, string>,
  // 선택 채널이 카테고리 속성을 요구하지 않으면(hideCategoryAttrs) 속성부는 필수검증에서 스킵하고
  // 고시부만 판정한다(값은 그대로 보존).
  hideCategoryAttrs = false,
  // 상품정보제공고시 = 선택된 품목군(groupName)만 전송/검증 대상. null 이면 실효 그룹을 해석한다.
  noticeGroup: string | null = null,
): boolean {
  const masterAttributes = attributes.filter((a) => !isOptionField(a.name));
  const { pairs, singles } = pairMeasureAttributes(masterAttributes);
  const masterNotices = notices.filter((n) => !isOptionNotice(n));
  // Only the selected notice group is submitted → validate that group's required fields only.
  const group = resolveNoticeGroup(masterNotices, noticeValues, noticeGroup);
  const groupNotices = masterNotices.filter((n) => noticeGroupName(n) === group);
  // "전체 상세페이지 참조" 면 그 그룹의 모든 고시 필드가 채워진 것으로 본다.
  const refAll = isNoticeRefAll(groupNotices, noticeValues);
  const missingAttr =
    !hideCategoryAttrs &&
    (singles.some((a) => a.required && !(attrValues[a.name] ?? '').trim()) ||
      pairs.some((p) => isPairRequired(p) && !pairFilled(p, attrValues)));
  return (
    missingAttr ||
    (!refAll && groupNotices.some((n) => n.required && !(noticeValues[n.key] ?? '').trim()))
  );
}

/**
 * 저장 시 실제로 전송되는 품목군(실효 그룹). 사용자가 select 를 건드리지 않아 state 가 `null` 이어도
 * 폴백까지 반영한 **하나의 값**을 돌려준다 — 저장 payload 의 `noticeGroup` 과 `noticesToSubmit` 이
 * 이 값을 함께 써야 "보낸 값"과 "보낸 그룹"이 어긋나지 않는다(따로 계산 금지).
 *
 * ⚠️ 품목군이 없는 스키마의 `''` 도 그대로 돌려준다 — blank→null 정규화는 백엔드(91) 몫이다.
 */
export function submitNoticeGroup(
  notices: CategoryNotice[],
  noticeValues: Record<string, string>,
  noticeGroup: string | null,
): string {
  return resolveNoticeGroup(
    notices.filter((n) => !isOptionNotice(n)),
    noticeValues,
    noticeGroup,
  );
}

/**
 * 저장/전송할 상품정보제공고시 = **선택된 품목군(groupName)의 고시만**(옵션-소유 고시는 옵션별로
 * 저장하므로 여기서 제외). 사용자가 하나의 품목군을 골라 그 그룹만 마켓에 전송한다(62 이전 UX).
 */
export function noticesToSubmit(
  notices: CategoryNotice[],
  noticeValues: Record<string, string>,
  noticeGroup: string | null,
): Record<string, string> {
  const masterNotices = notices.filter((n) => !isOptionNotice(n));
  const group = submitNoticeGroup(notices, noticeValues, noticeGroup);
  return noticesForGroup(masterNotices, noticeValues, group);
}

/**
 * True when a SCHEMA-required OPTION-OWNED field is still missing for this option — 속성(개당
 * 용량/중량·수량) **과 상품정보제공고시** 둘 다. 필수 여부는 오직 카테고리 스키마의 `required`
 * 플래그(쿠팡 메타)만 따른다 — 프론트가 이름으로 강제하지 않는다.
 *
 * 고시 판정은 백엔드 96(CoupangListingAdapter.validateRegistrable)과 **같은 규칙**이다:
 * 선택된 품목군(noticeGroup)의 옵션-소유 required 고시를 `merge(마스터, 옵션)` 기준으로 검사한다
 * (옵션 값이 비면 마스터 값 상속 = 충족). 규칙이 어긋나면 서버가 통과시킬 것을 화면이 막는다.
 *
 * ⚠️ 혼합구성(hideCategoryAttrs)은 **속성만** 스킵한다 — 그 경우에도 고시는 마켓에 전송되므로
 * 고시 검증은 계속한다(96: "AB only skips the ATTRIBUTE half").
 *
 * Weight/volume pairs are one-of (either required side satisfied).
 */
export function computeMissingOptionRequired(
  attributes: CategoryAttribute[],
  optAttrValues: Record<string, string>,
  // 선택 채널이 옵션-소유 속성을 요구하지 않으면(hideCategoryAttrs) 속성부만 스킵.
  hideCategoryAttrs = false,
  // ⚠️ 객체 1개로 받는다 — optNoticeValues 와 masterNoticeValues 가 같은 타입이라 위치 인자로
  // 풀면 자리를 바꿔 넣어도 TS 가 못 잡는다(게이트가 조용히 뒤집힌다).
  noticeCtx?: {
    notices: CategoryNotice[];
    optNoticeValues: Record<string, string>;
    masterNoticeValues?: Record<string, string>; // 빈값=상속 → 마스터 값도 충족으로 본다
    noticeGroup: string | null; // 실효 그룹(submitNoticeGroup 결과)
  },
): boolean {
  const optionAttributes = attributes.filter((a) => isOptionField(a.name));
  const { pairs, singles } = pairMeasureAttributes(optionAttributes);
  const missingAttrs = hideCategoryAttrs
    ? false
    : singles.some((a) => a.required && !(optAttrValues[a.name] ?? '').trim()) ||
      pairs.some((p) => isPairRequired(p) && !pairFilled(p, optAttrValues));
  const missingNotices = !noticeCtx
    ? false
    : noticeCtx.notices
        .filter(isOptionNotice)
        .filter((n) => !noticeCtx.noticeGroup || noticeGroupName(n) === noticeCtx.noticeGroup)
        .some(
          (n) =>
            n.required &&
            !(noticeCtx.optNoticeValues[n.key] ?? '').trim() &&
            // ⚠️ 마스터 폴백 필수: diffOverride 가 마스터와 같은 값인 override 를 payload 에서
            // 떨어뜨리므로, 폴백이 없으면 "저장 → 재진입 → 빈 칸 → 저장 차단"이 반복된다.
            !((noticeCtx.masterNoticeValues ?? {})[n.key] ?? '').trim(),
        );
  return missingAttrs || missingNotices;
}
