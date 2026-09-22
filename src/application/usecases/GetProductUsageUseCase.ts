import type { ProductUsage } from '@/domain/entities/ProductUsage';
import type { ProductUsageRepository } from '@/domain/repositories/ProductUsageRepository';

/**
 * 물품 연결 현황 조회 (FEATURE_2609_69 / A).
 *
 * 컨테이너에서 `useMemo(() => new GetProductUsageUseCase(new ProductUsageRepositoryImpl()), [])` 로 만든다.
 * 🔴 삭제 가능 여부(`deletable`)·사유(`blockers`)는 서버가 소유한다 — 여기서 다시 판정하지 않는다.
 */
export class GetProductUsageUseCase {
  constructor(private repository: ProductUsageRepository) {}

  execute(productId: number): Promise<ProductUsage> {
    return this.repository.getUsage(productId);
  }
}
