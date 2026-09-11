'use client';

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
