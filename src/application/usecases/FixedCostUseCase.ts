import type {
  AccountFixedCost,
  AccountFixedCostRequestItem,
  CreateFixedCostRequest,
  PlatformFixedCost,
  UpdateFixedCostRequest,
} from '@/domain/entities/FixedCost';
import type { FixedCostRepository } from '@/domain/repositories/FixedCostRepository';

/**
 * 고정비 카탈로그 + 채널 연결 (FEATURE_2609_33).
 *
 * ⚠️ 화면은 부과 여부를 계산하지 않는다 — 판정은 서버가 달마다 한다(PLAN 2609_33 D2).
 */
export class FixedCostUseCase {
  constructor(private repository: FixedCostRepository) {}

  async list(): Promise<PlatformFixedCost[]> {
    return this.repository.list();
  }

  async create(data: CreateFixedCostRequest): Promise<PlatformFixedCost> {
    return this.repository.create(data);
  }

  async update(id: number, data: UpdateFixedCostRequest): Promise<PlatformFixedCost> {
    return this.repository.update(id, data);
  }

  async remove(id: number): Promise<void> {
    return this.repository.remove(id);
  }

  async listForAccount(accountId: number): Promise<AccountFixedCost[]> {
    return this.repository.listForAccount(accountId);
  }

  async setForAccount(accountId: number, items: AccountFixedCostRequestItem[]): Promise<void> {
    return this.repository.setForAccount(accountId, items);
  }
}
