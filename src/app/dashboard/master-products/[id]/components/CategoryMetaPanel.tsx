'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Spinner } from '@/presentation/components/Spinner';
import { extractErrorMessage } from '@/infrastructure/utils/errorMessage';
import { MasterProductUseCase } from '@/application/usecases/MasterProductUseCase';
import { MasterProductRepositoryImpl } from '@/infrastructure/repositories/MasterProductRepositoryImpl';
import type { CategoryAttribute, CategoryNotice } from '@/domain/entities/MasterProductEntity';
import type { MeasurePair } from './measureAttributes';
import { CategoryMetaFields } from './CategoryMetaFields';
import { computeMissingRequired, noticesToSubmit, submitNoticeGroup } from './categoryMetaValidation';

interface CategoryMetaPanelProps {
  masterId: number;
  categoryCode: string | null; // assigned standard category id (null = unset); a change re-fetches
  platform?: string; // default 'COUPANG' (only registration mall for now)
  // 구성품 종수 ≥ 2 (백엔드 63 미러, 중립 도메인 사실). 부모=마스터 상세 로더가 계산해 주입.
  isBundle?: boolean;
  onSaved?: () => void;
}

/**
 * 카테고리 필수속성 / 상품정보제공고시 입력 패널 — 마스터 상세 컨테이너 (백엔드 47).
 * File: src/app/dashboard/master-products/[id]/components/CategoryMetaPanel.tsx
 *
 * 값 상태(attrValues/noticeType/noticeValues)를 소유하고 프레젠테이션(CategoryMetaFields)에
 * 콜백으로 내려준다. 저장 게이트는 공유 헬퍼(computeMissingRequired)로 판단.
 *
 * 플랫폼별 분기:
 * - COUPANG: getCategoryMeta(스키마+값) 로드 → 편집 + 저장(setCategoryAttributes).
 * - 그 외: getCategorySchema(스키마만) 로드 → 읽기전용(값 저장은 57 아웃 오브 스코프).
 *   master 단일 Map 덮어쓰기 방지를 위해 저장 버튼 disabled + 인라인 안내.
 *
 * ⚠️ 이 패널은 [상품 기본 정보] 토글 **안의 하위 블록**이다(사용자 요청 2026-08-29) → 제목 `<h3>` 를
 * 스스로 렌더하고(옛 단독 `DetailSection` 의 title 을 대체) 카드 껍데기(rounded/shadow) 없이
 * `border-t + p-4` 를 쓴다. 단독 섹션으로 되돌리지 말 것.
 */
export function CategoryMetaPanel({
  masterId,
  categoryCode,
  platform = 'COUPANG',
  isBundle = false,
  onSaved,
}: CategoryMetaPanelProps) {
  const useCase = useMemo(() => new MasterProductUseCase(new MasterProductRepositoryImpl()), []);
  // COUPANG owns the persisted per-master values; other platforms are schema-only (read-only).
  const readOnly = platform !== 'COUPANG';

  // 표시/필수 = 선택 플랫폼 요구 union. 오늘 쿠팡 단일이라 상세는 항상 coupangSelected=true.
  // hideCategoryAttrs = "선택된 채널 중 이 필드(카테고리 속성)를 요구하는 채널이 없다".
  // TODO: 플랫폼 선택 모델 도입 시 실제 선택값으로 교체 (out of scope) — 네이버 추가 시 union 확장.
  const coupangSelected = true;
  const hideCategoryAttrs = coupangSelected && isBundle;

  const [attributes, setAttributes] = useState<CategoryAttribute[]>([]);
  const [notices, setNotices] = useState<CategoryNotice[]>([]); // backend-driven notice schema
  const [attrValues, setAttrValues] = useState<Record<string, string>>({});
  const [noticeValues, setNoticeValues] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const [onlyRequired, setOnlyRequired] = useState(false); // display filter: show only required fields
  // 상품정보제공고시 = 품목군 셀렉션(하나 선택). null = 실효 그룹(값 있는 그룹 → 첫 그룹) 사용.
  const [noticeGroup, setNoticeGroup] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError('');
    setSaved(false);
    try {
      if (readOnly) {
        // Non-COUPANG tab: schema only, no per-master values (backend 57 out of scope).
        const schema = await useCase.getCategorySchema(Number(categoryCode), platform);
        setAttributes(schema.attributes);
        setNotices(schema.notices);
        setAttrValues({});
        setNoticeValues({});
        setNoticeGroup(null);
      } else {
        const meta = await useCase.getCategoryMeta(masterId, platform);
        setAttributes(meta.attributes);
        setNotices(meta.notices);
        setAttrValues(meta.values.attributes ?? {});
        setNoticeValues(meta.values.notices ?? {});
        // 저장된 품목군으로 복원(91). 공백만/미필드 = 미지정 → null 로 두고 폴백에 맡긴다.
        setNoticeGroup(meta.values.noticeGroup?.trim() ? meta.values.noticeGroup : null);
      }
    } catch (e) {
      // Attribute lookup failed (e.g. mapping not set -> 400): show inline guidance.
      setAttributes([]);
      setNotices([]);
      setError(extractErrorMessage(e, '카테고리 필수속성을 불러오지 못했습니다. 필요 시 카테고리/매핑을 설정하세요.'));
    } finally {
      setIsLoading(false);
    }
  }, [useCase, masterId, categoryCode, platform, readOnly]);

  useEffect(() => {
    // Render gate below returns null while unset; skip fetching until a category is assigned.
    if (categoryCode == null) return;
    // Inline async IIFE defers setState past the sync effect body (set-state-in-effect lint).
    void (async () => {
      await load();
    })();
  }, [categoryCode, load]);

  if (categoryCode == null) return null;

  // A picked unit clears the other side of the pair (only one of weight/volume carries a value).
  const handleMeasureUnit = (p: MeasurePair, unit: string) => {
    const clearName = unit === '중량' ? p.volume.name : unit === '용량' ? p.weight.name : '';
    if (clearName) setAttrValues((prev) => ({ ...prev, [clearName]: '' }));
  };

  const missingRequired = computeMissingRequired(
    attributes,
    attrValues,
    notices,
    noticeValues,
    hideCategoryAttrs,
    noticeGroup,
  );

  const handleSave = async () => {
    setIsSaving(true);
    setError('');
    setSaved(false);
    try {
      // Send only the selected 품목군's notices (user picks one group). Attributes unchanged.
      // 실효 그룹을 **한 번만** 계산해 전송값과 전송 그룹이 같은 값에서 나오게 한다 —
      // state 가 null 이어도 폴백 결과를 명시 전송해야 다음 조회에서 또 추론하지 않는다.
      const group = submitNoticeGroup(notices, noticeValues, noticeGroup);
      await useCase.setCategoryAttributes(masterId, {
        attributes: attrValues,
        notices: noticesToSubmit(notices, noticeValues, group),
        noticeGroup: group,
      });
      setNoticeGroup(group);
      setSaved(true);
      onSaved?.();
    } catch (e) {
      setError(extractErrorMessage(e, '저장에 실패했습니다.'));
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="border-t border-gray-200 p-4">
        <h3 className="mb-3 text-sm font-semibold text-gray-900">카테고리 필수속성 · 고시</h3>
        <div className="flex min-h-16 items-center justify-center">
          <Spinner size={20} label="불러오는 중..." />
        </div>
      </div>
    );
  }

  return (
    <div className="border-t border-gray-200 p-4">
      <h3 className="mb-3 text-sm font-semibold text-gray-900">카테고리 필수속성 · 고시</h3>

      {error && <p className="mb-3 rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      {saved && <p className="mb-3 rounded bg-green-50 px-3 py-2 text-sm text-green-700">저장되었습니다.</p>}

      <CategoryMetaFields
        attributes={attributes}
        notices={notices}
        attrValues={attrValues}
        noticeValues={noticeValues}
        onAttrChange={(name, value) => setAttrValues((prev) => ({ ...prev, [name]: value }))}
        onNoticeChange={(key, value) => setNoticeValues((prev) => ({ ...prev, [key]: value }))}
        onNoticeValuesChange={setNoticeValues}
        onMeasureUnit={handleMeasureUnit}
        disabled={readOnly || isSaving}
        onlyRequired={onlyRequired}
        onOnlyRequiredChange={setOnlyRequired}
        hideCategoryAttrs={hideCategoryAttrs}
        noticeGroup={noticeGroup}
        onNoticeGroupChange={setNoticeGroup}
      />

      {readOnly ? (
        <p className="rounded bg-gray-50 px-3 py-2 text-xs text-gray-500">
          이 플랫폼 값 저장은 후속입니다. 현재는 스키마만 표시됩니다.
        </p>
      ) : (
        <button
          type="button"
          onClick={handleSave}
          disabled={isSaving || missingRequired}
          className="rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {isSaving ? <Spinner label="저장 중..." /> : '저장'}
        </button>
      )}
    </div>
  );
}
