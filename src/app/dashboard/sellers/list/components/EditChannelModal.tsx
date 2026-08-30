'use client';

import { useEffect, useMemo, useState } from 'react';
import { MarketplaceAccountRepositoryImpl } from '@/infrastructure/repositories/MarketplaceAccountRepositoryImpl';
import { MarketplaceAccountUseCase } from '@/application/usecases/MarketplaceAccountUseCase';
import type { MarketplaceAccount, TemplateOption } from '@/domain/entities/MarketplaceAccountEntity';
import type { UpdateMarketplaceAccountForm } from '@/application/dto/MarketplaceAccountDTOs';
import type { OptionCheckSuffixConfig } from '@/domain/entities/OptionCheckSuffix';
import { ChannelEditForm } from './ChannelEditForm';

interface EditChannelModalProps {
  isOpen: boolean;
  channel: MarketplaceAccount | null;
  sellerName: string;
  onClose: () => void;
  onSuccess: () => Promise<void>;
  thumbTemplates: TemplateOption[];
  detailTemplates: TemplateOption[];
  templatesLoading: boolean;
}

/**
 * Edit modal for a single sales channel (MarketplaceAccount).
 *
 * Mirrors EditSellerModal's flow: reuses the same modal chrome as
 * CreateChannelModal, pre-fills ChannelEditForm from the passed channel, and
 * submits a PATCH. The channel object is provided directly (the list section
 * already holds it), so no extra fetch is needed.
 */
export function EditChannelModal({
  isOpen,
  channel,
  sellerName,
  onClose,
  onSuccess,
  thumbTemplates,
  detailTemplates,
  templatesLoading,
}: EditChannelModalProps) {
  const [isLoading, setIsLoading] = useState(false);

  const useCase = useMemo(() => {
    const repository = new MarketplaceAccountRepositoryImpl();
    return new MarketplaceAccountUseCase(repository);
  }, []);

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

  if (!isOpen || !channel) {
    return null;
  }

  const handleSubmit = async (
    data: UpdateMarketplaceAccountForm,
    suffixConfig: OptionCheckSuffixConfig,
  ) => {
    try {
      setIsLoading(true);
      await useCase.update(channel.id, {
        sellerId: channel.sellerId,
        platform: data.platform,
        accountAlias: data.accountAlias,
        vendorId: data.vendorId,
        vendorUserId: data.vendorUserId || undefined,
        accessKey: data.accessKey,
        // Blank secretKey is omitted → backend keeps the existing key.
        secretKey: data.secretKey ? data.secretKey : undefined,
        // Blank template id = omitted → backend keeps existing (no clearing to
        // default); a value = replace.
        thumbnailTemplateId: data.thumbnailTemplateId ? Number(data.thumbnailTemplateId) : undefined,
        detailTemplateId: data.detailTemplateId ? Number(data.detailTemplateId) : undefined,
      });
      // Channel save joins the suffix PUT. On partial failure (channel saved,
      // suffix PUT failed) this throws → ChannelEditForm shows a banner and the
      // modal stays open; retry re-runs both (channel PATCH is idempotent).
      await useCase.updateRegistrationNameSuffix(channel.id, {
        enabled: suffixConfig.optionCheckSuffixEnabled,
        suffix: suffixConfig.optionCheckSuffix,
      });
      onClose();
      await onSuccess();
    } catch (err) {
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-lg shadow-lg max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold">판매채널 수정 — {sellerName}</h2>
          <button
            onClick={onClose}
            disabled={isLoading}
            className="text-gray-500 hover:text-gray-700 disabled:opacity-50"
          >
            ✕
          </button>
        </div>

        <div className="p-4">
          <ChannelEditForm
            channel={channel}
            isLoading={isLoading}
            onSubmit={handleSubmit}
            onCancel={onClose}
            thumbTemplates={thumbTemplates}
            detailTemplates={detailTemplates}
            templatesLoading={templatesLoading}
          />
        </div>
      </div>
    </div>
  );
}
