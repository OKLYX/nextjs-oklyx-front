'use client';

import { useEffect } from 'react';
import { CommissionRateForm } from './CommissionRateForm';
import type {
  CreateCommissionRateFormData,
  UpdateCommissionRateFormData,
} from '@/application/schemas/CommissionRateSchema';

interface CreateCommissionRateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (
    data: CreateCommissionRateFormData | UpdateCommissionRateFormData
  ) => Promise<void>;
  isSubmitting: boolean;
}

export function CreateCommissionRateModal({
  isOpen,
  onClose,
  onSubmit,
  isSubmitting,
}: CreateCommissionRateModalProps) {
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isSubmitting) {
        onClose();
      }
    };

    if (isOpen) {
      window.addEventListener('keydown', handleEsc);
      return () => window.removeEventListener('keydown', handleEsc);
    }
  }, [isOpen, isSubmitting, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-lg shadow-lg max-w-md w-full mx-4">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold">수수료 추가</h2>
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="text-gray-500 hover:text-gray-700 disabled:opacity-50"
          >
            ✕
          </button>
        </div>

        <div className="p-4">
          <CommissionRateForm
            onSubmit={onSubmit}
            onCancel={onClose}
            isLoading={isSubmitting}
          />
        </div>
      </div>
    </div>
  );
}
