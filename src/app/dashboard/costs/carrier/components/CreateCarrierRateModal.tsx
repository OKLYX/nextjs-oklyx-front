'use client';

import { CarrierRateForm } from './CarrierRateForm';
import type { CreateCarrierRateRequest } from '@/application/dto/CreateCarrierRateRequest';
import type { Carrier } from '@/domain/entities/CarrierEntity';
import { Modal } from '@/presentation/components/ui/Modal';

interface CreateCarrierRateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: CreateCarrierRateRequest) => Promise<void>;
  isLoading: boolean;
  carriers: Carrier[];
}

export function CreateCarrierRateModal({
  isOpen,
  onClose,
  onSubmit,
  isLoading,
  carriers,
}: CreateCarrierRateModalProps) {
  if (!isOpen) {
    return null;
  }

  return (
    <Modal
      isOpen
      onClose={onClose}
      title="택배비 추가"
      disableClose={isLoading}
    >
      <CarrierRateForm
        isLoading={isLoading}
        carriers={carriers}
        onSubmit={onSubmit}
        onCancel={onClose}
      />
    </Modal>
  );
}
