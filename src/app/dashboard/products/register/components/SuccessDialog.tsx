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
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Product Registered Successfully</h2>
        <p className="text-gray-600 mb-8">
          The product has been registered. What would you like to do next?
        </p>

        <div className="flex gap-4">
          <button
            onClick={onGoToList}
            className="flex-1 px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
          >
            Go to Product List
          </button>
          <button
            onClick={onRegisterAnother}
            className="flex-1 px-4 py-2 bg-gray-600 text-white font-medium rounded-lg hover:bg-gray-700 transition-colors"
          >
            Register Another Product
          </button>
        </div>
      </div>
    </div>
  );
}
