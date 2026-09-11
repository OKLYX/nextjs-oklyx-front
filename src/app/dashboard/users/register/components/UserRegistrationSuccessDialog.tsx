'use client';

import { ConfirmDialog } from '@/presentation/components/ui/ConfirmDialog';

interface UserRegistrationSuccessDialogProps {
  isOpen: boolean;
  onGoToUserManage: () => void;
  onRegisterAnother: () => void;
}

/**
 * 회원등록 완료 안내 — 다음 작업 두 가지 중 하나를 고른다.
 * 확인(오른쪽) = 회원관리로 이동, 취소(왼쪽) = 계속 등록하기.
 */
export function UserRegistrationSuccessDialog({
  isOpen,
  onGoToUserManage,
  onRegisterAnother,
}: UserRegistrationSuccessDialogProps) {
  return (
    <ConfirmDialog
      isOpen={isOpen}
      title="회원등록 완료"
      message={
        <p className="whitespace-pre-line">
          {'새 회원이 등록되었습니다.\n등록된 회원은 GUEST 권한을 가지며,\n관리자가 권한을 변경해야 로그인할 수 있습니다.'}
        </p>
      }
      confirmText="회원관리로 이동"
      cancelText="계속 등록하기"
      onConfirm={onGoToUserManage}
      onCancel={onRegisterAnother}
    />
  );
}
