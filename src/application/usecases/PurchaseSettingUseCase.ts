import type { PurchaseSettingRepository } from '@/domain/repositories/PurchaseSettingRepository';
import type { PurchaseSetting } from '@/domain/entities/PurchaseSettingEntity';

export class PurchaseSettingUseCase {
  constructor(private repository: PurchaseSettingRepository) {}

  async get(): Promise<PurchaseSetting> {
    return this.repository.get();
  }

  async update(setting: PurchaseSetting): Promise<PurchaseSetting> {
    return this.repository.update(setting);
  }
}
