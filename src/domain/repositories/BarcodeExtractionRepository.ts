import type { BarcodeExtractionResult } from '@/domain/entities/BarcodeExtraction';

/**
 * 물품 사진에서 바코드를 추출하는 창구 (FEATURE_2609_65 / PLAN D1).
 *
 * 🔴 엔드포인트가 하나다 — 상세 단건도 id 1개짜리 배열을 보낸다.
 * `overwrite` 는 상세 단건(확인창 통과) 에서만 true 이고 목록 일괄은 항상 false 다(PLAN D7).
 */
export interface BarcodeExtractionRepository {
  extract(productIds: number[], overwrite: boolean): Promise<BarcodeExtractionResult>;
}
