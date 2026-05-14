'use client';

import { useEffect } from 'react';
import { CarrierRateForm } from './CarrierRateForm';
import type { CarrierRate } from '@/domain/entities/CarrierRateEntity';
import type { UpdateCarrierRateRequest } from '@/application/dto/UpdateCarrierRateRequest';

interface EditCarrierRateModalProps {
  isOpen: boolean;
  carrierRate: CarrierRate | null;
  onClose: () => void;
  onSubmit: (data: UpdateCarrierRateRequest) => Promise<void>;
  isLoading: boolean;
}

export function EditCarrierRateModal({
  isOpen,
  carrierRate,
  onClose,
  onSubmit,
  isLoading,
}: EditCarrierRateModalProps) {
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
          <div>
            <h2 className="text-lg font-semibold">택배비 수정</h2>
            {carrierRate && (
              <p className="text-xs text-gray-500 mt-1">ID: {carrierRate.id}</p>
            )}
          </div>
          <button
            onClick={onClose}
            disabled={isLoading}
            className="text-gray-500 hover:text-gray-700 disabled:opacity-50"
          >
            ✕
          </button>
        </div>

        <div className="p-4">
          {carrierRate && (
            <EditCarrierRateForm
              carrierRate={carrierRate}
              isLoading={isLoading}
              onSubmit={onSubmit}
              onCancel={onClose}
            />
          )}
        </div>
      </div>
    </div>
  );
}

interface EditCarrierRateFormProps {
  carrierRate: CarrierRate;
  isLoading: boolean;
  onSubmit: (data: UpdateCarrierRateRequest) => Promise<void>;
  onCancel: () => void;
}

function EditCarrierRateForm({
  carrierRate,
  isLoading,
  onSubmit,
  onCancel,
}: EditCarrierRateFormProps) {
  return (
    <CarrierRateForm
      isLoading={isLoading}
      onSubmit={onSubmit}
      onCancel={onCancel}
      initialData={{
        carrier: carrierRate.carrier,
        type: carrierRate.type,
        cost: String(carrierRate.cost),
        effectiveDate: carrierRate.effectiveDate,
        isDefault: carrierRate.isDefault,
      }}
      submitButtonLabel="수정"
      submitLoadingLabel="수정 중..."
    />
  );
}
