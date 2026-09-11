'use client';

import { SellerRegistrationForm } from '../../create/components/SellerRegistrationForm';
import type { CreateSellerRequest } from '@/application/dto/SellerDTOs';
import { Modal } from '@/presentation/components/ui/Modal';

interface CreateSellerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: CreateSellerRequest) => Promise<void>;
  isLoading: boolean;
}

export function CreateSellerModal({
  isOpen,
  onClose,
  onSubmit,
  isLoading,
}: CreateSellerModalProps) {
  if (!isOpen) {
    return null;
  }

  return (
    <Modal
      isOpen
      onClose={onClose}
      title="판매자 등록"
      disableClose={isLoading}
    >
      <SellerRegistrationForm
        isLoading={isLoading}
        onSubmit={onSubmit}
        onCancel={onClose}
      />
    </Modal>
  );
}
