'use client';

import { useState } from 'react';
import { Modal } from '@/presentation/components/ui/Modal';
import { Button } from '@/presentation/components/ui/Button';
import { Spinner } from '@/presentation/components/Spinner';
import { extractErrorMessage } from '@/infrastructure/utils/errorMessage';
import { CategoryLookupPickerModal } from '@/app/dashboard/costs/category/components/CategoryLookupPickerModal';
import type { CategoryMappingUseCase } from '@/application/usecases/CategoryMappingUseCase';
import type { CategoryLookupUseCase } from '@/application/usecases/CategoryLookupUseCase';
import { lookupPlatformLabel, type LookupPlatform } from './platformCategory';

interface MissingPlatformCategoryModalProps {
  /** Standard category the picked platform categories are saved to (its mapping rows). */
  categoryId: number;
  /** Standard category name — shown in the notice line. */
  categoryName: string;
  /** Platforms the standard category has no mapping for (one row each, in this order). */
  platforms: LookupPlatform[];
  mappingUseCase: CategoryMappingUseCase;
  lookupUseCase: CategoryLookupUseCase;
  /** Every close path ([건너뛰기] · [완료] · ✕ · ESC · outside click) — the caller continues its flow. */
  onClose: () => void;
}

/**
 * 「플랫폼 카테고리 선택」 popup — asks for the platform categories a just-picked standard category is missing
 * (FEATURE_2610_11 / D8 · D9 · D10 · D18).
 * File: src/app/dashboard/master-products/components/MissingPlatformCategoryModal.tsx
 *
 * **Purpose**: one row per missing platform + [카테고리 선택하기] → the shared `CategoryLookupPickerModal` →
 * the pick is saved as the standard category's mapping (`upsertMapping`, the same row the category screen's
 * 「몰별 카테고리 매핑」 writes — it applies to every master using this standard category, D2).
 * **Required rule**: when a standard category is picked on a master screen (detail leaf click · create
 * [설정적용]), the missing platforms are asked through this popup. The caller mounts it with `&&` (fresh
 * state per open) and continues (assign / lock the category) in `onClose` — skipping is allowed (D4).
 *
 * **Usage**:
 * ```tsx
 * // Master detail: before `setCategory` (D8)
 * {pendingLeaf && (
 *   <MissingPlatformCategoryModal categoryId={pendingLeaf.leaf.id} categoryName={pendingLeaf.leaf.name}
 *     platforms={pendingLeaf.platforms} mappingUseCase={mappingUseCase} lookupUseCase={lookupUseCase}
 *     onClose={handleMissingClose} />
 * )}
 * // Master create: after [설정적용], before the category locks (D8)
 * {missingPrompt && (
 *   <MissingPlatformCategoryModal {...missingPrompt} mappingUseCase={mappingUseCase}
 *     lookupUseCase={lookupUseCase} onClose={handleMissingClose} />
 * )}
 * ```
 *
 * ⚠️ A failed save closes the picker too, so the banner on top of this popup is not hidden (2610_05 / D39).
 * ⚠️ While a save is in flight the popup cannot be closed (`disableClose`) — the caller's next step
 *    (assign) must see the saved row.
 * ❌ Do not edit `CategoryLookupPickerModal` or `CategoryMappingModal` for this popup (D9).
 * ❌ Naver is never passed in — it has no category list (D18 (d)).
 */
export function MissingPlatformCategoryModal({
  categoryId,
  categoryName,
  platforms,
  mappingUseCase,
  lookupUseCase,
  onClose,
}: MissingPlatformCategoryModalProps) {
  const [picked, setPicked] = useState<Partial<Record<LookupPlatform, string>>>({});
  const [pickerPlatform, setPickerPlatform] = useState<LookupPlatform | null>(null);
  const [busyPlatform, setBusyPlatform] = useState<LookupPlatform | null>(null);
  const [error, setError] = useState('');

  const remaining = platforms.filter((p) => picked[p] == null);

  const handleSelect = async (
    platform: LookupPlatform,
    sel: { platformCategoryId: string; name: string; namePath: string },
  ) => {
    setError('');
    setBusyPlatform(platform);
    try {
      await mappingUseCase.upsertMapping(categoryId, {
        platform,
        platformCategoryId: sel.platformCategoryId,
        platformCategoryName: sel.namePath || sel.name,
      });
      setPicked((prev) => ({ ...prev, [platform]: sel.namePath || sel.name }));
      setPickerPlatform(null);
    } catch (e) {
      // Close the picker on failure too, so the banner below is not hidden behind it (2610_05/D39).
      setPickerPlatform(null);
      setError(extractErrorMessage(e, '매핑 저장에 실패했습니다.'));
    } finally {
      setBusyPlatform(null);
    }
  };

  return (
    <>
      <Modal
        isOpen
        onClose={onClose}
        title="플랫폼 카테고리 선택"
        closeOnOverlayClick
        disableClose={busyPlatform !== null}
        footer={
          <Button
            variant={remaining.length > 0 ? 'secondary' : 'primary'}
            onClick={onClose}
            disabled={busyPlatform !== null}
          >
            {remaining.length > 0 ? '건너뛰기' : '완료'}
          </Button>
        }
      >
        <div className="space-y-3">
          {error && (
            <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>
          )}
          <p className="text-sm text-gray-700">
            {`${categoryName}에 맞는 카테고리가 없는 플랫폼입니다. 고르면 이 기준 카테고리를 쓰는 모든 마스터에 적용됩니다. 건너뛰면 그 플랫폼에는 올릴 수 없습니다.`}
          </p>
          {platforms.map((platform) => (
            <div
              key={platform}
              className="flex items-center justify-between gap-3 rounded-lg border border-gray-200 p-3"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-800">{lookupPlatformLabel(platform)}</p>
                {picked[platform] != null && (
                  <p className="truncate text-xs text-gray-600">{picked[platform]}</p>
                )}
              </div>
              <div className="flex items-center gap-2 whitespace-nowrap">
                {busyPlatform === platform && <Spinner size={16} />}
                <Button
                  size="sm"
                  onClick={() => setPickerPlatform(platform)}
                  disabled={busyPlatform !== null}
                >
                  카테고리 선택하기
                </Button>
              </div>
            </div>
          ))}
        </div>
      </Modal>

      {pickerPlatform && (
        <CategoryLookupPickerModal
          open={pickerPlatform !== null}
          platform={pickerPlatform}
          lookupUseCase={lookupUseCase}
          onSelect={(sel) => void handleSelect(pickerPlatform, sel)}
          onClose={() => setPickerPlatform(null)}
        />
      )}
    </>
  );
}
