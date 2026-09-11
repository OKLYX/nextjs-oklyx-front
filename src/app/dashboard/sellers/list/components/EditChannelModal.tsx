'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { MarketplaceAccountRepositoryImpl } from '@/infrastructure/repositories/MarketplaceAccountRepositoryImpl';
import { MarketplaceAccountUseCase } from '@/application/usecases/MarketplaceAccountUseCase';
import type { MarketplaceAccount, TemplateOption } from '@/domain/entities/MarketplaceAccountEntity';
import type { UpdateMarketplaceAccountForm } from '@/application/dto/MarketplaceAccountDTOs';
import type { OptionCheckSuffixConfig } from '@/domain/entities/OptionCheckSuffix';
import type {
  AccountFixedCost,
  AccountFixedCostRequestItem,
  PlatformFixedCost,
} from '@/domain/entities/FixedCost';
import type { FixedCostUseCase } from '@/application/usecases/FixedCostUseCase';
import { ChannelEditForm } from './ChannelEditForm';
import { Modal } from '@/presentation/components/ui/Modal';

interface EditChannelModalProps {
  isOpen: boolean;
  channel: MarketplaceAccount | null;
  sellerName: string;
  onClose: () => void;
  onSuccess: () => Promise<void>;
  thumbTemplates: TemplateOption[];
  detailTemplates: TemplateOption[];
  templatesLoading: boolean;
  /** 고정비 카탈로그 (FEATURE_2609_33). useCase 는 SellerChannelSection 이 소유해 주입한다. */
  fixedCostUseCase: FixedCostUseCase;
  fixedCosts: PlatformFixedCost[];
  fixedCostsLoading: boolean;
  fixedCostsError: string;
  onReloadFixedCosts: () => Promise<void>;
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
  fixedCostUseCase,
  fixedCosts,
  fixedCostsLoading,
  fixedCostsError,
  onReloadFixedCosts,
}: EditChannelModalProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [fixedCostLinks, setFixedCostLinks] = useState<AccountFixedCost[]>([]);
  const [linksLoading, setLinksLoading] = useState(false);
  const [linksError, setLinksError] = useState('');
  const channelId = channel?.id ?? null;

  const loadLinks = useCallback(async () => {
    if (channelId == null) return;
    setLinksLoading(true);
    setLinksError('');
    try {
      setFixedCostLinks(await fixedCostUseCase.listForAccount(channelId));
    } catch {
      setLinksError('고정비 목록을 불러오지 못했습니다.');
      setFixedCostLinks([]);
    } finally {
      setLinksLoading(false);
    }
  }, [channelId, fixedCostUseCase]);

  // 인라인 async IIFE — 이펙트 본문에서 setState 를 동기 호출하지 않기 위한 프로젝트 관례.
  useEffect(() => {
    if (!isOpen || channelId == null) return;
    void (async () => {
      await loadLinks();
    })();
  }, [isOpen, channelId, loadLinks]);

  const retryFixedCosts = () => {
    void Promise.all([onReloadFixedCosts(), loadLinks()]);
  };

  const useCase = useMemo(() => {
    const repository = new MarketplaceAccountRepositoryImpl();
    return new MarketplaceAccountUseCase(repository);
  }, []);

  if (!isOpen || !channel) {
    return null;
  }

  const handleSubmit = async (
    data: UpdateMarketplaceAccountForm,
    suffixConfig: OptionCheckSuffixConfig,
    fixedCostItems: AccountFixedCostRequestItem[] | null,
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
      // 고정비 연결도 같은 순차 흐름에 합류한다(멱등 replace). null = 섹션이 준비되지 않아
      // 건드리지 않는다 — 못 읽은 목록으로 replace 를 보내면 기존 연결이 끊긴다.
      if (fixedCostItems !== null) {
        await fixedCostUseCase.setForAccount(channel.id, fixedCostItems);
      }
      onClose();
      await onSuccess();
    } catch (err) {
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={`판매채널 수정 — ${sellerName}`}
      disableClose={isLoading}
    >
      <ChannelEditForm
        channel={channel}
        isLoading={isLoading}
        onSubmit={handleSubmit}
        onCancel={onClose}
        thumbTemplates={thumbTemplates}
        detailTemplates={detailTemplates}
        templatesLoading={templatesLoading}
        fixedCosts={fixedCosts}
        fixedCostLinks={fixedCostLinks}
        fixedCostsLoading={fixedCostsLoading || linksLoading}
        fixedCostsError={fixedCostsError || linksError}
        onRetryFixedCosts={retryFixedCosts}
      />
    </Modal>
  );
}
