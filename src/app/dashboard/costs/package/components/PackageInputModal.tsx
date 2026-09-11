'use client';

import { PackageInputForm } from './PackageInputForm';
import type { CreatePackageRequest } from '@/application/dto/CreatePackageRequest';
import { Modal } from '@/presentation/components/ui/Modal';

interface PackageInputModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: CreatePackageRequest) => Promise<void>;
  isLoading: boolean;
}

export function PackageInputModal({
  isOpen,
  onClose,
  onSubmit,
  isLoading,
}: PackageInputModalProps) {
  if (!isOpen) {
    return null;
  }

  return (
    <Modal
      isOpen
      onClose={onClose}
      title="상자비 추가"
      disableClose={isLoading}
    >
      <PackageInputForm
        onSubmit={onSubmit}
        onCancel={onClose}
        isLoading={isLoading}
      />
    </Modal>
  );
}
