import { SOURCE_ZONE } from '@/domain/entities/DetailTemplateEntity';
import type { DetailContentUseCase } from '@/application/usecases/DetailContentUseCase';
import type { DetailImageGroupUseCase } from '@/application/usecases/DetailImageGroupUseCase';
import type { ImageField, ImageFieldFilter } from './MasterImagePool';

/**
 * `MasterImagePool` 의 필드 목록 도출 (마스터 생성 모달 + 마스터 상세 [이미지] 섹션 공용).
 * File: src/app/dashboard/master-products/components/masterImageFields.ts
 *
 * **용도**: 대표사진 + 상세 이미지 그룹 카탈로그를 하나의 평면 필드 목록으로 만들어 준다.
 * - `fields` = 대표사진(`SOURCE_ZONE`, 항상 첫 항목) + **카탈로그 그룹 전체**(key=code, label=name, 카탈로그 sortOrder 순).
 *   템플릿이 안 쓰는 그룹도 포함된다 — 그게 "공용 목록"의 의미다(특정 템플릿만 보려면 필터를 쓴다).
 *   그룹은 템플릿을 가로질러 공유되므로 같은 칸이 템플릿 수만큼 반복되지 않는다.
 * - `fieldFilters` = **필터 전용** 묶음(대표사진 1건 + 템플릿별 1건). 렌더 순서는 언제나 `fields` 가 결정한다.
 * - `requiredZoneKeys` = **기본 템플릿만**. 생성 모달의 제출 게이트 전용이고, 상세는 쓰지 않는다.
 * - 카탈로그/템플릿 조회 실패 = 비차단 → 대표사진만 반환.
 *
 * **필수 사용 규칙**:
 * - `MasterImagePool` 에 `fields`/`fieldFilters` 를 주는 쪽(부모 컨테이너)은 이 함수를 쓴다.
 *   직접 `listTemplates()` 를 돌며 zone 을 모으는 코드를 새로 쓰지 말 것(도출 규칙이 갈라진다).
 * - ⚠️ 순수 함수가 아니다(서버 호출) → `useEffect` 안에서 호출하고 결과를 state 에 담는다.
 * - ⚠️ 호출처는 **생성 모달 · 마스터 상세 두 곳뿐**이다.
 *   `StructuredDataPane` 은 **단일 템플릿** 파생이라 여기로 바꾸면 안 된다(요구가 다르다).
 *
 * @example
 * useEffect(() => {
 *   let alive = true;
 *   void (async () => {
 *     const { fields, fieldFilters } = await deriveMasterImageFields(detailUseCase, groupUseCase);
 *     if (alive) { setImageFields(fields); setImageFieldFilters(fieldFilters); }
 *   })();
 *   return () => { alive = false; };
 * }, [detailUseCase, groupUseCase]);
 */
export async function deriveMasterImageFields(
  detailUseCase: DetailContentUseCase,
  groupUseCase: DetailImageGroupUseCase,
): Promise<{
  fields: ImageField[];
  fieldFilters: ImageFieldFilter[];
  requiredZoneKeys: string[];
}> {
  // Cover photo is a template-independent filter, always first.
  const filters: ImageFieldFilter[] = [{ label: '대표사진', keys: [SOURCE_ZONE], kind: 'cover' }];
  try {
    const [groups, templates] = await Promise.all([
      groupUseCase.list(),
      detailUseCase.listTemplates(),
    ]);
    for (const t of templates) {
      const zoneKeys = (t.blocks ?? [])
        .filter((b) => b.type === 'imageZone' && b.bind)
        .map((b) => b.bind as string);
      if (zoneKeys.length > 0) {
        filters.push({ label: t.name + (t.isDefault ? ' (기본)' : ''), keys: zoneKeys, kind: 'detail' });
      }
    }
    return {
      // Order is the catalog's sortOrder (the backend sorts) — never re-sort by template.
      fields: [
        { key: SOURCE_ZONE, label: '대표사진' },
        ...groups.map((g) => ({ key: g.code, label: g.name })),
      ],
      fieldFilters: filters,
      requiredZoneKeys: (templates.find((t) => t.isDefault)?.blocks ?? [])
        .filter((b) => b.type === 'imageZone' && b.bind)
        .map((b) => b.bind as string),
    };
  } catch {
    return {
      fields: [{ key: SOURCE_ZONE, label: '대표사진' }],
      fieldFilters: filters,
      requiredZoneKeys: [],
    };
  }
}
