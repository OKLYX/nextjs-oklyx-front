'use client';

import { useEffect } from 'react';
import { CommissionRateForm } from './CommissionRateForm';
import type {
  CreateCommissionRateFormData,
  UpdateCommissionRateFormData,
} from '@/application/schemas/CommissionRateSchema';
import { Modal } from '@/presentation/components/ui/Modal';

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
    <Modal
      isOpen
      onClose={onClose}
      title="수수료 추가"
      disableClose={isSubmitting}
    >
      <CommissionRateForm
        onSubmit={onSubmit}
        onCancel={onClose}
        isLoading={isSubmitting}
      />
    </Modal>
  );
}
