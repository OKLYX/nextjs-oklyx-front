import axios from 'axios';
import { boxKindOf, type Package } from '@/domain/entities/PackageEntity';
import type { PackageUseCase } from '@/application/usecases/PackageUseCase';
import { UNREGISTERED_RECYCLED_BOX_TYPE } from './BoxChangeModal';

/**
 * Finds the shared 「재활용 상자(미등록)」 box, or creates it once (FEATURE_2611_06 / D17 · D20).
 *
 * **Purpose**: the only place that looks up / creates the shared unregistered recycled box. Both the packing
 * screen (box being packed · order detail [상자 변경]) and the 「포장 이력」 [상자 변경] call this.
 * **File**: src/app/dashboard/stock/packing/components/unregisteredRecycledBox.ts
 *
 * **Usage**:
 * ```ts
 * const { box, created } = await findOrCreateUnregisteredRecycledBox(allPackages, packageUseCase);
 * if (created) setAllPackages((previous) => [...previous, box]);
 * handleSelectBox(box.id);
 * ```
 * ```ts
 * // 「포장 이력」: pick the box for a packed parcel
 * const { box } = await findOrCreateUnregisteredRecycledBox(packages, packageUseCase);
 * await useCase.changeBox(target.parcelId, box.id);
 * ```
 *
 * ⚠️ Dimensions are unknown — the server requires at least 0.1cm, so they are 1cm. Cost 0 is allowed for
 * recycled boxes only.
 * ⚠️ A failed create throws an `Error` whose message is the server text (or the fallback) — the dialog shows it.
 * ❌ Do not write the same lookup again in a screen (root CLAUDE.md shared Service rule) — call this.
 */
export async function findOrCreateUnregisteredRecycledBox(
  packages: Package[],
  packageUseCase: PackageUseCase
): Promise<{ box: Package; created: boolean }> {
  const existing = packages.find(
    (pkg) => pkg.type === UNREGISTERED_RECYCLED_BOX_TYPE && boxKindOf(pkg) === 'RECYCLED'
  );
  if (existing) return { box: existing, created: false };
  try {
    const box = await packageUseCase.createPackage({
      type: UNREGISTERED_RECYCLED_BOX_TYPE,
      cost: 0,
      widthCm: 1,
      lengthCm: 1,
      heightCm: 1,
      isDefault: false,
      boxKind: 'RECYCLED',
    });
    return { box, created: true };
  } catch (error) {
    throw new Error(serverMessage(error, '재활용 상자를 준비하지 못했습니다'));
  }
}

/** Server text as is (same rule as the packing page's `serverMessage`) */
const serverMessage = (error: unknown, fallback: string): string => {
  if (axios.isAxiosError(error)) {
    const message = error.response?.data?.message;
    if (typeof message === 'string' && message.trim()) return message;
  }
  return fallback;
};
