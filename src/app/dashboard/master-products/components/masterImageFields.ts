import { SOURCE_ZONE } from '@/domain/entities/DetailTemplateEntity';
import type { DetailContentUseCase } from '@/application/usecases/DetailContentUseCase';
import type { ImageField, ImageFieldGroup } from './MasterImagePool';

/**
 * `MasterImagePool` 의 필드 목록 도출 (마스터 생성 모달 + 마스터 상세 [이미지] 섹션 공용).
 * File: src/app/dashboard/master-products/components/masterImageFields.ts
 *
 * **용도**: 대표사진 + 상세 템플릿 imageZone 들을 하나의 필드 목록으로 만들어 준다.
 * - `fields` = 대표사진(`SOURCE_ZONE`, 항상 첫 항목) + **전 템플릿** imageZone bind 의 dedupe union.
 *   (마스터에 매핑된 이미지는 채널이 어떤 템플릿으로 해석되든 재사용되므로 union 이 맞다.)
 * - `fieldGroups` = 템플릿별 묶음(대표사진 그룹이 첫 항목) — 필드 카드가 소속 템플릿을 보여준다.
 * - `requiredZoneKeys` = **기본 템플릿만**. 생성 모달의 제출 게이트 전용이고, 상세는 쓰지 않는다.
 * - 템플릿 조회 실패 = 비차단 → 대표사진만 반환.
 *
 * **필수 사용 규칙**:
 * - `MasterImagePool` 에 `fields`/`fieldGroups` 를 주는 쪽(부모 컨테이너)은 이 함수를 쓴다.
 *   직접 `listTemplates()` 를 돌며 zone 을 모으는 코드를 새로 쓰지 말 것(도출 규칙이 갈라진다).
 * - ⚠️ 순수 함수가 아니다(서버 호출) → `useEffect` 안에서 호출하고 결과를 state 에 담는다.
 * - ⚠️ 호출처는 **생성 모달 · 마스터 상세 두 곳뿐**이다.
 *   `StructuredDataPane` 은 **단일 템플릿** 파생이라 여기로 바꾸면 안 된다(요구가 다르다).
 *
 * @example
 * useEffect(() => {
 *   let alive = true;
 *   void (async () => {
 *     const { fields, fieldGroups } = await deriveMasterImageFields(detailUseCase);
 *     if (alive) { setImageFields(fields); setImageFieldGroups(fieldGroups); }
 *   })();
 *   return () => { alive = false; };
 * }, [detailUseCase]);
 */
export async function deriveMasterImageFields(
  detailUseCase: DetailContentUseCase,
): Promise<{
  fields: ImageField[];
  fieldGroups: ImageFieldGroup[];
  requiredZoneKeys: string[];
}> {
  let zones: ImageField[] = [];
  let required: string[] = [];
  // Cover photo is a template-independent group, always first.
  const groups: ImageFieldGroup[] = [{ label: '대표사진', keys: [SOURCE_ZONE] }];
  try {
    const templates = await detailUseCase.listTemplates();
    const seen = new Set<string>();
    for (const t of templates) {
      const zoneKeys = (t.blocks ?? [])
        .filter((b) => b.type === 'imageZone' && b.bind)
        .map((b) => b.bind as string);
      if (zoneKeys.length > 0) {
        groups.push({ label: t.name + (t.isDefault ? ' (기본)' : ''), keys: zoneKeys });
      }
      for (const key of zoneKeys) {
        if (!seen.has(key)) {
          seen.add(key);
          zones.push({ key, label: key });
        }
      }
    }
    required = (templates.find((t) => t.isDefault)?.blocks ?? [])
      .filter((b) => b.type === 'imageZone' && b.bind)
      .map((b) => b.bind as string);
  } catch {
    zones = [];
    required = [];
  }
  return {
    fields: [{ key: SOURCE_ZONE, label: '대표사진' }, ...zones],
    fieldGroups: groups,
    requiredZoneKeys: required,
  };
}
