'use client';

import { ChannelRegistrationForm } from './ChannelRegistrationForm';
import type { CreateMarketplaceAccountForm } from '@/application/dto/MarketplaceAccountDTOs';
import type { TemplateOption } from '@/domain/entities/MarketplaceAccountEntity';
import { Modal } from '@/presentation/components/ui/Modal';

interface CreateChannelModalProps {
  isOpen: boolean;
  sellerName: string;
  onClose: () => void;
  onSubmit: (data: CreateMarketplaceAccountForm) => Promise<void>;
  isLoading: boolean;
  thumbTemplates: TemplateOption[];
  detailTemplates: TemplateOption[];
  templatesLoading: boolean;
}

export function CreateChannelModal({
  isOpen,
  sellerName,
  onClose,
  onSubmit,
  isLoading,
  thumbTemplates,
  detailTemplates,
  templatesLoading,
}: CreateChannelModalProps) {
  if (!isOpen) {
    return null;
  }

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={`판매채널 추가 — ${sellerName}`}
      disableClose={isLoading}
    >
      <ChannelRegistrationForm
        isLoading={isLoading}
        onSubmit={onSubmit}
        onCancel={onClose}
        thumbTemplates={thumbTemplates}
        detailTemplates={detailTemplates}
        templatesLoading={templatesLoading}
      />
    </Modal>
  );
}
