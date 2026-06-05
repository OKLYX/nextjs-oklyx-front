'use client';

interface ProductListingDeleteDialogProps {
  isOpen: boolean;
  isLoading: boolean;
  listingId: number;
  listingName: string;
  error?: string;
  onConfirm: () => Promise<void>;
  onCancel: () => void;
}

export function ProductListingDeleteDialog({
  isOpen,
  isLoading,
  listingName,
  error,
  onConfirm,
  onCancel,
}: ProductListingDeleteDialogProps) {
  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-md w-full">
        {/* Header */}
        <div className="border-b border-gray-200 px-6 py-4">
          <h2 className="text-xl font-bold">판매상품 삭제</h2>
        </div>

        {/* Content */}
        <div className="px-6 py-4 space-y-4">
          {/* Error Banner */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-700 text-sm">
              {error}
            </div>
          )}

          {/* Confirmation Message */}
          <div className="space-y-2">
            <p className="text-gray-700">
              정말 삭제하시겠습니까?
              <br />
              <span className="font-semibold">{listingName}</span>
            </p>
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded p-3">
              ⚠️ 삭제된 데이터는 복구할 수 없습니다.
            </p>
          </div>
        </div>

        {/* Footer with buttons */}
        <div className="bg-gray-50 border-t border-gray-200 px-6 py-4 flex justify-end gap-2">
          <button
            onClick={onCancel}
            disabled={isLoading}
            className="px-4 py-2 bg-gray-300 text-gray-800 font-medium rounded-lg hover:bg-gray-400 disabled:opacity-50 transition-colors"
          >
            취소
          </button>
          <button
            onClick={onConfirm}
            disabled={isLoading}
            className="px-4 py-2 bg-red-600 text-white font-medium rounded-lg hover:bg-red-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
          >
            {isLoading ? '삭제 중...' : '삭제'}
          </button>
        </div>
      </div>
    </div>
  );
}
