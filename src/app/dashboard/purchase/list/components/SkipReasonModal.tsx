'use client';

import { Modal } from '@/presentation/components/ui/Modal';
import { Button } from '@/presentation/components/ui/Button';

/**
 * [오늘 매입 안 함] reason picker (FEATURE_2610_09 D61 · D66 · D67).
 * 「내일 매입」 = off the list today only · 「매입할 필요 없음」 = to the completed tab as 「필요 없음」.
 */
interface SkipReasonModalProps {
  /** `{productName} · {sellerName}` of the share; null closes the popup. */
  target: string | null;
  isLoading: boolean;
  onPick: (status: 'TOMORROW' | 'NOT_NEEDED') => void;
  onClose: () => void;
}

export function SkipReasonModal({ target, isLoading, onPick, onClose }: SkipReasonModalProps) {
  return (
    <Modal
      isOpen={target !== null}
      onClose={onClose}
      title="오늘 매입 안 함"
      variant="alert"
      disableClose={isLoading}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={isLoading}>
            취소
          </Button>
          <Button variant="secondary" onClick={() => onPick('NOT_NEEDED')} disabled={isLoading}>
            매입할 필요 없음
          </Button>
          <Button onClick={() => onPick('TOMORROW')} disabled={isLoading}>
            내일 매입
          </Button>
        </>
      }
    >
      <p className="text-sm text-gray-700">{target}</p>
      <p className="mt-2 text-sm text-gray-500">오늘 사지 않는 이유를 고르세요.</p>
    </Modal>
  );
}
