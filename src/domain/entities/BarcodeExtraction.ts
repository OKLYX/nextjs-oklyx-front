/**
 * 물품 사진에서 읽어낸 바코드 추출 결과 (FEATURE_2609_65).
 *
 * 백엔드 `BarcodeExtractionStatus` 와 1:1 이다. 🔴 사람이 읽는 문구는 여기가 아니라
 * `@/infrastructure/utils/barcodeExtraction` 이 소유한다 — 상세 알림과 목록 결과표가
 * 같은 문장을 써야 하기 때문이다.
 */
export type BarcodeExtractionStatus =
  | 'EXTRACTED'
  | 'NOT_FOUND'
  | 'NO_IMAGE'
  | 'READ_FAILED'
  | 'DUPLICATE'
  | 'SKIPPED_EXISTING';

export interface BarcodeExtractionItem {
  productId: number;
  productName: string;
  status: BarcodeExtractionStatus;
  barcode?: string | null;
  format?: string | null;
  productImageId?: number | null;
}

export interface BarcodeExtractionResult {
  requested: number;
  extracted: number;
  items: BarcodeExtractionItem[];
}
