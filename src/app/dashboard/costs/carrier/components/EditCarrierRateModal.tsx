'use client';

import { useEffect } from 'react';
import { CarrierRateForm } from './CarrierRateForm';
import { ConfirmDialog } from '@/presentation/components/ui/ConfirmDialog';
import type { CarrierRate } from '@/domain/entities/CarrierRateEntity';
import type { UpdateCarrierRateRequest } from '@/application/dto/UpdateCarrierRateRequest';
import type { Carrier } from '@/domain/entities/CarrierEntity';
import { Modal } from '@/presentation/components/ui/Modal';

interface EditCarrierRateModalProps {
  isOpen: boolean;
  carrierRate: CarrierRate | null;
  carriers: Carrier[];
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
  carriers,
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
      <Modal
        isOpen
        onClose={onClose}
        title="택배비 수정"
        disableClose={isLoading || isDeletingCarrier}
      >
        {carrierRate && <p className="mb-4 text-xs text-gray-500">ID: {carrierRate.id}</p>}
        <div>
            {deleteError && (
              <div className="rounded-md bg-red-50 p-3 text-sm text-red-700 mb-4">
                <p className="font-semibold">삭제 실패</p>
                <p>{deleteError}</p>
              </div>
            )}
            {carrierRate && (
              <EditCarrierRateForm
                carrierRate={carrierRate}
                carriers={carriers}
                isLoading={isLoading}
                isDeletingCarrier={isDeletingCarrier}
                onSubmit={onSubmit}
                onCancel={onClose}
                onOpenDeleteConfirm={onOpenDeleteConfirm}
              />
            )}
        </div>
      </Modal>

      {carrierRate && (
        <ConfirmDialog
          isOpen={isDeleteConfirmOpen}
          title="택배비 삭제"
          message="정말로 삭제하시겠습니까?"
          cancelText="취소"
          confirmText={isDeletingCarrier ? '삭제 중...' : '삭제'}
          onCancel={onCloseDeleteConfirm}
          onConfirm={() => onDelete(carrierRate.id)}
          isDangerous
          nested
        />
      )}
    </>
  );
}

interface EditCarrierRateFormProps {
  carrierRate: CarrierRate;
  carriers: Carrier[];
  isLoading: boolean;
  isDeletingCarrier: boolean;
  onSubmit: (data: UpdateCarrierRateRequest) => Promise<void>;
  onCancel: () => void;
  onOpenDeleteConfirm: () => void;
}

function EditCarrierRateForm({
  carrierRate,
  carriers,
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
      carriers={carriers}
      onSubmit={onSubmit}
      onCancel={onCancel}
      onOpenDeleteConfirm={onOpenDeleteConfirm}
      initialData={{
        carrierId: String(carrierRate.carrierId),
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
