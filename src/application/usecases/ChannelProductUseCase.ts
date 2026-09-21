import type { ChannelProductRepository } from '@/domain/repositories/ChannelProductRepository';
import type {
  ChannelProductDetail,
  ChannelProductSearch,
} from '@/domain/entities/ChannelProductEntity';

/**
 * 마켓 상품 읽기(FEATURE_2609_67 — 물품 등록 참고 패널) 위임 계층.
 *
 * 화면에서 `useMemo(() => new ChannelProductUseCase(new ChannelProductRepositoryImpl()), [])` 로 만든다
 * (신규 화면 표준 = 레이어드 usecase, TanStack Query 아님).
 */
export class ChannelProductUseCase {
  constructor(private repository: ChannelProductRepository) {}

  search(
    sellerId: number,
    platform: string,
    name: string,
    nextToken?: string,
  ): Promise<ChannelProductSearch> {
    return this.repository.search(sellerId, platform, name, nextToken);
  }

  detail(
    sellerId: number,
    platform: string,
    platformProductId: string,
  ): Promise<ChannelProductDetail> {
    return this.repository.detail(sellerId, platform, platformProductId);
  }
}
