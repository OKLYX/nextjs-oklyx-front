'use client';

import { useState } from 'react';
import { Spinner } from '@/presentation/components/Spinner';
import { CategoryLookupPickerModal } from './CategoryLookupPickerModal';
import { extractErrorMessage } from '@/infrastructure/utils/errorMessage';
import type { CategoryMappingUseCase } from '@/application/usecases/CategoryMappingUseCase';
import type { CategoryLookupUseCase } from '@/application/usecases/CategoryLookupUseCase';
import type { Category } from '@/domain/entities/CategoryEntity';
import type { CategoryMapping } from '@/domain/entities/CategoryMappingEntity';

/**
 * 표준 카테고리의 몰별 매핑현황 + 채우기(조회 피커 재사용) 모달.
 *
 * hand-rolled `fixed inset-0`. 몰마다 현재 매핑(코드/경로) 또는 "미매핑" 표시 +
 * [조회 매핑] 버튼 → `CategoryLookupPickerModal`(그 platform) → 선택 → `upsertMapping`.
 * 삭제 = `deleteMapping`. useCase 는 **부모 인스턴스 재사용**.
 *
 * ⚠️ 조회 지원 플랫폼 = 쿠팡만(45 백엔드). 네이버는 seam 자리(후속) — [조회 매핑] 미노출.
 */
interface CategoryMappingModalProps {
  open: boolean;
  category: Category;
  mappings: CategoryMapping[];
  mappingUseCase: CategoryMappingUseCase;
  lookupUseCase: CategoryLookupUseCase;
  onChanged: () => void;
  onClose: () => void;
}

// 조회 피커를 붙일 수 있는 플랫폼(쿠팡만). 네이버는 백엔드 seam 자리 → 후속.
const LOOKUP_PLATFORMS: { platform: 'COUPANG'; label: string }[] = [
  { platform: 'COUPANG', label: '쿠팡' },
];

export function CategoryMappingModal({
  open,
  category,
  mappings,
  mappingUseCase,
  lookupUseCase,
  onChanged,
  onClose,
}: CategoryMappingModalProps) {
  const [error, setError] = useState('');
  const [busyPlatform, setBusyPlatform] = useState<string | null>(null);
  const [pickerPlatform, setPickerPlatform] = useState<'COUPANG' | 'NAVER' | null>(null);

  if (!open) return null;

  const mappingOf = (platform: string) => mappings.find((m) => m.platform === platform);

  const handleUpsert = async (
    platform: string,
    sel: { platformCategoryId: string; name: string; namePath: string }
  ) => {
    setError('');
    setBusyPlatform(platform);
    try {
      await mappingUseCase.upsertMapping(category.id, {
        platform,
        platformCategoryId: sel.platformCategoryId,
        platformCategoryName: sel.namePath || sel.name,
      });
      setPickerPlatform(null);
      onChanged();
    } catch (e) {
      setError(extractErrorMessage(e, '매핑 저장에 실패했습니다.'));
    } finally {
      setBusyPlatform(null);
    }
  };

  const handleDelete = async (platform: string) => {
    setError('');
    setBusyPlatform(platform);
    try {
      await mappingUseCase.deleteMapping(category.id, platform);
      onChanged();
    } catch (e) {
      setError(extractErrorMessage(e, '매핑 삭제에 실패했습니다.'));
    } finally {
      setBusyPlatform(null);
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 p-4">
        <div className="bg-white rounded-lg shadow-lg w-full max-w-lg flex flex-col max-h-[85vh]">
          <div className="flex items-center justify-between p-4 border-b">
            <div>
              <h2 className="text-lg font-semibold">몰별 카테고리 매핑</h2>
              <p className="text-xs text-gray-500 mt-1">표준: {category.name}</p>
            </div>
            <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
              ✕
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
                {error}
              </div>
            )}

            {LOOKUP_PLATFORMS.map(({ platform, label }) => {
              const mapping = mappingOf(platform);
              const busy = busyPlatform === platform;
              return (
                <div
                  key={platform}
                  className="border border-gray-200 rounded-lg p-3 flex items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-800">{label}</p>
                    {mapping ? (
                      <p className="text-xs text-gray-600 truncate">
                        {mapping.platformCategoryName || mapping.platformCategoryId}
                        <span className="text-gray-400"> · 코드 {mapping.platformCategoryId}</span>
                      </p>
                    ) : (
                      <p className="text-xs text-gray-400">미매핑</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 whitespace-nowrap">
                    {busy && <Spinner size={16} />}
                    <button
                      onClick={() => setPickerPlatform(platform)}
                      disabled={busy}
                      className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400"
                    >
                      {mapping ? '재조회' : '조회 매핑'}
                    </button>
                    {mapping && (
                      <button
                        onClick={() => void handleDelete(platform)}
                        disabled={busy}
                        className="px-3 py-1.5 text-sm border border-red-300 text-red-600 rounded hover:bg-red-50 disabled:opacity-50"
                      >
                        삭제
                      </button>
                    )}
                  </div>
                </div>
              );
            })}

            <p className="text-xs text-gray-400">
              매핑 시 쿠팡 기준 수수료가 자동으로 프리필됩니다(수수료 화면에서 수정 가능).
            </p>
          </div>

          <div className="flex justify-end p-4 border-t">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm border border-gray-300 rounded hover:bg-gray-100"
            >
              닫기
            </button>
          </div>
        </div>
      </div>

      {pickerPlatform && (
        <CategoryLookupPickerModal
          open={pickerPlatform !== null}
          platform={pickerPlatform}
          lookupUseCase={lookupUseCase}
          onSelect={(sel) => void handleUpsert(pickerPlatform, sel)}
          onClose={() => setPickerPlatform(null)}
        />
      )}
    </>
  );
}
