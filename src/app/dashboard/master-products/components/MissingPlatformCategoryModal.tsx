'use client';

import { useState } from 'react';
import { Modal } from '@/presentation/components/ui/Modal';
import { Button } from '@/presentation/components/ui/Button';
import { Spinner } from '@/presentation/components/Spinner';
import { extractErrorMessage } from '@/infrastructure/utils/errorMessage';
import { CategoryLookupPickerModal } from '@/app/dashboard/costs/category/components/CategoryLookupPickerModal';
import type { CategoryMappingUseCase } from '@/application/usecases/CategoryMappingUseCase';
import type { CategoryLookupUseCase } from '@/application/usecases/CategoryLookupUseCase';
import type { MasterPlatformCategoryRequest } from '@/domain/entities/MasterProductEntity';
import {
  LOOKUP_PLATFORMS,
  lookupPlatformLabel,
  type LookupPlatform,
  type PlatformCategoryRow,
} from './platformCategory';
import { CategoryScopeDialog } from './CategoryScopeDialog';

type PickerSelection = { platformCategoryId: string; name: string; namePath: string };

interface MissingPlatformCategoryModalProps {
  /** Standard category a 「기준 카테고리 연결을 바꾸기」 pick is saved to (its mapping rows). */
  categoryId: number;
  /** Standard category name — shown in the notice line when `categoryPath` is absent. */
  categoryName: string;
  /** Full path of the standard category (`standardCategoryPathOf`) — shown in the notice and the picker. */
  categoryPath?: string;
  /** Platforms the standard category has no category for — the rows that get [카테고리 선택하기]. */
  platforms: LookupPlatform[];
  /**
   * Every lookup platform's current state for this standard category (`platformCategoryRowsOf`), so the popup
   * shows what is already chosen next to what is missing. Absent = only the missing rows are shown.
   */
  current?: PlatformCategoryRow[];
  mappingUseCase: CategoryMappingUseCase;
  lookupUseCase: CategoryLookupUseCase;
  /**
   * Wraps every scope choice before it is applied — the create form passes its option-reset confirm (D52).
   * Absent = the choice is applied right away (master detail, D47).
   */
  confirmChange?: (apply: () => void) => void;
  /**
   * Every close path ([건너뛰기] · [완료] · ✕ · ESC · outside click). `ownPicks` = the 「이 상품만 개별 지정」
   * picks, NOT saved here — the caller saves them after the standard category is assigned (D53).
   */
  onClose: (ownPicks: MasterPlatformCategoryRequest[]) => void;
}

/**
 * 「플랫폼 카테고리 선택」 popup — asks for the platform categories a just-picked standard category is missing
 * (FEATURE_2610_11 / D8 · D10 · D18 · FEATURE_2610_12 / D43 · D51).
 * File: src/app/dashboard/master-products/components/MissingPlatformCategoryModal.tsx
 *
 * **Purpose**: the platforms that already have a category are listed first with their path (「(연결됨)」 ·
 * 「(개별 지정)」, from `current`), then one row per missing platform + [카테고리 선택하기] → the shared `CategoryLookupPickerModal` →
 * 「적용 범위 선택」 (`CategoryScopeDialog`): [기준 카테고리 연결을 바꾸기] saves the standard category's mapping
 * here (`upsertMapping`, the same row the category screen's 「몰별 카테고리 매핑」 writes — every master using
 * this standard category); [이 상품만 개별 지정] is handed back through `onClose` and saved by the caller after
 * the category assignment (D53 — assigning a different category deletes own rows, D42).
 * **Required rule**: when a standard category is picked on a master screen (detail leaf click · create
 * [설정적용]), the missing platforms are asked through this popup. The caller mounts it with `&&` (fresh
 * state per open) and continues (assign / lock the category, then save `ownPicks`) in `onClose` — skipping is
 * allowed (2610_11 / D4).
 *
 * **Usage**:
 * ```tsx
 * // Master detail: before `setCategory` (2610_11 / D8)
 * {pendingLeaf && (
 *   <MissingPlatformCategoryModal categoryId={pendingLeaf.leaf.id} categoryName={pendingLeaf.leaf.name}
 *     platforms={pendingLeaf.platforms} mappingUseCase={mappingUseCase} lookupUseCase={lookupUseCase}
 *     onClose={handleMissingClose} />
 * )}
 * // Master create: after [설정적용], before the category locks — with the option-reset confirm (D52)
 * {missingPrompt && (
 *   <MissingPlatformCategoryModal {...missingPrompt} mappingUseCase={mappingUseCase}
 *     lookupUseCase={lookupUseCase} confirmChange={runWithOptionReset} onClose={handleMissingClose} />
 * )}
 * ```
 *
 * ⚠️ The picker closes as soon as a category is picked (the scope dialog follows), so a failed save's banner is
 *    never hidden behind it (2610_05 / D39).
 * ⚠️ While a save is in flight the popup cannot be closed (`disableClose`) — the caller's next step
 *    (assign) must see the saved row.
 * ❌ Do not edit `CategoryLookupPickerModal` or `CategoryMappingModal` for this popup (2610_11 / D9).
 * ❌ Naver is never passed in — it has no category list (2610_11 / D18 (d)).
 */
export function MissingPlatformCategoryModal({
  categoryId,
  categoryName,
  categoryPath,
  platforms,
  current,
  mappingUseCase,
  lookupUseCase,
  confirmChange,
  onClose,
}: MissingPlatformCategoryModalProps) {
  // Display path of the mapping saved in this popup, per platform.
  const [savedPath, setSavedPath] = useState<Partial<Record<LookupPlatform, string>>>({});
  // 「개별 지정」 picks, handed back on close (D53). They win over a mapping saved here for the display (D41).
  const [ownPicks, setOwnPicks] = useState<Partial<Record<LookupPlatform, MasterPlatformCategoryRequest>>>({});
  const [pickerPlatform, setPickerPlatform] = useState<LookupPlatform | null>(null);
  const [scopePick, setScopePick] = useState<{ platform: LookupPlatform; sel: PickerSelection } | null>(null);
  const [busyPlatform, setBusyPlatform] = useState<LookupPlatform | null>(null);
  const [error, setError] = useState('');

  const pickedPath = (platform: LookupPlatform): string | null => {
    const own = ownPicks[platform];
    if (own) return `${own.platformCategoryName ?? own.platformCategoryId} (개별 지정)`;
    return savedPath[platform] ?? null;
  };
  const remaining = platforms.filter((p) => pickedPath(p) == null);
  // Shown in the picker: the standard category, then every other platform's category chosen so far.
  const referencesFor = (target: LookupPlatform): { label: string; path: string }[] => [
    { label: '기준 카테고리', path: categoryPath ?? categoryName },
    ...LOOKUP_PLATFORMS.filter((p) => p !== target).flatMap((p) => {
      const path = pickedPath(p) ?? current?.find((row) => row.platform === p)?.path ?? null;
      const own = current?.find((row) => row.platform === p)?.own;
      if (path == null) return [];
      return [{ label: lookupPlatformLabel(p), path: own && !pickedPath(p) ? `${path} (개별 지정)` : path }];
    }),
  ];
  const close = () => onClose(Object.values(ownPicks).filter((o): o is MasterPlatformCategoryRequest => o != null));
  const apply = (run: () => void) => (confirmChange ? confirmChange(run) : run());

  const handlePicked = (platform: LookupPlatform, sel: PickerSelection) => {
    setPickerPlatform(null);
    setScopePick({ platform, sel });
  };

  const saveBase = async (platform: LookupPlatform, sel: PickerSelection) => {
    setError('');
    setBusyPlatform(platform);
    try {
      await mappingUseCase.upsertMapping(categoryId, {
        platform,
        platformCategoryId: sel.platformCategoryId,
        platformCategoryName: sel.namePath || sel.name,
      });
      setSavedPath((prev) => ({ ...prev, [platform]: sel.namePath || sel.name }));
    } catch (e) {
      setError(extractErrorMessage(e, '매핑 저장에 실패했습니다.'));
    } finally {
      setBusyPlatform(null);
    }
  };

  const handleOwn = () => {
    if (!scopePick) return;
    const { platform, sel } = scopePick;
    setScopePick(null);
    apply(() =>
      setOwnPicks((prev) => ({
        ...prev,
        [platform]: { platform, platformCategoryId: sel.platformCategoryId, platformCategoryName: sel.namePath || sel.name },
      })),
    );
  };

  const handleBase = () => {
    if (!scopePick) return;
    const { platform, sel } = scopePick;
    setScopePick(null);
    apply(() => void saveBase(platform, sel));
  };

  return (
    <>
      <Modal
        isOpen
        onClose={close}
        title="플랫폼 카테고리 선택"
        closeOnOverlayClick
        disableClose={busyPlatform !== null}
        footer={
          <Button
            variant={remaining.length > 0 ? 'secondary' : 'primary'}
            onClick={close}
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
            {`기준 카테고리 「${categoryPath ?? categoryName}」에 맞는 카테고리가 없는 플랫폼이 있습니다. [카테고리 선택하기]로 고른 뒤 이 상품만 개별 지정할지, 이 기준 카테고리를 쓰는 모든 마스터에 연결할지 고릅니다. 건너뛰면 그 플랫폼에는 올릴 수 없습니다.`}
          </p>
          {(current ?? [])
            .filter((row) => !platforms.includes(row.platform) && row.path != null)
            .map((row) => (
              <div key={row.platform} className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                <p className="text-sm font-medium text-gray-800">{lookupPlatformLabel(row.platform)}</p>
                <p className="truncate text-xs text-gray-600" title={row.path ?? undefined}>
                  {row.path}
                  {row.own ? ' (개별 지정)' : ' (연결됨)'}
                </p>
              </div>
            ))}
          {platforms.map((platform) => (
            <div
              key={platform}
              className="flex items-center justify-between gap-3 rounded-lg border border-gray-200 p-3"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium text-gray-800">{lookupPlatformLabel(platform)}</p>
                <p className="truncate text-xs text-gray-600">{pickedPath(platform) ?? '카테고리 없음'}</p>
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
          references={referencesFor(pickerPlatform)}
          onSelect={(sel) => handlePicked(pickerPlatform, sel)}
          onClose={() => setPickerPlatform(null)}
        />
      )}

      {scopePick && (
        <CategoryScopeDialog
          platform={scopePick.platform}
          path={scopePick.sel.namePath || scopePick.sel.name}
          onOwn={handleOwn}
          onBase={handleBase}
          onCancel={() => setScopePick(null)}
        />
      )}
    </>
  );
}
