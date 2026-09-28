import type { PurchasePlace } from '@/domain/entities/PurchasePlace';

export interface PurchasePlaceRepository {
  list(): Promise<PurchasePlace[]>;
  create(name: string): Promise<PurchasePlace>;
  rename(id: number, name: string): Promise<PurchasePlace>;
  remove(id: number): Promise<void>;
}
