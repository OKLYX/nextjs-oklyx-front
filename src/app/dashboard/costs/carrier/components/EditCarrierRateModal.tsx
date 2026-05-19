'use client';

import { useEffect } from 'react';
import { CarrierRateForm } from './CarrierRateForm';
import { PopupDialogModal } from '@/presentation/components/PopupDialogModal';
import type { CarrierRate } from '@/domain/entities/CarrierRateEntity';
import type { UpdateCarrierRateRequest } from '@/application/dto/UpdateCarrierRateRequest';

interface EditCarrierRateModalProps {
  isOpen: boolean;
  carrierRate: CarrierRate | null;
  onClose: () => void;
  onSubmit: (data: UpdateCarrierRateRequest) => Promise<void>;
  onDelete: (id: number) => Promise<void>;
  isLoading: boolean;
  isDeletingCarrier: boolean;
  isDeleteConfirmOpen: boolean;
  onOpenDeleteConfirm: () => void;
  onCloseDeleteConfirm: () => void;
  deleteError?: string;
}

export function EditCarrierRateModal({
  isOpen,
  carrierRate,
  onClose,
  onSubmit,
  onDelete,
  isLoading,
  isDeletingCarrier,
  isDeleteConfirmOpen,
  onOpenDeleteConfirm,
  onCloseDeleteConfirm,
  deleteError,
}: EditCarrierRateModalProps) {
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isLoading && !isDeletingCarrier) {
        onClose();
      }
    };

    if (isOpen) {
      window.addEventListener('keydown', handleEsc);
      return () => window.removeEventListener('keydown', handleEsc);
    }
  }, [isOpen, isLoading, isDeletingCarrier, onClose]);

  if (!isOpen) {
    return null;
  }

  return (
    <>
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
              disabled={isLoading || isDeletingCarrier}
              className="text-gray-500 hover:text-gray-700 disabled:opacity-50"
            >
              ✕
            </button>
          </div>

          <div className="p-4">
            {deleteError && (
              <div className="rounded-md bg-red-50 p-3 text-sm text-red-700 mb-4">
                <p className="font-semibold">삭제 실패</p>
                <p>{deleteError}</p>
              </div>
            )}
            {carrierRate && (
              <EditCarrierRateForm
                carrierRate={carrierRate}
                isLoading={isLoading}
                isDeletingCarrier={isDeletingCarrier}
                onSubmit={onSubmit}
                onCancel={onClose}
                onOpenDeleteConfirm={onOpenDeleteConfirm}
              />
            )}
          </div>
        </div>
      </div>

      {carrierRate && (
        <PopupDialogModal
          isOpen={isDeleteConfirmOpen}
          title="택배비 삭제"
          message="정말로 삭제하시겠습니까?"
          cancelText="취소"
          confirmText={isDeletingCarrier ? '삭제 중...' : '삭제'}
          onCancel={onCloseDeleteConfirm}
          onConfirm={() => onDelete(carrierRate.id)}
          isDangerous
        />
      )}
    </>
  );
}

interface EditCarrierRateFormProps {
  carrierRate: CarrierRate;
  isLoading: boolean;
  isDeletingCarrier: boolean;
  onSubmit: (data: UpdateCarrierRateRequest) => Promise<void>;
  onCancel: () => void;
  onOpenDeleteConfirm: () => void;
}

function EditCarrierRateForm({
  carrierRate,
  isLoading,
  isDeletingCarrier,
  onSubmit,
  onCancel,
  onOpenDeleteConfirm,
}: EditCarrierRateFormProps) {
  return (
    <CarrierRateForm
      isLoading={isLoading}
      isDeletingCarrier={isDeletingCarrier}
      onSubmit={onSubmit}
      onCancel={onCancel}
      onOpenDeleteConfirm={onOpenDeleteConfirm}
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
