'use client';

import { Modal } from '@/presentation/components/ui/Modal';
import { Button } from '@/presentation/components/ui/Button';
import {
  BARCODE_TONE_CLASS,
  barcodeResultText,
  barcodeResultTone,
} from '@/infrastructure/utils/barcodeExtraction';
import type { BarcodeExtractionResult } from '@/domain/entities/BarcodeExtraction';

interface BarcodeExtractResultModalProps {
  result: BarcodeExtractionResult;
  onClose: () => void;
}

/**
 * 바코드 일괄 추출 결과 팝업 (FEATURE_2609_65).
 *
 * `isOpen` 은 `true` 고정이다 — 열고 닫는 판단은 컨테이너의 `extractResult` 가 소유한다
 * (null 이면 컨테이너가 이 컴포넌트를 아예 렌더하지 않는다).
 *
 * 🔴 실패 건을 숨기거나 접지 말 것 — **실패를 원인별로 보여주는 것이 이 기능의 절반**이다.
 * 상품 사진에는 바코드가 안 찍힌 경우가 대부분이라 `바코드를 찾지 못했습니다` 가 정상이다.
 */
export function BarcodeExtractResultModal({ result, onClose }: BarcodeExtractResultModalProps) {
  return (
    <Modal
      isOpen
      title="바코드 추출 결과"
      onClose={onClose}
      footer={<Button onClick={onClose}>확인</Button>}
    >
      <div className="space-y-3">
        <p className="text-sm text-gray-700">
          {result.requested}개 중 {result.extracted}개를 채웠습니다.
        </p>
        <div className="border border-gray-300 rounded-lg bg-white">
          <table className="w-full">
            <thead className="bg-gray-100 border-b border-gray-200">
              <tr>
                <th className="px-4 py-2 text-left text-sm font-semibold text-gray-900">물품명</th>
                <th className="px-4 py-2 text-left text-sm font-semibold text-gray-900">결과</th>
              </tr>
            </thead>
            <tbody>
              {result.items.map((item) => (
                <tr key={item.productId} className="border-b border-gray-200 last:border-b-0">
                  <td className="px-4 py-2 text-sm text-gray-900">{item.productName}</td>
                  <td className={`px-4 py-2 text-sm ${BARCODE_TONE_CLASS[barcodeResultTone(item.status)]}`}>
                    {barcodeResultText(item)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </Modal>
  );
}
