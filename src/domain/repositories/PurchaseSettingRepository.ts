import type { PurchaseSetting } from '@/domain/entities/PurchaseSettingEntity';

// GET is open to every signed-in user, PUT is ADMIN only (FEATURE_2610_09 D72).
export interface PurchaseSettingRepository {
  get(): Promise<PurchaseSetting>;
  update(setting: PurchaseSetting): Promise<PurchaseSetting>;
}
