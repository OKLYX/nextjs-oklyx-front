'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { MarketplaceAccountRepositoryImpl } from '@/infrastructure/repositories/MarketplaceAccountRepositoryImpl';
import { MarketplaceAccountUseCase } from '@/application/usecases/MarketplaceAccountUseCase';
import type { MarketplaceAccount, TemplateOption } from '@/domain/entities/MarketplaceAccountEntity';
import type { UpdateMarketplaceAccountForm } from '@/application/dto/MarketplaceAccountDTOs';
import type { ElevenstNoticesRequest } from '@/domain/repositories/MarketplaceAccountRepository';
import type { OptionCheckSuffixConfig } from '@/domain/entities/OptionCheckSuffix';
import type {
  AccountFixedCost,
  AccountFixedCostRequestItem,
  PlatformFixedCost,
} from '@/domain/entities/FixedCost';
import { recalcFailureNote } from '@/domain/entities/ElevenstShipping';
import type { FixedCostUseCase } from '@/application/usecases/FixedCostUseCase';
import type { ShippingUseCase } from '@/application/usecases/ShippingUseCase';
import { CHANNEL_EDIT_FORM_ID, ChannelEditForm, type ChannelShippingChange } from './ChannelEditForm';
import type { ChannelTabKey } from './ChannelModalTabs';
import { loadChannelShipping, type ChannelShippingData } from './ChannelShippingSummary';
import { Button } from '@/presentation/components/ui/Button';
import { ConfirmDialog } from '@/presentation/components/ui/ConfirmDialog';
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
  /**
   * Fixed-cost catalog (FEATURE_2609_33). The caller (SellerChannelSection · CoverageMatrix) owns the useCase and
   * injects it.
   */
  fixedCostUseCase: FixedCostUseCase;
  fixedCosts: PlatformFixedCost[];
  fixedCostsLoading: boolean;
  fixedCostsError: string;
  onReloadFixedCosts: () => Promise<void>;
  /**
   * Shipping read / save for the 「배송」 tab (FEATURE_2610_16 / D19 · D22). Owned by the caller
   * (SellerChannelSection · CoverageMatrix).
   */
  shippingUseCase: ShippingUseCase;
  /**
   * Tab shown on open — 「기본 정보」 when omitted; the master detail [배송 설정하기] passes 'shipping'
   * (FEATURE_2610_16 / D29).
   */
  initialTab?: ChannelTabKey;
}

/**
 * Edit modal for a single sales channel (MarketplaceAccount).
 *
 * Pre-fills ChannelEditForm from the passed channel (the caller already holds it — the seller screen's channel
 * list, or the master detail [배송 설정하기] lookup, FEATURE_2610_16 / D29) and saves every tab
 * with one [저장] (FEATURE_2610_16 / D22): channel PATCH → platform defaults PUT → fixed-cost PUT → shipping
 * PUT (only when changed). The body mounts on open, so the fixed-cost links and the shipping settings are
 * loaded fresh every time. When an 11st or ESM shipping save could not re-price some listings, a one-button notice
 * (「배송 설정 저장」) comes first and closing it closes this modal (D22 · FEATURE_2610_13 / D124 · FEATURE_2610_26 /
 * D65).
 */
export function EditChannelModal(props: EditChannelModalProps) {
  if (!props.isOpen || !props.channel) {
    return null;
  }
  return <EditChannelModalContent {...props} channel={props.channel} />;
}

function EditChannelModalContent({
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
  shippingUseCase,
  initialTab,
}: EditChannelModalProps & { channel: MarketplaceAccount }) {
  const [isLoading, setIsLoading] = useState(false);
  const [fixedCostLinks, setFixedCostLinks] = useState<AccountFixedCost[]>([]);
  const [linksLoading, setLinksLoading] = useState(false);
  const [linksError, setLinksError] = useState('');
  const [shipping, setShipping] = useState<ChannelShippingData | null>(null);
  const [shippingLoading, setShippingLoading] = useState(true);
  const [shippingError, setShippingError] = useState('');
  const [recalcNotice, setRecalcNotice] = useState('');
  // FEATURE_2610_16 / D34: the form validity, reported by ChannelEditForm, gates the footer [저장].
  const [formValid, setFormValid] = useState(false);
  const channelId = channel.id;

  const loadLinks = useCallback(async () => {
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

  const loadShipping = useCallback(async () => {
    setShippingLoading(true);
    setShippingError('');
    try {
      setShipping(await loadChannelShipping(shippingUseCase, channel));
    } catch {
      setShipping(null);
      setShippingError('배송 설정을 불러오지 못했습니다.');
    } finally {
      setShippingLoading(false);
    }
  }, [channel, shippingUseCase]);

  // 인라인 async IIFE — 이펙트 본문에서 setState 를 동기 호출하지 않기 위한 프로젝트 관례.
  useEffect(() => {
    void (async () => {
      await Promise.all([loadLinks(), loadShipping()]);
    })();
  }, [loadLinks, loadShipping]);

  const retryFixedCosts = () => {
    void Promise.all([onReloadFixedCosts(), loadLinks()]);
  };

  const useCase = useMemo(() => {
    const repository = new MarketplaceAccountRepositoryImpl();
    return new MarketplaceAccountUseCase(repository);
  }, []);

  // FEATURE_2610_26 / D37: the ESM 「배송」 tab asks for the chosen place's bundle-fee policies (stable reference).
  const loadEsmBundles = useCallback(
    (placeNo: string) => shippingUseCase.listEsmBundlePolicies(channelId, placeNo),
    [shippingUseCase, channelId],
  );

  const closeAfterSave = async () => {
    onClose();
    await onSuccess();
  };

  const handleSubmit = async (
    data: UpdateMarketplaceAccountForm,
    suffixConfig: OptionCheckSuffixConfig,
    notices: ElevenstNoticesRequest,
    fixedCostItems: AccountFixedCostRequestItem[] | null,
    shippingChange: ChannelShippingChange | null,
  ) => {
    try {
      setIsLoading(true);
      await useCase.update(channel.id, {
        sellerId: channel.sellerId,
        platform: data.platform,
        accountAlias: data.accountAlias,
        // FEATURE_2610_13 / D5 · FEATURE_2610_26 / D4: a channel fills only its own platform's fields → the blank
        // ones are omitted.
        vendorId: data.vendorId || undefined,
        vendorUserId: data.vendorUserId || undefined,
        accessKey: data.accessKey || undefined,
        esmMasterId: data.esmMasterId || undefined,
        gmarketSellerId: data.gmarketSellerId || undefined,
        auctionSellerId: data.auctionSellerId || undefined,
        // Blank secretKey / apiKey / esmSecretKey is omitted → backend keeps the existing key.
        secretKey: data.secretKey ? data.secretKey : undefined,
        apiKey: data.apiKey ? data.apiKey : undefined,
        esmSecretKey: data.esmSecretKey ? data.esmSecretKey : undefined,
        // Blank template id = omitted → backend keeps existing (no clearing to
        // default); a value = replace.
        thumbnailTemplateId: data.thumbnailTemplateId ? Number(data.thumbnailTemplateId) : undefined,
        detailTemplateId: data.detailTemplateId ? Number(data.detailTemplateId) : undefined,
      });
      // The platform defaults join the same sequential save (FEATURE_2610_16 / D3 · D7): Coupang sends the
      // suffix, 11st sends the two notices and never the suffix, ESM sends nothing (FEATURE_2610_26 / D57). On
      // partial failure (an earlier step saved, this one failed) this throws → ChannelEditForm shows a banner and
      // the modal stays open; retry re-runs every step in the same order (each PUT is a replace).
      if (channel.platform === 'ELEVENST') {
        await useCase.updateElevenstNotices(channel.id, notices);
      } else if (channel.platform !== 'ESM') {
        await useCase.updateRegistrationNameSuffix(channel.id, {
          enabled: suffixConfig.optionCheckSuffixEnabled,
          suffix: suffixConfig.optionCheckSuffix,
        });
      }
      // 고정비 연결도 같은 순차 흐름에 합류한다(멱등 replace). null = 섹션이 준비되지 않아
      // 건드리지 않는다 — 못 읽은 목록으로 replace 를 보내면 기존 연결이 끊긴다.
      if (fixedCostItems !== null) {
        await fixedCostUseCase.setForAccount(channel.id, fixedCostItems);
      }
      // FEATURE_2610_16 / D22: shipping goes last and only when the 「배송」 tab changed. An 11st or ESM save
      // re-prices the listings (FEATURE_2610_26 / D65).
      let recalcFailedCount = 0;
      if (shippingChange?.kind === 'elevenst') {
        const saved = await shippingUseCase.upsertElevenstConfig(channel.id, shippingChange.settings);
        recalcFailedCount = saved.priceRecalcFailedCount ?? 0;
      } else if (shippingChange?.kind === 'esm') {
        const saved = await shippingUseCase.upsertEsmConfig(channel.id, shippingChange.settings);
        recalcFailedCount = saved.priceRecalcFailedCount ?? 0;
      } else if (shippingChange?.kind === 'coupang') {
        await shippingUseCase.upsertConfig(channel.id, shippingChange.config);
      }
      const note = recalcFailureNote(recalcFailedCount);
      if (note) {
        setRecalcNotice(note);
        return;
      }
      await closeAfterSave();
    } catch (err) {
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      {/* FEATURE_2610_16 / D32 · D34: fixed height, so a tab switch keeps the modal size and the body scrolls instead;
          [취소] [저장] sit in the footer, and [저장] submits the form through its id. */}
      <Modal
        isOpen
        onClose={onClose}
        title={`판매채널 수정 — ${sellerName}`}
        disableClose={isLoading}
        fullHeight
        footer={
          <>
            <Button variant="secondary" onClick={onClose} disabled={isLoading}>
              취소
            </Button>
            <Button
              type="submit"
              form={CHANNEL_EDIT_FORM_ID}
              disabled={!formValid}
              isLoading={isLoading}
              loadingText="저장 중..."
            >
              저장
            </Button>
          </>
        }
      >
        <ChannelEditForm
          channel={channel}
          isLoading={isLoading}
          onSubmit={handleSubmit}
          onValidityChange={setFormValid}
          thumbTemplates={thumbTemplates}
          detailTemplates={detailTemplates}
          templatesLoading={templatesLoading}
          fixedCosts={fixedCosts}
          fixedCostLinks={fixedCostLinks}
          fixedCostsLoading={fixedCostsLoading || linksLoading}
          fixedCostsError={fixedCostsError || linksError}
          onRetryFixedCosts={retryFixedCosts}
          shipping={shipping}
          shippingLoading={shippingLoading}
          shippingError={shippingError}
          onRetryShipping={() => void loadShipping()}
          loadEsmBundles={loadEsmBundles}
          initialTab={initialTab}
        />
      </Modal>

      <ConfirmDialog
        isOpen={!!recalcNotice}
        title="배송 설정 저장"
        message={recalcNotice}
        onConfirm={() => void closeAfterSave()}
        nested
      />
    </>
  );
}
