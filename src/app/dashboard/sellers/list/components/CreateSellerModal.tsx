'use client';

import { useEffect } from 'react';
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
