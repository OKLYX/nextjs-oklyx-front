import type { PriceChangeRow, PriceHistoryParams } from '@/domain/entities/PriceHistoryEntity';

/** 가격 변경 이력 조회. 🔴 조회뿐이다 — 쓰기 메서드를 더하지 않는다(서버에도 없다). */
export interface PriceHistoryRepository {
  search(params: PriceHistoryParams): Promise<PriceChangeRow[]>;
}
