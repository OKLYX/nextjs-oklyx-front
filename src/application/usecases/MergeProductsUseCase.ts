import type {
  MergeProductsRequest,
  MergeProductsResponse,
  ProductMergeRepository,
} from '@/domain/repositories/ProductMergeRepository';

/**
 * 중복 물품 2건 병합 (FEATURE_2609_69 / B).
 *
 * 컨테이너에서 `useMemo(() => new MergeProductsUseCase(new ProductMergeRepositoryImpl()), [])` 로 만든다.
 * 🔴 판정(무엇을 옮기고 무엇을 버릴지)은 화면에서 사람이 한다 — 여기서 추천값을 만들지 않는다.
 */
export class MergeProductsUseCase {
  constructor(private repository: ProductMergeRepository) {}

  execute(request: MergeProductsRequest): Promise<MergeProductsResponse> {
    return this.repository.merge(request);
  }
}
