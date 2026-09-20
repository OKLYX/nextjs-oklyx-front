import type {
  BarcodeExtractionItem,
  BarcodeExtractionStatus,
} from '@/domain/entities/BarcodeExtraction';

/**
 * 바코드 추출 결과 1건을 사람이 읽는 한 문장으로 바꾼다 (FEATURE_2609_65 / PLAN D12).
 *
 * **용도**: 물품 상세의 한 줄 알림과 물품 목록의 결과표가 **같은 문장**을 쓰게 한다.
 * **파일**: src/infrastructure/utils/barcodeExtraction.ts
 *
 * 🔴 문구를 컴포넌트에 각각 적지 말 것 — 두 화면이 같은 결과를 다르게 설명하면
 * 사용자가 다른 일이 일어난 줄 안다.
 */
export function barcodeResultText(item: BarcodeExtractionItem): string {
  switch (item.status) {
    case 'EXTRACTED':
      return `${item.barcode} (${item.format})`;
    case 'NOT_FOUND':
      return '바코드를 찾지 못했습니다';
    case 'NO_IMAGE':
      return '사진이 없습니다';
    case 'READ_FAILED':
      return '사진을 불러오지 못했습니다';
    case 'DUPLICATE':
      return `다른 물품이 쓰는 바코드입니다 (${item.barcode})`;
    case 'SKIPPED_EXISTING':
      return '이미 바코드가 있습니다';
  }
}

export type BarcodeResultTone = 'ok' | 'warn' | 'muted';

/**
 * 결과 문장의 색조.
 *
 * 🔴 `NOT_FOUND` 를 빨갛게 하지 말 것 — 상품 사진에 바코드가 안 찍힌 경우가 **대부분**이라
 * 정상적인 결과다. 빨간 화면은 장애처럼 보인다. 사람이 볼 일인 `DUPLICATE`(엉뚱한 물품을
 * 집게 만들 뻔한 값) 와 `READ_FAILED`(S3·네트워크 이상) 만 경고색이다.
 */
export function barcodeResultTone(status: BarcodeExtractionStatus): BarcodeResultTone {
  if (status === 'EXTRACTED') return 'ok';
  if (status === 'DUPLICATE' || status === 'READ_FAILED') return 'warn';
  return 'muted';
}

/** 색조 → Tailwind 글자색. 상세 알림·결과표 공용. */
export const BARCODE_TONE_CLASS: Record<BarcodeResultTone, string> = {
  ok: 'text-green-700',
  warn: 'text-red-600',
  muted: 'text-gray-600',
};
