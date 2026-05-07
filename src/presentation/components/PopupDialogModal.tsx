'use client';

import { ReactNode } from 'react';

interface PopupDialogModalProps {
  isOpen: boolean;
  title: string;
  message: ReactNode;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
  isDangerous?: boolean;
}

export function PopupDialogModal({
  isOpen,
  title,
  message,
  confirmText = '확인',
  cancelText = '취소',
  onConfirm,
  onCancel,
  isDangerous = false,
}: PopupDialogModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-25 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-lg p-8 max-w-lg mx-4">
        <h3 className="text-2xl font-semibold text-gray-900 mb-6">
          {title}
        </h3>
        <div className="text-gray-600 mb-8 text-lg">
          {message}
        </div>
        <div className="flex gap-3 justify-end">
          <button
            onClick={onCancel}
            className="px-6 py-3 bg-gray-300 text-gray-700 font-semibold text-base rounded-lg hover:bg-gray-400 transition-colors"
          >
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            className={`px-6 py-3 text-white font-semibold text-base rounded-lg transition-colors ${
              isDangerous
                ? 'bg-red-600 hover:bg-red-700'
                : 'bg-blue-600 hover:bg-blue-700'
            }`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
