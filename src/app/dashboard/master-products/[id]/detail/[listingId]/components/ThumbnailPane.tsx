'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Spinner } from '@/presentation/components/Spinner';
import { resolveThumbUrl } from '@/infrastructure/utils/thumbUrl';
import { ThumbnailTemplateUseCase } from '@/application/usecases/ThumbnailTemplateUseCase';
import { ThumbnailTemplateRepositoryImpl } from '@/infrastructure/repositories/ThumbnailTemplateRepositoryImpl';
import { BUILTIN_FIELD_KEYS, type TemplateField } from '@/domain/entities/ThumbnailEntity';
import type { GeneratedProductResponse } from '@/domain/entities/ListingRegistrationEntity';
import type { ListingRegistrationUseCase } from '@/application/usecases/ListingRegistrationUseCase';
import type { OnGenerated } from './DetailEditorTabs';

const isReserved = (key: string) => (BUILTIN_FIELD_KEYS as readonly string[]).includes(key);

// Korean labels for the reserved keys (shown even when the template omits them).
const RESERVED_LABELS: Record<string, string> = { brandName: '브랜드명', productName: '상품명' };

interface ThumbnailPaneProps {
  listingId: number;
  generated: GeneratedProductResponse;
  useCase: ListingRegistrationUseCase;
  onGenerated: OnGenerated;
}

/**
 * 탭4 — 채널 셀 썸네일 관리(조회 / 재생성 / 업로드 override / override 해제).
 * File: src/app/dashboard/master-products/[id]/detail/[listingId]/components/ThumbnailPane.tsx
 *
 * 배지·override 상태는 항상 `generated.thumbnailSource`로 파생(상세용 `source`와 별개).
 * 필드값(brandName 등)은 이 패널에서 인라인 입력 → [저장 후 재생성]이 `updateFieldValues`로
 * 채널 필드값을 저장하면서 썸네일·상세를 재생성한다(prompt 12 백엔드). 예약키는 비우면
 * 등록상품값, 커스텀은 비우면 템플릿 기본값. override 상태에선 썸네일만 보존(필드값·상세는 갱신).
 */
export function ThumbnailPane({ listingId, generated, useCase, onGenerated }: ThumbnailPaneProps) {
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [error, setError] = useState('');
  // Cache-buster: same S3/local URL after re-upload would hit the browser cache.
  // Bumped after each action (0 on first render = no buster on the untouched image).
  const [bust, setBust] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Default-template fields drive the inline field-value panel. Non-fatal: on failure
  // or legacy fields=null the panel stays hidden and the backend uses defaults.
  const templateUseCase = useMemo(
    () => new ThumbnailTemplateUseCase(new ThumbnailTemplateRepositoryImpl()),
    [],
  );
  const [fields, setFields] = useState<TemplateField[]>([]);
  const [fieldsLoading, setFieldsLoading] = useState(true);
  const [values, setValues] = useState<Record<string, string>>(generated.fieldValues ?? {});

  const busy = isRegenerating || isUploading || isClearing;
  const isOverridden = generated.thumbnailSource === 'MANUAL_OVERRIDE';

  // Reserved keys (brandName/productName) are always editable, even if the template
  // omits them; template-defined fields override the label and add custom keys.
  const effectiveFields = useMemo(() => {
    const byKey = new Map<string, TemplateField>();
    for (const key of BUILTIN_FIELD_KEYS) {
      byKey.set(key, { key, label: RESERVED_LABELS[key] ?? key, defaultValue: '' });
    }
    for (const f of fields) byKey.set(f.key, f);
    return Array.from(byKey.values());
  }, [fields]);

  useEffect(() => {
    let alive = true;
    (async () => {
      setFieldsLoading(true);
      try {
        const templates = await templateUseCase.list();
        if (alive) setFields(templates.find((t) => t.isDefault)?.fields ?? []);
      } catch {
        // non-fatal: regenerate still uses persisted/default values
      } finally {
        if (alive) setFieldsLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [templateUseCase]);

  const handleRegenerate = async () => {
    setIsRegenerating(true);
    setError('');
    try {
      // Omit blank values so the backend falls back to product/template defaults.
      const fieldValues: Record<string, string> = {};
      for (const [key, value] of Object.entries(values)) {
        if (value.trim() !== '') fieldValues[key] = value;
      }
      onGenerated(await useCase.updateFieldValues(listingId, { fieldValues }));
      setBust(Date.now());
    } catch {
      setError('썸네일 처리에 실패했습니다.');
    } finally {
      setIsRegenerating(false);
    }
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploading(true);
    setError('');
    try {
      onGenerated(await useCase.overrideThumbnail(listingId, file));
      setBust(Date.now());
    } catch (err) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      setError(status === 400 ? '파일을 확인해 주세요 (JPG/PNG).' : '썸네일 처리에 실패했습니다.');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleClear = async () => {
    if (!window.confirm('수동 썸네일을 삭제하고 자동 생성으로 되돌립니다.')) return;
    setIsClearing(true);
    setError('');
    try {
      onGenerated(await useCase.clearThumbnail(listingId));
      setBust(Date.now());
    } catch {
      setError('썸네일 처리에 실패했습니다.');
    } finally {
      setIsClearing(false);
    }
  };

  return (
    <div className="space-y-4">
      {error && <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <div className="flex flex-wrap items-start gap-4">
        <div className="h-48 w-48 shrink-0 overflow-hidden rounded border border-gray-200 bg-gray-50">
          {generated.thumbnailUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={resolveThumbUrl(generated.thumbnailUrl, bust || undefined)}
              alt="현재 썸네일"
              className="h-full w-full object-contain"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-xs text-gray-400">
              썸네일 없음
            </div>
          )}
        </div>

        <div className="space-y-2">
          {isOverridden ? (
            <span className="inline-block rounded bg-amber-100 px-2 py-1 text-xs font-medium text-amber-700">
              수동 교체됨
            </span>
          ) : (
            <span className="inline-block rounded bg-emerald-100 px-2 py-1 text-xs font-medium text-emerald-700">
              자동 생성
            </span>
          )}
          <p className="max-w-md text-xs text-gray-500">
            {isOverridden
              ? '직접 올린 이미지가 적용된 상태입니다. [저장 후 재생성]해도 썸네일은 그대로 유지되고 필드값·상세만 갱신됩니다. 자동 생성으로 되돌리려면 [자동 생성으로 되돌리기]를 누르세요.'
              : '아래 필드값을 채우고 [저장 후 재생성]하면 썸네일·상세에 반영됩니다.'}
          </p>
        </div>
      </div>

      <div className="space-y-2 border-t border-gray-100 pt-3">
        <p className="text-xs font-medium text-gray-600">필드값 (재생성 시 적용)</p>
        {fieldsLoading ? (
          <div className="flex min-h-10 items-center">
            <Spinner size={18} label="필드 불러오는 중..." />
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {effectiveFields.map((f) => {
              const reserved = isReserved(f.key);
              return (
                <div key={f.key}>
                  <label className="mb-1 block text-xs font-medium text-gray-600">{f.label}</label>
                  <input
                    className="w-full rounded border border-gray-300 px-2 py-1 text-sm text-gray-900 disabled:opacity-50"
                    value={values[f.key] ?? ''}
                    placeholder={reserved ? '등록상품값 사용' : '템플릿 기본값 사용'}
                    onChange={(e) => setValues((prev) => ({ ...prev, [f.key]: e.target.value }))}
                    disabled={busy}
                  />
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-2 border-t border-gray-100 pt-3">
        <button
          type="button"
          onClick={handleRegenerate}
          disabled={busy}
          className="flex items-center gap-1 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {isRegenerating ? <Spinner label="재생성 중..." /> : '저장 후 재생성'}
        </button>

        <label className="flex cursor-pointer items-center gap-1 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100">
          {isUploading ? <Spinner label="업로드 중..." /> : '이미지 업로드로 교체'}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png"
            onChange={handleUpload}
            disabled={busy}
            className="hidden"
          />
        </label>

        {isOverridden && (
          <button
            type="button"
            onClick={handleClear}
            disabled={busy}
            className="flex items-center gap-1 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-50"
          >
            {isClearing ? <Spinner label="되돌리는 중..." /> : '자동 생성으로 되돌리기'}
          </button>
        )}
      </div>
    </div>
  );
}
