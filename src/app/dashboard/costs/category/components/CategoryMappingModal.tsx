'use client';

import { useState } from 'react';
import { Spinner } from '@/presentation/components/Spinner';
import { CategoryLookupPickerModal } from './CategoryLookupPickerModal';
import { extractErrorMessage } from '@/infrastructure/utils/errorMessage';
import type { CategoryMappingUseCase } from '@/application/usecases/CategoryMappingUseCase';
import type { CategoryLookupUseCase } from '@/application/usecases/CategoryLookupUseCase';
import type { Category } from '@/domain/entities/CategoryEntity';
import type { CategoryMapping } from '@/domain/entities/CategoryMappingEntity';
import { Modal } from '@/presentation/components/ui/Modal';

/**
 * Per-mall mapping status of a standard category + filling it (reuses the lookup picker) modal.
 *
 * Built on `ui/Modal`. Per mall, the current mapping (code/path) or 「미매핑」 +
 * a [조회 매핑] button → `CategoryLookupPickerModal` (that platform) → pick → `upsertMapping`.
 * Delete = `deleteMapping`. The useCases are **the parent's instances**.
 *
 * ⚠️ Lookup platforms = Coupang and 11st (11st browses the imported 11st list — FEATURE_2610_10 / D21 ③).
 *    Naver is a backend seam only (later) — no [조회 매핑] for it.
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

// Platforms the lookup picker can open for (Coupang, 11st). Naver is a backend seam only → later.
const LOOKUP_PLATFORMS: { platform: 'COUPANG' | 'ELEVENST'; label: string }[] = [
  { platform: 'COUPANG', label: '쿠팡' },
  { platform: 'ELEVENST', label: '11번가' },
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
  const [pickerPlatform, setPickerPlatform] = useState<'COUPANG' | 'NAVER' | 'ELEVENST' | null>(null);

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
      // Close the picker on failure too, so the banner below is not hidden behind it (2610_05/D39).
      setPickerPlatform(null);
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
      <Modal
        isOpen
        onClose={onClose}
        title="몰별 카테고리 매핑"
      >
        <p className="text-xs text-gray-500 mt-1">표준: {category.name}</p>

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
      </Modal>

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
