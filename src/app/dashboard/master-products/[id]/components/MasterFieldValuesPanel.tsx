'use client';

import { useEffect, useState } from 'react';
import { Spinner } from '@/presentation/components/Spinner';
import { extractErrorMessage } from '@/infrastructure/utils/errorMessage';
import { BUILTIN_FIELD_KEYS, type TemplateField } from '@/domain/entities/ThumbnailEntity';
import type { MasterProductResponse } from '@/domain/entities/MasterProductEntity';
import type { MasterProductUseCase } from '@/application/usecases/MasterProductUseCase';
import type { ThumbnailTemplateUseCase } from '@/application/usecases/ThumbnailTemplateUseCase';
import { Button } from '@/presentation/components/ui/Button';
import { Input } from '@/presentation/components/ui/Input';
import {
  NOTICE_TEXT_FIELDS,
  NOTICE_TEXT_KEYS,
  NOTICE_TEXT_TOO_LONG_MESSAGE,
  noticeTextTooLong,
} from '@/domain/entities/ElevenstNoticeText';

interface MasterFieldValuesPanelProps {
  master: MasterProductResponse; // initial values come from the parent (no getById here)
  useCase: MasterProductUseCase; // owned by parent container (CoverageMatrix)
  templateUseCase: ThumbnailTemplateUseCase; // ditto — the field list source
  onSaved: (patched: MasterProductResponse) => void; // parent updates its master state in place
}

const placeholderFor = (key: string) =>
  (BUILTIN_FIELD_KEYS as readonly string[]).includes(key) ? '등록상품값 사용' : '템플릿 기본값 사용';

/**
 * Inline editor of the master's template field values (master detail).
 * File: src/app/dashboard/master-products/[id]/components/MasterFieldValuesPanel.tsx
 *
 * The field **list** = the default thumbnail template's (`isDefault`) `fields` + the two 11st notice texts
 * 「A/S 안내」 · 「반품/교환 안내」, always shown as multi-line fields (FEATURE_2610_13 / D74). The field **values**
 * are prefilled from `master.fieldValues` handed down by the parent (the panel does not call `getById` again).
 * The list loads when this panel mounts = the first time its tab (`MasterSectionTabs`) opens (lazy).
 *
 * Blank values are left out of the request → a reserved field takes the registered-product value, a custom field
 * the template default, and a notice text the 11st sales channel default (FEATURE_2610_16 / D5 · D9). Saving PATCHes
 * **only its own fields** (`{ fieldValues }`) and tells the
 * parent through `onSaved(patched)` (no matrix reload). ⚠️ The backend replaces the whole non-null fieldValues, so a
 * cleared field is saved as cleared. A notice text over 4000 EUC-KR bytes stops the save (D78).
 * A failed template read = inline notice + no template fields (only the notice texts stay editable) — it never
 * blocks saving other sections.
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
        // The notice texts are listed on their own below — never twice.
        const templateFields = templates.find((t) => t.isDefault)?.fields ?? [];
        if (alive) setFields(templateFields.filter((f) => !NOTICE_TEXT_KEYS.includes(f.key)));
      } catch {
        if (alive) {
          setFields([]);
          setLoadError('템플릿 필드를 불러오지 못했습니다. A/S 안내 · 반품/교환 안내만 편집할 수 있습니다.');
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
    // FEATURE_2610_13 / D78: a notice text over the 11st limit is not saved.
    if (noticeTextTooLong(values)) {
      setError(NOTICE_TEXT_TOO_LONG_MESSAGE);
      return;
    }
    // Omit blank values so the backend falls back to defaults: product / template values for the template fields,
    // the 11st sales channel default for the two notice texts (FEATURE_2610_16 / D5).
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
      ) : (
        <div className="space-y-3">
          {fields.length === 0 && (
            <p className="text-sm text-gray-500">기본 템플릿에 정의된 필드가 없습니다.</p>
          )}
          <div className="grid grid-cols-2 gap-3">
            {fields.map((f) => (
              <div key={f.key}>
                <label className="mb-1 block text-xs font-medium text-gray-600">{f.label}</label>
                {isEditing ? (
                  <Input
                    size="sm"
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
            {/* FEATURE_2610_13 / D74: the two 11st notice texts, always shown, multi-line. */}
            {NOTICE_TEXT_FIELDS.map((f) => (
              <div key={f.key} className="col-span-2">
                <label className="mb-1 block text-xs font-medium text-gray-600">{f.label}</label>
                {isEditing ? (
                  <textarea
                    rows={4}
                    value={values[f.key] ?? ''}
                    placeholder="판매채널 기본값 사용"
                    disabled={isSaving}
                    onChange={(e) => {
                      const next = e.target.value;
                      setValues((prev) => ({ ...prev, [f.key]: next }));
                      setSaved(false);
                    }}
                    className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm text-gray-900 disabled:bg-gray-100"
                  />
                ) : (
                  <p className="whitespace-pre-wrap rounded bg-gray-50 px-3 py-2 text-sm text-gray-800">
                    {master.fieldValues?.[f.key]?.trim() ? (
                      master.fieldValues[f.key]
                    ) : (
                      <span className="text-gray-400">판매채널 기본값 사용</span>
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
              <Button
                type="button"
                onClick={handleSave}
                disabled={isSaving}
                className="inline-flex items-center gap-2"
              >
                {isSaving ? <Spinner label="저장 중..." /> : '저장'}
              </Button>
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
