'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Spinner } from '@/presentation/components/Spinner';
import { extractErrorMessage } from '@/infrastructure/utils/errorMessage';
import { MasterProductUseCase } from '@/application/usecases/MasterProductUseCase';
import { MasterProductRepositoryImpl } from '@/infrastructure/repositories/MasterProductRepositoryImpl';
import type { CategoryAttribute, CategoryNotice } from '@/domain/entities/MasterProductEntity';

interface CategoryMetaPanelProps {
  masterId: number;
  categoryCode: string | null; // assigned standard category id (null = unset); a change re-fetches
  platform?: string; // default 'COUPANG' (only registration mall for now)
  onSaved?: () => void;
}

/**
 * 카테고리 필수속성 / 상품정보제공고시 동적 입력 패널 (마스터 상세, 백엔드 47).
 * File: src/app/dashboard/master-products/[id]/components/CategoryMetaPanel.tsx
 *
 * 백엔드 스키마대로만 렌더 — 스키마가 비면(플랫폼별·optional) 패널 자체를 띄우지 않는다(empty=스킵).
 * 값은 useState Record 2개(attributes: name→value, notices: key→value)를 그대로 전송(NUMBER도 string).
 * 플랫폼은 현재 COUPANG 고정(다중 몰 속성 입력 탭은 후속 — 스키마 조회 param 자리만 있음).
 */
export function CategoryMetaPanel({
  masterId,
  categoryCode,
  platform = 'COUPANG',
  onSaved,
}: CategoryMetaPanelProps) {
  const useCase = useMemo(() => new MasterProductUseCase(new MasterProductRepositoryImpl()), []);

  const [attributes, setAttributes] = useState<CategoryAttribute[]>([]);
  const [notices, setNotices] = useState<CategoryNotice[]>([]);
  const [attrValues, setAttrValues] = useState<Record<string, string>>({});
  const [noticeValues, setNoticeValues] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError('');
    setSaved(false);
    try {
      const meta = await useCase.getCategoryMeta(masterId, platform);
      setAttributes(meta.attributes);
      setNotices(meta.notices);
      setAttrValues(meta.values.attributes ?? {});
      setNoticeValues(meta.values.notices ?? {});
    } catch (e) {
      // Lookup failure (e.g. mapping not set -> 400): show inline guidance, keep panel visible.
      setAttributes([]);
      setNotices([]);
      setError(extractErrorMessage(e, '카테고리 속성을 불러오지 못했습니다. 먼저 카테고리/매핑을 설정하세요.'));
    } finally {
      setIsLoading(false);
    }
  }, [useCase, masterId, platform]);

  useEffect(() => {
    // Render gate below returns null while unset; skip fetching until a category is assigned.
    if (categoryCode == null) return;
    // Inline async IIFE defers setState past the sync effect body (set-state-in-effect lint).
    void (async () => {
      await load();
    })();
  }, [categoryCode, load]);

  if (categoryCode == null) return null;

  const hasSchema = attributes.length > 0 || notices.length > 0;

  const missingRequired =
    attributes.some((a) => a.required && !(attrValues[a.name] ?? '').trim()) ||
    notices.some((n) => n.required && !(noticeValues[n.key] ?? '').trim());

  const handleSave = async () => {
    setIsSaving(true);
    setError('');
    setSaved(false);
    try {
      await useCase.setCategoryAttributes(masterId, { attributes: attrValues, notices: noticeValues });
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
      <div className="rounded-lg bg-white p-4 shadow">
        <div className="flex min-h-16 items-center justify-center">
          <Spinner size={20} label="불러오는 중..." />
        </div>
      </div>
    );
  }

  // Lookup failed and no schema -> inline guidance box.
  if (error && !hasSchema) {
    return (
      <div className="rounded-lg bg-white p-4 shadow">
        <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      </div>
    );
  }

  // Empty schema -> skip the panel entirely (no heading, no notice).
  if (!hasSchema) return null;

  return (
    <div className="rounded-lg bg-white p-4 shadow">
      <h2 className="mb-3 text-sm font-semibold text-gray-900">카테고리 필수속성 / 상품정보제공고시</h2>

      {error && <p className="mb-3 rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      {saved && <p className="mb-3 rounded bg-green-50 px-3 py-2 text-sm text-green-700">저장되었습니다.</p>}

      {attributes.length > 0 && (
        <div className="mb-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {attributes.map((a) => (
            <div key={a.name}>
              <label className="mb-1 block text-xs font-medium text-gray-600">
                {a.name}
                {a.required && <span className="text-red-600"> *</span>}
              </label>
              {a.inputType === 'SELECT' ? (
                <select
                  className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm text-gray-900"
                  value={attrValues[a.name] ?? ''}
                  onChange={(e) => setAttrValues((prev) => ({ ...prev, [a.name]: e.target.value }))}
                  disabled={isSaving}
                >
                  <option value="">선택</option>
                  {a.options.map((o) => (
                    <option key={o} value={o}>
                      {o}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type={a.inputType === 'NUMBER' ? 'number' : 'text'}
                  className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm text-gray-900"
                  value={attrValues[a.name] ?? ''}
                  onChange={(e) => setAttrValues((prev) => ({ ...prev, [a.name]: e.target.value }))}
                  disabled={isSaving}
                />
              )}
            </div>
          ))}
        </div>
      )}

      {notices.length > 0 && (
        <div className="mb-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {notices.map((n) => (
            <div key={n.key}>
              <label className="mb-1 block text-xs font-medium text-gray-600">
                {n.label}
                {n.required && <span className="text-red-600"> *</span>}
              </label>
              <input
                type="text"
                className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm text-gray-900"
                value={noticeValues[n.key] ?? ''}
                onChange={(e) => setNoticeValues((prev) => ({ ...prev, [n.key]: e.target.value }))}
                disabled={isSaving}
              />
            </div>
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={handleSave}
        disabled={isSaving || missingRequired}
        className="rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
      >
        {isSaving ? <Spinner label="저장 중..." /> : '저장'}
      </button>
    </div>
  );
}
