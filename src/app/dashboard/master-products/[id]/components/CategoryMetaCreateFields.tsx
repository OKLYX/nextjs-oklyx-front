'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Spinner } from '@/presentation/components/Spinner';
import { extractErrorMessage } from '@/infrastructure/utils/errorMessage';
import { MasterProductUseCase } from '@/application/usecases/MasterProductUseCase';
import { MasterProductRepositoryImpl } from '@/infrastructure/repositories/MasterProductRepositoryImpl';
import type { CategoryAttribute, CategoryNotice } from '@/domain/entities/MasterProductEntity';
import type { MeasurePair } from './measureAttributes';
import { CategoryMetaFields } from './CategoryMetaFields';

// Per-platform controlled value held by the parent create modal (metaByPlatform[platform]).
export interface CategoryMetaCreateValue {
  attrValues: Record<string, string>;
  noticeValues: Record<string, string>;
  // 선택된 상품정보제공고시 품목군(groupName). null = 실효 그룹(첫 그룹) 사용. 저장 시 이 그룹만 전송.
  noticeGroup?: string | null;
}

export const EMPTY_META_VALUE: CategoryMetaCreateValue = {
  attrValues: {},
  noticeValues: {},
  noticeGroup: null,
};

interface CategoryMetaCreateFieldsProps {
  categoryId: number | null; // leaf standard category picked in the create modal
  platform?: string; // default 'COUPANG'
  value: CategoryMetaCreateValue; // controlled by the parent modal
  onChange: (next: CategoryMetaCreateValue) => void;
  // Reports the loaded attribute + notice schema up so the parent's submit gate can validate.
  onSchemaLoad: (attributes: CategoryAttribute[], notices: CategoryNotice[]) => void;
  // 컨테이너(부모 모달)가 도출해 하달 — 속성부 숨김/스킵 (값 보존). 여기선 통과만.
  hideCategoryAttrs?: boolean;
}

/**
 * 카테고리 필수속성 / 고시 입력 — 마스터 추가(생성) 컨테이너 (masterId 없음).
 * File: src/app/dashboard/master-products/[id]/components/CategoryMetaCreateFields.tsx
 *
 * categoryId 로 getCategorySchema(스키마만) 로드(값은 부모 controlled state). notices 는 정적이라
 * 로드 불필요. 저장 버튼 없음(부모 모달이 생성 후 setCategoryAttributes 로 저장). categoryId/platform
 * 변경 시 스키마 재로드. COUPANG 외 탭은 입력은 허용하되 "값 저장은 후속" 안내(생성 저장 = COUPANG 만).
 */
export function CategoryMetaCreateFields({
  categoryId,
  platform = 'COUPANG',
  value,
  onChange,
  onSchemaLoad,
  hideCategoryAttrs = false,
}: CategoryMetaCreateFieldsProps) {
  const useCase = useMemo(() => new MasterProductUseCase(new MasterProductRepositoryImpl()), []);
  const savedLater = platform !== 'COUPANG';

  const [attributes, setAttributes] = useState<CategoryAttribute[]>([]);
  const [notices, setNotices] = useState<CategoryNotice[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [onlyRequired, setOnlyRequired] = useState(false);

  // Keep the schema-report callback fresh without re-running the fetch effect.
  const onSchemaLoadRef = useRef(onSchemaLoad);
  useEffect(() => {
    onSchemaLoadRef.current = onSchemaLoad;
  });

  useEffect(() => {
    let alive = true;
    // Inline async IIFE defers all setState past the sync effect body (set-state-in-effect lint).
    void (async () => {
      if (categoryId == null) {
        setAttributes([]);
        setNotices([]);
        onSchemaLoadRef.current([], []);
        return;
      }
      setIsLoading(true);
      setError('');
      try {
        const schema = await useCase.getCategorySchema(categoryId, platform);
        if (!alive) return;
        setAttributes(schema.attributes);
        setNotices(schema.notices);
        onSchemaLoadRef.current(schema.attributes, schema.notices);
      } catch (e) {
        if (!alive) return;
        setAttributes([]);
        setNotices([]);
        onSchemaLoadRef.current([], []);
        setError(extractErrorMessage(e, '카테고리 필수속성을 불러오지 못했습니다. 매핑을 확인하세요.'));
      } finally {
        if (alive) setIsLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [categoryId, platform, useCase]);

  // A picked unit clears the other side of the pair (only one of weight/volume carries a value).
  const handleMeasureUnit = useCallback(
    (p: MeasurePair, unit: string) => {
      const clearName = unit === '중량' ? p.volume.name : unit === '용량' ? p.weight.name : '';
      if (!clearName) return;
      onChange({ ...value, attrValues: { ...value.attrValues, [clearName]: '' } });
    },
    [onChange, value],
  );

  if (categoryId == null) {
    return (
      <p className="rounded bg-gray-50 px-3 py-2 text-sm text-gray-500">
        카테고리를 선택하면 필수속성/고시 입력이 표시됩니다.
      </p>
    );
  }

  if (isLoading) {
    return (
      <div className="flex min-h-16 items-center justify-center">
        <Spinner size={20} label="불러오는 중..." />
      </div>
    );
  }

  return (
    <div>
      {error && <p className="mb-3 rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <CategoryMetaFields
        attributes={attributes}
        notices={notices}
        attrValues={value.attrValues}
        noticeValues={value.noticeValues}
        onAttrChange={(name, v) =>
          onChange({ ...value, attrValues: { ...value.attrValues, [name]: v } })
        }
        onNoticeChange={(key, v) =>
          onChange({ ...value, noticeValues: { ...value.noticeValues, [key]: v } })
        }
        onNoticeValuesChange={(next) => onChange({ ...value, noticeValues: next })}
        onMeasureUnit={handleMeasureUnit}
        onlyRequired={onlyRequired}
        onOnlyRequiredChange={setOnlyRequired}
        hideCategoryAttrs={hideCategoryAttrs}
        noticeGroup={value.noticeGroup ?? null}
        onNoticeGroupChange={(group) => onChange({ ...value, noticeGroup: group })}
      />

      {savedLater && (
        <p className="rounded bg-gray-50 px-3 py-2 text-xs text-gray-500">
          이 플랫폼 값 저장은 후속입니다. 생성 시 COUPANG 값만 반영됩니다.
        </p>
      )}
    </div>
  );
}
