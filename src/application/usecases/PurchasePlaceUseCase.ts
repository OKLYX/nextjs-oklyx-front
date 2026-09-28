import type { PurchasePlaceRepository } from '@/domain/repositories/PurchasePlaceRepository';
import type { PurchasePlace } from '@/domain/entities/PurchasePlace';

/**
 * 구매처 목록 usecase (FEATURE_2609_76).
 * 얇은 위임만 — 로직을 넣지 말 것(`DetailImageGroupUseCase` 와 같은 모양).
 */
export class PurchasePlaceUseCase {
  constructor(private repository: PurchasePlaceRepository) {}

  list(): Promise<PurchasePlace[]> {
    return this.repository.list();
  }

  create(name: string): Promise<PurchasePlace> {
    return this.repository.create(name);
  }

  rename(id: number, name: string): Promise<PurchasePlace> {
    return this.repository.rename(id, name);
  }

  remove(id: number): Promise<void> {
    return this.repository.remove(id);
  }
}
