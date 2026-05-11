'use client';

interface UserRegistrationSuccessDialogProps {
  isOpen: boolean;
  onGoToUserManage: () => void;
  onRegisterAnother: () => void;
}

export function UserRegistrationSuccessDialog({
  isOpen,
  onGoToUserManage,
  onRegisterAnother,
}: UserRegistrationSuccessDialogProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 p-4">
      <div className="bg-white rounded-lg shadow-lg max-w-lg w-full p-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">회원등록 완료</h2>
        <p className="text-gray-600 mb-6 whitespace-pre-line">
          새 회원이 등록되었습니다.
등록된 회원은 GUEST 권한을 가지며,
관리자가 권한을 변경해야 로그인할 수 있습니다.
        </p>
        <div className="flex gap-4 justify-center">
          <button
            onClick={onGoToUserManage}
            className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
          >
            회원관리로 이동
          </button>
          <button
            onClick={onRegisterAnother}
            className="px-6 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors"
          >
            계속 등록하기
          </button>
        </div>
      </div>
    </div>
  );
}
