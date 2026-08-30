'use client';

import { useEffect, useState } from 'react';
import { Spinner } from '@/presentation/components/Spinner';
import { extractErrorMessage } from '@/infrastructure/utils/errorMessage';
import { BUILTIN_FIELD_KEYS, type TemplateField } from '@/domain/entities/ThumbnailEntity';
import type { MasterProductResponse } from '@/domain/entities/MasterProductEntity';
import type { MasterProductUseCase } from '@/application/usecases/MasterProductUseCase';
import type { ThumbnailTemplateUseCase } from '@/application/usecases/ThumbnailTemplateUseCase';

interface MasterFieldValuesPanelProps {
  master: MasterProductResponse; // initial values come from the parent (no getById here)
  useCase: MasterProductUseCase; // owned by parent container (CoverageMatrix)
  templateUseCase: ThumbnailTemplateUseCase; // ditto — the field list source
  onSaved: (patched: MasterProductResponse) => void; // parent updates its master state in place
}

const placeholderFor = (key: string) =>
  (BUILTIN_FIELD_KEYS as readonly string[]).includes(key) ? '등록상품값 사용' : '템플릿 기본값 사용';

/**
 * 마스터 템플릿 필드값 인라인 편집 패널 (마스터 상세).
 * File: src/app/dashboard/master-products/[id]/components/MasterFieldValuesPanel.tsx
 *
 * 필드 **목록**은 기본 썸네일 템플릿(`isDefault`)의 `fields`, 필드 **값**은 부모가 내려준
 * `master.fieldValues` 프리필이다(패널이 `getById` 를 다시 부르지 않는다).
 * 목록 로드는 이 패널이 마운트될 때 = `DetailSection` 을 처음 펼칠 때 한 번 일어난다(lazy).
 *
 * 빈 값은 전송에서 제외 → 예약 필드는 등록상품값, 커스텀 필드는 템플릿 기본값으로 채워진다.
 * 저장은 **자기 필드만** PATCH(`{ fieldValues }`)하고 `onSaved(patched)` 로 부모에 통지한다
 * (매트릭스 재조회 금지). ⚠️ 백엔드는 non-null fieldValues 를 전체 교체로 다루므로 지운 필드도 반영된다.
 * 템플릿 조회 실패 = 인라인 안내 + 빈 목록(편집 불가) — 다른 섹션 저장을 막지는 않는다.
 */
export function MasterFieldValuesPanel({
  master,
  useCase,
  templateUseCase,
  onSaved,
}: MasterFieldValuesPanelProps) {
  const [fields, setFields] = useState<TemplateField[]>([]);
  const [values, setValues] = useState<Record<string, string>>(master.fieldValues ?? {});
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      setIsLoading(true);
      setLoadError('');
      try {
        const templates = await templateUseCase.list();
        if (alive) setFields(templates.find((t) => t.isDefault)?.fields ?? []);
      } catch {
        if (alive) {
          setFields([]);
          setLoadError('템플릿 필드를 불러오지 못했습니다. 필드값을 편집할 수 없습니다.');
        }
      } finally {
        if (alive) setIsLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [templateUseCase]);

  const startEdit = () => {
    setValues(master.fieldValues ?? {});
    setError('');
    setSaved(false);
    setIsEditing(true);
  };

  const handleSave = async () => {
    // Omit blank values so the backend falls back to product/template defaults.
    const cleaned: Record<string, string> = {};
    for (const [k, v] of Object.entries(values)) {
      if (v.trim() !== '') cleaned[k] = v;
    }
    try {
      setIsSaving(true);
      setError('');
      setSaved(false);
      const patched = await useCase.update(master.id, { fieldValues: cleaned });
      setIsEditing(false);
      setSaved(true);
      // Transient confirmation — auto-dismiss (project has no toast system).
      setTimeout(() => setSaved(false), 2500);
      onSaved(patched);
    } catch (err) {
      setError(extractErrorMessage(err, '템플릿 필드값 저장에 실패했습니다.'));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="p-4">
      {error && <p className="mb-3 rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      {loadError && (
        <p className="mb-3 rounded bg-amber-50 px-3 py-2 text-sm text-amber-700">{loadError}</p>
      )}

      {isLoading ? (
        <div className="flex min-h-16 items-center justify-center">
          <Spinner size={20} label="불러오는 중..." />
        </div>
      ) : fields.length === 0 ? (
        <p className="text-sm text-gray-500">기본 템플릿에 정의된 필드가 없습니다.</p>
      ) : (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            {fields.map((f) => (
              <div key={f.key}>
                <label className="mb-1 block text-xs font-medium text-gray-600">{f.label}</label>
                {isEditing ? (
                  <input
                    className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm text-gray-900"
                    value={values[f.key] ?? ''}
                    placeholder={placeholderFor(f.key)}
                    disabled={isSaving}
                    onChange={(e) => {
                      const next = e.target.value;
                      setValues((prev) => ({ ...prev, [f.key]: next }));
                      setSaved(false);
                    }}
                  />
                ) : (
                  <p className="rounded bg-gray-50 px-3 py-2 text-sm text-gray-800">
                    {master.fieldValues?.[f.key]?.trim() ? (
                      master.fieldValues[f.key]
                    ) : (
                      <span className="text-gray-400">{placeholderFor(f.key)}</span>
                    )}
                  </p>
                )}
              </div>
            ))}
          </div>

          <p className="text-[11px] text-gray-500">
            비우면 예약 필드는 등록상품 정보, 커스텀 필드는 템플릿 기본값으로 채워집니다. 채널마다
            다르게 하려면 셀의 [필드값 편집]에서 조정하세요.
          </p>

          {saved && !error && <p className="text-sm text-green-700">템플릿 필드값을 저장했습니다.</p>}

          {isEditing ? (
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={handleSave}
                disabled={isSaving}
                className="px-3 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed transition-colors inline-flex items-center gap-2"
              >
                {isSaving ? <Spinner label="저장 중..." /> : '저장'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsEditing(false);
                  setError('');
                }}
                disabled={isSaving}
                className="px-3 py-2 border border-gray-300 text-gray-700 text-sm font-medium rounded-md hover:bg-gray-100 disabled:opacity-50 transition-colors"
              >
                취소
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={startEdit}
              className="px-3 py-2 border border-gray-300 text-gray-700 text-sm font-medium rounded-md hover:bg-gray-100 transition-colors"
            >
              수정
            </button>
          )}
        </div>
      )}
    </div>
  );
}
