'use client';

import { useEffect } from 'react';
import { CarrierRateForm } from './CarrierRateForm';
import type { CreateCarrierRateRequest } from '@/application/dto/CreateCarrierRateRequest';

interface CreateCarrierRateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: CreateCarrierRateRequest) => Promise<void>;
  isLoading: boolean;
}

export function CreateCarrierRateModal({
  isOpen,
  onClose,
  onSubmit,
  isLoading,
}: CreateCarrierRateModalProps) {
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isLoading) {
        onClose();
      }
    };

    if (isOpen) {
      window.addEventListener('keydown', handleEsc);
      return () => window.removeEventListener('keydown', handleEsc);
    }
  }, [isOpen, isLoading, onClose]);

  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-lg shadow-lg max-w-md w-full mx-4">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold">택배비 추가</h2>
          <button
            onClick={onClose}
            disabled={isLoading}
            className="text-gray-500 hover:text-gray-700 disabled:opacity-50"
          >
            ✕
          </button>
        </div>

        <div className="p-4">
          <CarrierRateForm
            isLoading={isLoading}
            onSubmit={onSubmit}
            onCancel={onClose}
          />
        </div>
      </div>
    </div>
  );
}
