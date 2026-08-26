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
 * 저장/전송할 상품정보제공고시 = **선택된 품목군(groupName)의 고시만**(옵션-소유 고시는 옵션별로
 * 저장하므로 여기서 제외). 사용자가 하나의 품목군을 골라 그 그룹만 마켓에 전송한다(62 이전 UX).
 */
export function noticesToSubmit(
  notices: CategoryNotice[],
  noticeValues: Record<string, string>,
  noticeGroup: string | null,
): Record<string, string> {
  const masterNotices = notices.filter((n) => !isOptionNotice(n));
  const group = resolveNoticeGroup(masterNotices, noticeValues, noticeGroup);
  return noticesForGroup(masterNotices, noticeValues, group);
}

/**
 * True when a SCHEMA-required option-owned attribute (개당 용량/중량·수량) is still missing for
 * this option. 필수 여부는 오직 카테고리 스키마의 `required` 플래그(쿠팡 메타)만 따른다 — 프론트가
 * 이름으로 강제하지 않는다. 상품정보제공고시(notice)는 옵션 레벨에서 강제하지 않는다(쿠팡은 카테고리별
 * 상이 + "상세페이지 참조" 허용, 프론트 정적 템플릿엔 필드별 required 플래그 없음). Weight/volume
 * pairs are one-of (either required side satisfied).
 */
export function computeMissingOptionRequired(
  attributes: CategoryAttribute[],
  optAttrValues: Record<string, string>,
  // 선택 채널이 옵션-소유 속성을 요구하지 않으면(hideCategoryAttrs) 옵션 필수 없음 → 조기 반환.
  hideCategoryAttrs = false,
): boolean {
  if (hideCategoryAttrs) return false;
  const optionAttributes = attributes.filter((a) => isOptionField(a.name));
  const { pairs, singles } = pairMeasureAttributes(optionAttributes);
  return (
    singles.some((a) => a.required && !(optAttrValues[a.name] ?? '').trim()) ||
    pairs.some((p) => isPairRequired(p) && !pairFilled(p, optAttrValues))
  );
}
