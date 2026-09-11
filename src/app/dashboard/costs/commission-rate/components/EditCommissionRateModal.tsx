'use client';

import { useEffect } from 'react';
import { CommissionRateForm } from './CommissionRateForm';
import type { CommissionRate } from '@/domain/entities/CommissionRateEntity';
import type { UpdateCommissionRateFormData } from '@/application/schemas/CommissionRateSchema';
import { Modal } from '@/presentation/components/ui/Modal';

interface EditCommissionRateModalProps {
  isOpen: boolean;
  commissionRate: CommissionRate | null;
  onClose: () => void;
  onSubmit: (data: UpdateCommissionRateFormData) => Promise<void>;
  onOpenDeleteConfirm: () => void;
  isLoading: boolean;
  isDeletingRate: boolean;
}

export function EditCommissionRateModal({
  isOpen,
  commissionRate,
  onClose,
  onSubmit,
  onOpenDeleteConfirm,
  isLoading,
  isDeletingRate,
}: EditCommissionRateModalProps) {
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
    <Modal
      isOpen
      onClose={onClose}
      title="수수료 수정"
      disableClose={isLoading}
    >
      {commissionRate && (
        <CommissionRateForm
          initialData={commissionRate}
          isLoading={isLoading}
          isDeletingRate={isDeletingRate}
          onSubmit={onSubmit}
          onCancel={onClose}
          onOpenDeleteConfirm={onOpenDeleteConfirm}
          submitButtonLabel="수정"
          submitLoadingLabel="수정 중..."
        />
      )}
    </Modal>
  );
}
