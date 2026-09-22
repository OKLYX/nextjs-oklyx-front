import type { ProductUsage } from '@/domain/entities/ProductUsage';

/**
 * 물품 연결 현황 조회 창구 (FEATURE_2609_69 / A).
 *
 * 🔴 조회 전용이다. 연결 해제는 마스터 상품 화면 · 셀 화면의 일이므로 여기에 넣지 않는다.
 */
export interface ProductUsageRepository {
  getUsage(productId: number): Promise<ProductUsage>;
}
