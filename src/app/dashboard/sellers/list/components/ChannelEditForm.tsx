'use client';

import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { AlertCircle } from 'lucide-react';
import {
  updateMarketplaceAccountSchema,
  type UpdateMarketplaceAccountForm,
} from '@/application/dto/MarketplaceAccountDTOs';
import type { MarketplaceAccount, TemplateOption } from '@/domain/entities/MarketplaceAccountEntity';
import type { ElevenstNoticesRequest } from '@/domain/repositories/MarketplaceAccountRepository';
import type { OptionCheckSuffixConfig } from '@/domain/entities/OptionCheckSuffix';
import type {
  AccountFixedCost,
  AccountFixedCostRequestItem,
  PlatformFixedCost,
} from '@/domain/entities/FixedCost';
import type { ShippingConfigRequest } from '@/domain/entities/ShippingEntity';
import {
  cleanElevenstMap,
  tierError,
  type ElevenstShippingMap,
} from '@/domain/entities/ElevenstShipping';
import {
  NOTICE_TEXT_FIELDS,
  NOTICE_TEXT_TOO_LONG_MESSAGE,
  noticeTextTooLong,
} from '@/domain/entities/ElevenstNoticeText';
import { OptionCheckSuffixControl } from '@/presentation/components/OptionCheckSuffixControl';
import { ShippingOverrideFields } from '@/presentation/components/ShippingOverrideFields';
import { ElevenstShippingFields } from '@/presentation/components/ElevenstShippingFields';
import { Spinner } from '@/presentation/components/Spinner';
import {
  ChannelFixedCostFields,
  buildFixedCostRows,
  toFixedCostRequestItems,
  type ChannelFixedCostRow,
} from './ChannelFixedCostFields';
import { ChannelTabBar, type ChannelTabKey } from './ChannelModalTabs';
import type { ChannelShippingData } from './ChannelShippingSummary';
import { EMPTY_FORM } from '@/domain/entities/CoupangShipping';
import { PLATFORMS, platformName } from '@/config/platforms';

// Platform select options — values and names from src/config/platforms.ts (FEATURE_2610_22 / D15).
// Exported so the carrier platform codes screen shows the same options (D19).
export const PLATFORM_OPTIONS = PLATFORMS.map((p) => ({ value: p, label: platformName(p) }));

/** The modal footer [저장] sits outside this form and submits it through this id (FEATURE_2610_16 / D34). */
export const CHANNEL_EDIT_FORM_ID = 'channel-edit-form';

/** The shipping save the 「배송」 tab asks for (FEATURE_2610_16 / D22) — only when it differs from the loaded value. */
export type ChannelShippingChange =
  | { kind: 'coupang'; config: ShippingConfigRequest }
  | { kind: 'elevenst'; settings: ElevenstShippingMap };

/** True when both objects hold the same value under every key (a missing key counts as null). */
function sameValues(a: object, b: object): boolean {
  const left = a as Record<string, unknown>;
  const right = b as Record<string, unknown>;
  return Object.keys({ ...left, ...right }).every((key) => (left[key] ?? null) === (right[key] ?? null));
}

interface ChannelEditFormProps {
  channel: MarketplaceAccount;
  isLoading?: boolean;
  // Channel PATCH → platform defaults PUT (Coupang = suffix, 11st = notices) → fixed-cost PUT → shipping PUT
  // run sequentially in the parent (FEATURE_2610_16 / D22).
  // Any failure throws here → inline banner + retry, modal stays open (see EditChannelModal).
  // 🔴 fixedCostItems = null means the fixed-cost section is not ready (loading or load failure), so it is not
  // saved — a replace (PUT) built from a list that was never read would cut every existing link.
  // shipping = null means there is nothing to send: not loaded, failed to load, or unchanged.
  onSubmit: (
    data: UpdateMarketplaceAccountForm,
    suffixConfig: OptionCheckSuffixConfig,
    notices: ElevenstNoticesRequest,
    fixedCostItems: AccountFixedCostRequestItem[] | null,
    shipping: ChannelShippingChange | null,
  ) => Promise<void>;
  /** Reports the form validity; the modal footer [저장] stays disabled while it is false (FEATURE_2610_16 / D34). */
  onValidityChange: (valid: boolean) => void;
  thumbTemplates?: TemplateOption[];
  detailTemplates?: TemplateOption[];
  templatesLoading?: boolean;
  /**
   * Fixed-cost catalog + this channel's current links (the useCase belongs to the modal's caller — never created in
   * the form).
   */
  fixedCosts?: PlatformFixedCost[];
  fixedCostLinks?: AccountFixedCost[];
  fixedCostsLoading?: boolean;
  fixedCostsError?: string;
  onRetryFixedCosts?: () => void;
  /** The stored shipping default + address lists (EditChannelModal loads them on open). null = not loaded. */
  shipping?: ChannelShippingData | null;
  shippingLoading?: boolean;
  shippingError?: string;
  onRetryShipping?: () => void;
  /** Tab shown when the form mounts (FEATURE_2610_16 / D29: the master detail [배송 설정하기] opens 「배송」). */
  initialTab?: ChannelTabKey;
}

/**
 * Edit form of one sales channel, in three tabs (FEATURE_2610_16 / D20): 「기본 정보」 · 「플랫폼 기본값」 ·
 * 「배송」. The form mounts with the modal and opens on `initialTab` — 「기본 정보」 unless the caller passes another
 * tab (D29). One [저장] saves every tab (D22).
 */
export function ChannelEditForm({
  channel,
  isLoading = false,
  onSubmit: externalOnSubmit,
  onValidityChange,
  thumbTemplates = [],
  detailTemplates = [],
  templatesLoading = false,
  fixedCosts = [],
  fixedCostLinks = [],
  fixedCostsLoading = false,
  fixedCostsError = '',
  onRetryFixedCosts = () => {},
  shipping = null,
  shippingLoading = false,
  shippingError = '',
  onRetryShipping = () => {},
  initialTab = 'basic',
}: ChannelEditFormProps) {
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<ChannelTabKey>(initialTab);
  const [suffixConfig, setSuffixConfig] = useState<OptionCheckSuffixConfig>({
    optionCheckSuffixEnabled: channel.optionCheckSuffixEnabled ?? null,
    optionCheckSuffix: channel.optionCheckSuffix ?? null,
  });
  const [notices, setNotices] = useState<ElevenstNoticesRequest>({
    asNotice: channel.asNotice ?? '',
    returnExchangeNotice: channel.returnExchangeNotice ?? '',
  });
  // The shipping values arrive after mount — keep only what the user touched and read the rest from `shipping`.
  const [coupangShippingDraft, setCoupangShippingDraft] = useState<ShippingConfigRequest | null>(null);
  const [elevenstShippingDraft, setElevenstShippingDraft] = useState<ElevenstShippingMap | null>(null);
  const coupangShipping = coupangShippingDraft ?? shipping?.coupang ?? EMPTY_FORM;
  const elevenstShipping = elevenstShippingDraft ?? shipping?.elevenst ?? {};

  const fixedCostReady = !fixedCostsLoading && fixedCostsError === '';

  // 🔴 카탈로그·연결은 모달이 열린 뒤에 도착한다. 서버 값으로 state 를 만들어 두고 도착 시점에 덮으면
  // 이펙트 setState(프로젝트 lint 금지)이고, 그 사이 편집분도 날아간다 → **렌더 시점에 합성**한다:
  // 손댄 행만 `fixedCostEdits` 에 남고 나머지는 서버 값을 그대로 따라간다.
  const [fixedCostEdits, setFixedCostEdits] = useState<Record<number, ChannelFixedCostRow>>({});
  const baseFixedCostRows = useMemo(
    () => buildFixedCostRows(fixedCosts, fixedCostLinks, channel.platform),
    [fixedCosts, fixedCostLinks, channel.platform],
  );
  const fixedCostRows = useMemo(
    () => baseFixedCostRows.map((row) => fixedCostEdits[row.fixedCostId] ?? row),
    [baseFixedCostRows, fixedCostEdits],
  );

  const handleFixedCostRowsChange = (next: ChannelFixedCostRow[]) => {
    setFixedCostEdits((prev) => {
      const updated = { ...prev };
      next.forEach((row, index) => {
        if (row !== fixedCostRows[index]) updated[row.fixedCostId] = row;
      });
      return updated;
    });
  };

  const { register, handleSubmit, formState } = useForm<UpdateMarketplaceAccountForm>({
    resolver: zodResolver(updateMarketplaceAccountSchema),
    mode: 'onBlur',
    defaultValues: {
      platform: channel.platform,
      accountAlias: channel.accountAlias ?? '',
      vendorId: channel.vendorId ?? '',
      vendorUserId: channel.vendorUserId ?? '',
      accessKey: channel.accessKey ?? '',
      secretKey: '',
      apiKey: '',
      thumbnailTemplateId: channel.thumbnailTemplateId != null ? String(channel.thumbnailTemplateId) : '',
      detailTemplateId: channel.detailTemplateId != null ? String(channel.detailTemplateId) : '',
    },
  });

  // FEATURE_2610_16 / D34: [저장] lives in the modal footer, outside this form, so the validity is reported up.
  useEffect(() => {
    onValidityChange(formState.isValid);
  }, [formState.isValid, onValidityChange]);

  // The platform of a saved channel never changes (the backend refuses it) — the stored value picks the fields.
  const isElevenst = channel.platform === 'ELEVENST';

  // FEATURE_2610_16 / D22: shipping is sent only when the tab was loaded and now differs from the loaded value.
  const shippingChange = (): ChannelShippingChange | null => {
    if (shipping === null) return null;
    if (isElevenst) {
      if (elevenstShippingDraft === null) return null;
      const settings = cleanElevenstMap(elevenstShippingDraft);
      return sameValues(settings, cleanElevenstMap(shipping.elevenst)) ? null : { kind: 'elevenst', settings };
    }
    if (coupangShippingDraft === null || sameValues(coupangShippingDraft, shipping.coupang)) return null;
    return { kind: 'coupang', config: coupangShippingDraft };
  };

  const onSubmit = async (data: UpdateMarketplaceAccountForm) => {
    // FEATURE_2610_16 / D8: an over-long notice blocks the whole save before anything is sent.
    if (isElevenst && noticeTextTooLong({ ...notices })) {
      setError(NOTICE_TEXT_TOO_LONG_MESSAGE);
      setActiveTab('platform');
      return;
    }
    const change = shippingChange();
    // FEATURE_2610_16 / D22: a shipping check failure (11st quantity tiers) blocks the whole save and opens the 「배송」 tab.
    const tierMessage = change?.kind === 'elevenst' ? tierError(change.settings) : null;
    if (tierMessage) {
      setError(tierMessage);
      setActiveTab('shipping');
      return;
    }
    try {
      setError(null);
      await externalOnSubmit(
        data,
        suffixConfig,
        notices,
        fixedCostReady ? toFixedCostRequestItems(fixedCostRows) : null,
        change,
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : '판매채널 수정에 실패했습니다';
      setError(message);
    }
  };

  return (
    <form id={CHANNEL_EDIT_FORM_ID} onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {error && (
        <div className="rounded-md bg-red-50 p-3 text-sm text-red-700 flex items-start gap-2">
          <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
          <div>{error}</div>
        </div>
      )}

      <ChannelTabBar active={activeTab} onSelect={setActiveTab} />

      <div role="tabpanel" hidden={activeTab !== 'basic'} className="space-y-4">
        <div>
          <label htmlFor="platform" className="block text-sm font-medium mb-1">
            플랫폼 <span className="text-red-600">*</span>
          </label>
          <select
            {...register('platform')}
            id="platform"
            disabled={isLoading}
            className="w-full px-3 py-2 border rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="" disabled>
              플랫폼을 선택하세요
            </option>
            {PLATFORM_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          {formState.errors.platform && (
            <p className="mt-1 text-sm text-red-600">{formState.errors.platform.message}</p>
          )}
        </div>

        <div>
          <label htmlFor="accountAlias" className="block text-sm font-medium mb-1">
            계정 별칭
          </label>
          <input
            {...register('accountAlias')}
            id="accountAlias"
            type="text"
            placeholder="예: 쿠팡 본점"
            disabled={isLoading}
            className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {formState.errors.accountAlias && (
            <p className="mt-1 text-sm text-red-600">{formState.errors.accountAlias.message}</p>
          )}
        </div>

        {/* FEATURE_2610_13 / D5: the Coupang credential fields — an 11st account takes 「API 키」 alone. */}
        {!isElevenst && (
          <>
            <div>
              <label htmlFor="vendorId" className="block text-sm font-medium mb-1">
                판매자(벤더) ID <span className="text-red-600">*</span>
              </label>
              <input
                {...register('vendorId')}
                id="vendorId"
                type="text"
                placeholder="예: A00012345"
                disabled={isLoading}
                className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {formState.errors.vendorId && (
                <p className="mt-1 text-sm text-red-600">{formState.errors.vendorId.message}</p>
              )}
            </div>

            <div>
              <label htmlFor="vendorUserId" className="block text-sm font-medium mb-1">
                WING 로그인 ID
              </label>
              <input
                {...register('vendorUserId')}
                id="vendorUserId"
                type="text"
                placeholder="쿠팡 상품등록 시 사용 (선택)"
                disabled={isLoading}
                className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {formState.errors.vendorUserId && (
                <p className="mt-1 text-sm text-red-600">{formState.errors.vendorUserId.message}</p>
              )}
            </div>

            <div>
              <label htmlFor="accessKey" className="block text-sm font-medium mb-1">
                Access Key <span className="text-red-600">*</span>
              </label>
              <input
                {...register('accessKey')}
                id="accessKey"
                type="text"
                placeholder="Access Key를 입력하세요"
                disabled={isLoading}
                className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {formState.errors.accessKey && (
                <p className="mt-1 text-sm text-red-600">{formState.errors.accessKey.message}</p>
              )}
            </div>

            <div>
              <label htmlFor="secretKey" className="block text-sm font-medium mb-1">
                Secret Key
              </label>
              <input
                {...register('secretKey')}
                id="secretKey"
                type="password"
                placeholder="변경 시에만 입력하세요 (비워두면 기존 값 유지)"
                disabled={isLoading}
                className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {formState.errors.secretKey && (
                <p className="mt-1 text-sm text-red-600">{formState.errors.secretKey.message}</p>
              )}
            </div>
          </>
        )}

        {isElevenst && (
          <div>
            <label htmlFor="apiKey" className="block text-sm font-medium mb-1">
              API 키
            </label>
            <input
              {...register('apiKey')}
              id="apiKey"
              type="password"
              placeholder="변경 시에만 입력하세요 (비워두면 기존 값 유지)"
              disabled={isLoading}
              className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {formState.errors.apiKey && (
              <p className="mt-1 text-sm text-red-600">{formState.errors.apiKey.message}</p>
            )}
          </div>
        )}

        <div>
          <label htmlFor="thumbnailTemplateId" className="block text-sm font-medium mb-1">
            썸네일 템플릿
          </label>
          <select
            {...register('thumbnailTemplateId')}
            id="thumbnailTemplateId"
            disabled={isLoading || templatesLoading}
            className="w-full px-3 py-2 border rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
          >
            <option value="">기본값 사용 (테넌트 기본 템플릿)</option>
            {thumbTemplates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}{t.isDefault ? ' (기본)' : ''}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="detailTemplateId" className="block text-sm font-medium mb-1">
            상세 템플릿
          </label>
          <select
            {...register('detailTemplateId')}
            id="detailTemplateId"
            disabled={isLoading || templatesLoading}
            className="w-full px-3 py-2 border rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
          >
            <option value="">기본값 사용 (테넌트 기본 템플릿)</option>
            {detailTemplates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}{t.isDefault ? ' (기본)' : ''}
              </option>
            ))}
          </select>
        </div>

        <p className="text-xs text-gray-500">
          비워두면 기존 지정을 유지합니다(기본값으로 되돌리기는 지원하지 않음).
        </p>

        <ChannelFixedCostFields
          rows={fixedCostRows}
          platform={channel.platform}
          onChange={handleFixedCostRowsChange}
          isLoading={fixedCostsLoading}
          loadError={fixedCostsError}
          onRetry={onRetryFixedCosts}
          disabled={isLoading}
        />
      </div>

      <div role="tabpanel" hidden={activeTab !== 'platform'} className="space-y-4">
        {/* FEATURE_2610_16 / D3 · D4: only this channel's platform fields — Coupang = the suffix, 11st = the two notices. */}
        {isElevenst ? (
          NOTICE_TEXT_FIELDS.map((f) => (
            <div key={f.key}>
              <label htmlFor={f.key} className="block text-sm font-medium mb-1">
                {f.label}
              </label>
              <textarea
                id={f.key}
                rows={4}
                value={notices[f.key as keyof ElevenstNoticesRequest]}
                onChange={(e) => {
                  const next = e.target.value;
                  setNotices((prev) => ({ ...prev, [f.key]: next }));
                }}
                disabled={isLoading}
                className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          ))
        ) : (
          <div className="space-y-2">
            <div>
              <label className="block text-sm font-medium">
                등록상품명 추가 문구{' '}
                <span className="inline-flex rounded-full px-2 py-0.5 text-xs font-medium bg-red-100 text-red-700">
                  쿠팡
                </span>
              </label>
              <p className="text-xs text-gray-500">멀티 옵션 상품의 등록상품명에 추가될 문구를 채널단위로 설정합니다.</p>
            </div>
            <OptionCheckSuffixControl
              value={suffixConfig}
              onChange={setSuffixConfig}
              inheritedHint="입력하지 않을 시 판매자의 등록상품명 추가 문구를 사용합니다."
              disabled={isLoading}
            />
          </div>
        )}
      </div>

      <div role="tabpanel" hidden={activeTab !== 'shipping'}>
        {shippingLoading ? (
          <div className="flex min-h-40 items-center justify-center">
            <Spinner size={24} label="불러오는 중..." />
          </div>
        ) : shippingError || shipping === null ? (
          <div className="rounded-md bg-red-50 p-3 text-sm text-red-700 flex items-center justify-between gap-2">
            <span>{shippingError}</span>
            <button
              type="button"
              onClick={onRetryShipping}
              className="px-3 py-1 text-xs border border-red-300 rounded hover:bg-red-100 whitespace-nowrap"
            >
              다시 시도
            </button>
          </div>
        ) : isElevenst ? (
          <ElevenstShippingFields
            level="account"
            value={elevenstShipping}
            onChange={setElevenstShippingDraft}
            outbound={shipping.outbound}
            returns={shipping.returns}
            disabled={isLoading}
          />
        ) : (
          <ShippingOverrideFields
            level="account"
            value={coupangShipping}
            onChange={setCoupangShippingDraft}
            platform={channel.platform}
            outbound={shipping.outbound}
            returns={shipping.returns}
            disabled={isLoading}
          />
        )}
      </div>
    </form>
  );
}
