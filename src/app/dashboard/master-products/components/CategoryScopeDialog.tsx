'use client';

import { Modal } from '@/presentation/components/ui/Modal';
import { Button } from '@/presentation/components/ui/Button';
import { lookupPlatformLabel, type LookupPlatform } from './platformCategory';

interface CategoryScopeDialogProps {
  /** Platform of the category just picked. */
  platform: LookupPlatform;
  /** Display path of the pick (`namePath || name` from the picker). */
  path: string;
  /** [이 상품만 개별 지정] */
  onOwn: () => void;
  /** [기준 카테고리 연결을 바꾸기] */
  onBase: () => void;
  /** [취소] · ✕ · ESC — closes this dialog only and saves nothing (does not reopen the picker). */
  onCancel: () => void;
}

/**
 * 「적용 범위 선택」 — asked right after a platform category is picked (FEATURE_2610_12 / D51): save it for this
 * master only (「개별 지정」) or change the standard category mapping (every master using that standard category).
 * File: src/app/dashboard/master-products/components/CategoryScopeDialog.tsx
 *
 * **Used by**: the create form and detail [변경] lines (`PlatformCategoryRows`) and each row of
 * `MissingPlatformCategoryModal`. No default choice (D51).
 *
 * **Usage**:
 * ```tsx
 * {scopePick && (
 *   <CategoryScopeDialog platform={scopePick.platform} path={scopePick.path}
 *     onOwn={handleOwn} onBase={handleBase} onCancel={() => setScopePick(null)} />
 * )}
 * ```
 *
 * ⚠️ Always `nested` — it also opens on top of the missing-category popup.
 * ❌ Do not save inside this dialog — the caller owns the save (and, on the create form, the option-reset
 *    confirm of D52).
 */
export function CategoryScopeDialog({ platform, path, onOwn, onBase, onCancel }: CategoryScopeDialogProps) {
  return (
    <Modal
      isOpen
      onClose={onCancel}
      title="적용 범위 선택"
      nested
      footer={
        <>
          <Button variant="secondary" onClick={onCancel}>
            취소
          </Button>
          <Button onClick={onOwn}>이 상품만 개별 지정</Button>
          <Button onClick={onBase}>기준 카테고리 연결을 바꾸기</Button>
        </>
      }
    >
      <p className="text-sm text-gray-700">{`${lookupPlatformLabel(platform)} 카테고리를 ${path}(으)로 바꿉니다.`}</p>
    </Modal>
  );
}
