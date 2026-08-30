'use client';

import { useEffect, useMemo, useState } from 'react';
import { Spinner } from '@/presentation/components/Spinner';
import { ListingRegistrationUseCase } from '@/application/usecases/ListingRegistrationUseCase';
import { ListingRegistrationRepositoryImpl } from '@/infrastructure/repositories/ListingRegistrationRepositoryImpl';
import { ThumbnailTemplateUseCase } from '@/application/usecases/ThumbnailTemplateUseCase';
import { ThumbnailTemplateRepositoryImpl } from '@/infrastructure/repositories/ThumbnailTemplateRepositoryImpl';
import { BUILTIN_FIELD_KEYS, type TemplateField } from '@/domain/entities/ThumbnailEntity';
import type { GeneratedProductResponse } from '@/domain/entities/ListingRegistrationEntity';

interface ChannelFieldValuesModalProps {
  listingId: number;
  onSaved: (generated: GeneratedProductResponse) => void;
  onClose: () => void;
}

const isReserved = (key: string) => (BUILTIN_FIELD_KEYS as readonly string[]).includes(key);

/**
 * 채널(리스팅)별 필드값 override 편집 모달 (prompt 12 백엔드).
 * File: src/app/dashboard/master-products/[id]/components/ChannelFieldValuesModal.tsx
 *
 * 기본 템플릿이 정의한 fields 만 입력(자유 key 추가 없음). 예약키(brandName/productName)는
 * 비우면 등록상품값, 커스텀은 비우면 템플릿 기본값으로 렌더된다. 저장 시 빈 값 key 는 omit.
 */
export function ChannelFieldValuesModal({ listingId, onSaved, onClose }: ChannelFieldValuesModalProps) {
  const listingUseCase = useMemo(
    () => new ListingRegistrationUseCase(new ListingRegistrationRepositoryImpl()),
    [],
  );
  const templateUseCase = useMemo(
    () => new ThumbnailTemplateUseCase(new ThumbnailTemplateRepositoryImpl()),
    [],
  );

  const [fields, setFields] = useState<TemplateField[]>([]);
  const [values, setValues] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    (async () => {
      setIsLoading(true);
      setError('');
      try {
        const [generated, templates] = await Promise.all([
          listingUseCase.getGenerated(listingId),
          templateUseCase.list(),
        ]);
        if (!alive) return;
        setFields(templates.find((t) => t.isDefault)?.fields ?? []);
        setValues(generated.fieldValues ?? {});
      } catch {
        if (alive) setError('필드값을 불러오지 못했습니다.');
      } finally {
        if (alive) setIsLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [listingUseCase, templateUseCase, listingId]);

  const handleSave = async () => {
    setIsSaving(true);
    setError('');
    try {
      // Omit blank values so the backend falls back to product/template defaults.
      const fieldValues: Record<string, string> = {};
      for (const [key, value] of Object.entries(values)) {
        if (value.trim() !== '') fieldValues[key] = value;
      }
      const generated = await listingUseCase.updateFieldValues(listingId, { fieldValues });
      onSaved(generated);
      onClose();
    } catch {
      setError('필드값 저장에 실패했습니다.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg rounded-lg bg-white p-5 shadow-lg">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">채널별 필드값 편집</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-sm text-gray-500 hover:text-gray-800"
          >
            닫기
          </button>
        </div>

        {error && <p className="mb-4 rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

        {isLoading ? (
          <div className="flex min-h-32 items-center justify-center">
            <Spinner size={24} label="불러오는 중..." />
          </div>
        ) : fields.length === 0 ? (
          <p className="text-sm text-gray-500">기본 템플릿에 정의된 필드가 없습니다.</p>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {fields.map((f) => {
              const reserved = isReserved(f.key);
              return (
                <div key={f.key}>
                  <label className="mb-1 block text-xs font-medium text-gray-600">{f.label}</label>
                  <input
                    className="w-full rounded border border-gray-300 px-2 py-1 text-sm text-gray-900"
                    value={values[f.key] ?? ''}
                    placeholder={reserved ? '등록상품값 사용' : '템플릿 기본값 사용'}
                    onChange={(e) => setValues((prev) => ({ ...prev, [f.key]: e.target.value }))}
                  />
                </div>
              );
            })}
          </div>
        )}

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={isSaving}
            className="rounded border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-50"
          >
            취소
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={isLoading || isSaving}
            className="flex items-center gap-1 rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {isSaving ? <Spinner label="저장 중..." /> : '저장 후 재생성'}
          </button>
        </div>
      </div>
    </div>
  );
}
