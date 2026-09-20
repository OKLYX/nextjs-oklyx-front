import { axiosInstance } from '@/infrastructure/api/axiosInstance';
import type { BarcodeExtractionResult } from '@/domain/entities/BarcodeExtraction';
import type { BarcodeExtractionRepository } from '@/domain/repositories/BarcodeExtractionRepository';

export class BarcodeExtractionRepositoryImpl implements BarcodeExtractionRepository {
  /**
   * ⚠️ 사진을 여러 장 읽어 오래 걸린다. `axiosInstance` 에는 timeout 이 없지만(무제한)
   * 서버 앞단 프록시가 60초에서 끊을 수 있다 — 그때도 서버는 계속 돌고 저장도 계속되므로
   * 호출부는 "실패" 가 아니라 "결과를 받지 못했다" 로 안내한다(PLAN D14).
   */
  async extract(productIds: number[], overwrite: boolean): Promise<BarcodeExtractionResult> {
    const response = await axiosInstance.post('/api/admin/products/barcode-extraction', {
      productIds,
      overwrite,
    });
    return response.data.data;
  }
}
