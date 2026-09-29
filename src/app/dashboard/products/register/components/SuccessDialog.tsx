'use client';

import { Modal } from '@/presentation/components/ui/Modal';
import { Button } from '@/presentation/components/ui/Button';

interface SuccessDialogProps {
  isOpen: boolean;
  onGoToList: () => void;
  onRegisterAnother: () => void;
  onCreateMaster: () => void;
}

/**
 * 상품 등록 완료 안내 — 다음 작업을 버튼 셋으로 고른다.
 * 결과는 잠깐 알림이 원칙이지만(UX D26), 이 창은 다음 일을 한 번에 고르게 하려고 팝업으로 둔 예외다(UX D44).
 * [다른 상품 등록] · [이 물품으로 마스터 만들기] · [상품 목록으로](주 버튼). ✕·ESC 는 [다른 상품 등록]과 같다.
 * [이 물품으로 마스터 만들기] = 판매 상품 관리 마스터 화면을 그 물품이 구성상품으로 골라진 채로 연다(UX D38 (가)).
 * ⚠️ 버튼이 셋이라 `ConfirmDialog`(버튼 둘)가 아니라 `Modal` 을 직접 쓴다. 폭이 좁은 `alert` 는 버튼 셋이 넘친다.
 */
export function SuccessDialog({
  isOpen,
  onGoToList,
  onRegisterAnother,
  onCreateMaster,
}: SuccessDialogProps) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onRegisterAnother}
      title="상품 등록 완료"
      footer={
        <>
          <Button variant="secondary" onClick={onRegisterAnother}>
            다른 상품 등록
          </Button>
          <Button variant="secondary" onClick={onCreateMaster}>
            이 물품으로 마스터 만들기
          </Button>
          <Button onClick={onGoToList}>상품 목록으로</Button>
        </>
      }
    >
      <p className="text-lg text-gray-600">상품이 등록되었습니다. 다음 작업을 선택해주세요.</p>
    </Modal>
  );
}
