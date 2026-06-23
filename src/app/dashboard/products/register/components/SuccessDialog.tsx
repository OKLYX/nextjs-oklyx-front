'use client';

interface SuccessDialogProps {
  isOpen: boolean;
  onGoToList: () => void;
  onRegisterAnother: () => void;
}

export function SuccessDialog({
  isOpen,
  onGoToList,
  onRegisterAnother,
}: SuccessDialogProps) {
  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-8 max-w-md w-full mx-4 shadow-lg">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">상품 등록 완료</h2>
        <p className="text-gray-600 mb-8">
          상품이 등록되었습니다. 다음 작업을 선택해주세요.
        </p>

        <div className="flex gap-4">
          <button
            onClick={onGoToList}
            className="flex-1 px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
          >
            상품 목록으로
          </button>
          <button
            onClick={onRegisterAnother}
            className="flex-1 px-4 py-2 bg-gray-600 text-white font-medium rounded-lg hover:bg-gray-700 transition-colors"
          >
            다른 상품 등록
          </button>
        </div>
      </div>
    </div>
  );
}
