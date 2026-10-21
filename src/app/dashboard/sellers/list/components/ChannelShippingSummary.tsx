'use client';

import type { MarketplaceAccount } from '@/domain/entities/MarketplaceAccountEntity';
import type { OutboundPlace, ReturnCenter, ShippingConfigRequest } from '@/domain/entities/ShippingEntity';
import {
  ELEVENST_AREA_OPTIONS,
  ELEVENST_BUNDLE_OPTIONS,
  ELEVENST_COD_NOTICE_OPTIONS,
  ELEVENST_FEE_TYPE_OPTIONS,
  ELEVENST_KEYS,
  ELEVENST_METHOD_OPTIONS,
  ELEVENST_PAY_TYPE_OPTIONS,
  ELEVENST_RETURN_FEE_METHOD_OPTIONS,
  tiersOf,
  type CodeOption,
  type ElevenstShippingMap,
} from '@/domain/entities/ElevenstShipping';
import { ESM_KEYS, ESM_LABELS, type EsmChoice, type EsmShippingMap } from '@/domain/entities/EsmShipping';
import type { ShippingUseCase } from '@/application/usecases/ShippingUseCase';
import {
  DELIVERY_CHARGE_TYPES,
  DELIVERY_METHODS,
  EXTRA_INFO_METHODS,
  EXTRA_INFO_PRESETS,
} from '@/presentation/components/ShippingOverrideFields';
import { useCarrierOptions } from '@/presentation/hooks/useCarrierOptions';
import { EMPTY_FORM, toForm } from '@/domain/entities/CoupangShipping';

/** What the sales channel info and edit modals load for the 「배송」 tab (FEATURE_2610_16 / D22 · D28). */
export interface ChannelShippingData {
  /** Coupang channel default as the edit form shape (`EMPTY_FORM` on an 11st or ESM channel). */
  coupang: ShippingConfigRequest;
  /** 11st channel default settings (`{}` on any other channel). */
  elevenst: ElevenstShippingMap;
  /** FEATURE_2610_26 / D36: ESM channel layer settings (`{}` on any other channel). */
  esm: EsmShippingMap;
  /** FEATURE_2610_26 / D37 · D68: ESM dispatch policies · couriers · the stored place's bundle-fee policies. */
  esmDispatches: EsmChoice[];
  esmCompanies: EsmChoice[];
  esmBundles: EsmChoice[];
  outbound: OutboundPlace[];
  returns: ReturnCenter[];
}

/**
 * Loads the channel's stored shipping default (the one of its platform) and its outbound / return lists in
 * parallel — on an ESM channel also its dispatch policies, couriers and the stored place's bundle-fee policies.
 * Throws when the stored default cannot be read (FEATURE_2610_16 / D22 · D28); a failed list degrades to an empty
 * list.
 */
export async function loadChannelShipping(
  useCase: ShippingUseCase,
  account: MarketplaceAccount,
): Promise<ChannelShippingData> {
  const isElevenst = account.platform === 'ELEVENST';
  const isEsm = account.platform === 'ESM';
  const [coupang, elevenst, esm, esmDispatches, esmCompanies, outbound, returns] = await Promise.all([
    isElevenst || isEsm ? Promise.resolve(EMPTY_FORM) : useCase.getConfig(account.id).then(toForm),
    isElevenst
      ? useCase.getElevenstConfig(account.id).then((config) => config.settings ?? {})
      : Promise.resolve<ElevenstShippingMap>({}),
    isEsm
      ? useCase.getEsmConfig(account.id).then((config) => config.settings ?? {})
      : Promise.resolve<EsmShippingMap>({}),
    isEsm ? useCase.listEsmDispatchPolicies(account.id).catch(() => [] as EsmChoice[]) : Promise.resolve([]),
    isEsm ? useCase.listEsmDeliveryCompanies(account.id).catch(() => [] as EsmChoice[]) : Promise.resolve([]),
    useCase.listOutbound(account.id).catch(() => [] as OutboundPlace[]),
    useCase.listReturn(account.id).catch(() => [] as ReturnCenter[]),
  ]);
  const placeNo = esm[ESM_KEYS.placeNo];
  const esmBundles =
    isEsm && placeNo
      ? await useCase.listEsmBundlePolicies(account.id, placeNo).catch(() => [] as EsmChoice[])
      : [];
  return { coupang, elevenst, esm, esmDispatches, esmCompanies, esmBundles, outbound, returns };
}

interface SummaryRow {
  label: string;
  lines: string[];
}

const EMPTY = '-';
const TOGGLE_YN: CodeOption[] = [
  { value: 'Y', label: '가능' },
  { value: 'N', label: '불가' },
];
const TOGGLE_UNION: CodeOption[] = [
  { value: 'UNION_DELIVERY', label: '가능' },
  { value: 'NOT_UNION_DELIVERY', label: '불가' },
];

const text = (value: string | null | undefined): string =>
  value == null || value.trim() === '' ? EMPTY : value;
const won = (value: string | number | null | undefined): string =>
  value == null || String(value).trim() === '' ? EMPTY : `${Number(value).toLocaleString('ko-KR')}원`;
const optionLabel = (options: CodeOption[], value: string | null | undefined): string =>
  value == null || value === '' ? EMPTY : (options.find((o) => o.value === value)?.label ?? value);
const placeName = (places: { code: string; name: string }[], code: string | null | undefined): string =>
  code == null || code === '' ? EMPTY : places.find((p) => p.code === code)?.name || code;

interface ChannelShippingSummaryProps {
  platform: string;
  data: ChannelShippingData;
}

/**
 * Read-only 「배송」 tab of the sales channel info modal (FEATURE_2610_16 / D21 · D27): the fields the edit tab
 * shows (`ShippingOverrideFields` / `ElevenstShippingFields` / `EsmShippingFields`, level="account"), in the same
 * order with the same labels, as 「label / value」 rows. A choice shows its option label, an amount `1,000원`, a blank
 * value `-`.
 */
export function ChannelShippingSummary({ platform, data }: ChannelShippingSummaryProps) {
  const { carriers, loading: carriersLoading } = useCarrierOptions(platform);
  const carrierLabel = (code: string | null | undefined): string => {
    if (code == null || code === '') return EMPTY;
    if (carriersLoading) return '불러오는 중...';
    const found = carriers.find((c) => c.deliveryCompanyCode === code);
    return found ? `${found.carrierName} (${found.deliveryCompanyCode})` : code;
  };

  const rows: SummaryRow[] = [];
  const add = (label: string, value: string) => rows.push({ label, lines: [value] });

  if (platform === 'ESM') {
    // FEATURE_2610_26 / D36: the six ESM values in the edit tab's order; a picked value shows its list name.
    const map = data.esm;
    add(ESM_LABELS[ESM_KEYS.placeNo], placeName(data.outbound, map[ESM_KEYS.placeNo]));
    add(ESM_LABELS[ESM_KEYS.bundlePolicyNo], placeName(data.esmBundles, map[ESM_KEYS.bundlePolicyNo]));
    add(ESM_LABELS[ESM_KEYS.dispatchPolicyNo], placeName(data.esmDispatches, map[ESM_KEYS.dispatchPolicyNo]));
    add(ESM_LABELS[ESM_KEYS.returnAddrNo], placeName(data.returns, map[ESM_KEYS.returnAddrNo]));
    add(ESM_LABELS[ESM_KEYS.companyNo], placeName(data.esmCompanies, map[ESM_KEYS.companyNo]));
    add(ESM_LABELS[ESM_KEYS.returnFee], won(map[ESM_KEYS.returnFee]));
  } else if (platform === 'ELEVENST') {
    const map = data.elevenst;
    const get = (key: string) => map[key];
    const method = get(ELEVENST_KEYS.method) ?? '';
    const feeType = get(ELEVENST_KEYS.feeType) ?? '';
    const payType = get(ELEVENST_KEYS.payType) ?? '';
    add('출고지', placeName(data.outbound, get(ELEVENST_KEYS.outboundSeq)));
    add('반품/교환지', placeName(data.returns, get(ELEVENST_KEYS.returnSeq)));
    add('배송 가능 지역', optionLabel(ELEVENST_AREA_OPTIONS, get(ELEVENST_KEYS.areaCode)));
    add('배송 방법', optionLabel(ELEVENST_METHOD_OPTIONS, method));
    if (method === '01') add('택배사', carrierLabel(get(ELEVENST_KEYS.courier)));
    add('묶음배송', optionLabel(ELEVENST_BUNDLE_OPTIONS, get(ELEVENST_KEYS.bundle)));
    add('배송비 종류', optionLabel(ELEVENST_FEE_TYPE_OPTIONS, feeType));
    add('결제 방법', optionLabel(ELEVENST_PAY_TYPE_OPTIONS, payType));
    if (feeType === '02' || feeType === '03') add('배송비', won(get(ELEVENST_KEYS.fee)));
    if (feeType === '03') add('무료배송 기준 금액', won(get(ELEVENST_KEYS.freeOver)));
    if (feeType === '05') add('1개당 배송비', won(get(ELEVENST_KEYS.perItemFee)));
    if (feeType === '02' && payType === '02') {
      add('착불 안내', optionLabel(ELEVENST_COD_NOTICE_OPTIONS, get(ELEVENST_KEYS.codNotice)));
    }
    if (feeType === '04') {
      const tiers = tiersOf(map);
      rows.push({
        label: '수량별 배송비 (최대 10구간)',
        lines:
          tiers.length === 0
            ? [EMPTY]
            : tiers.map((tier, index) =>
                index < tiers.length - 1
                  ? `${tier.start}개 이상 ${tier.end}개 이하 ${won(tier.fee)}`
                  : `${tier.start}개 이상 상한 없음 ${won(tier.fee)}`,
              ),
      });
    }
    add('제주 추가 배송비', won(get(ELEVENST_KEYS.jejuFee)));
    add('도서산간 추가 배송비', won(get(ELEVENST_KEYS.islandFee)));
    add('반품 배송비(편도)', won(get(ELEVENST_KEYS.returnFee)));
    add('교환 배송비(왕복)', won(get(ELEVENST_KEYS.exchangeFee)));
    add('반품비 부과 방법', optionLabel(ELEVENST_RETURN_FEE_METHOD_OPTIONS, get(ELEVENST_KEYS.returnFeeMethod)));
  } else {
    const c = data.coupang;
    const presetIndex = EXTRA_INFO_PRESETS.indexOf(c.extraInfoMessage ?? '');
    add('출고지', placeName(data.outbound, c.outboundShippingPlaceCode));
    add('도서산간 배송', optionLabel(TOGGLE_YN, c.remoteAreaDeliverable));
    add('택배사', carrierLabel(c.deliveryCompanyCode));
    add('배송비 유형', optionLabel(DELIVERY_CHARGE_TYPES, c.deliveryChargeType));
    add('묶음배송', optionLabel(TOGGLE_UNION, c.unionDeliveryType));
    if (c.deliveryChargeType === 'NOT_FREE' || c.deliveryChargeType === 'CONDITIONAL_FREE') {
      add('기본배송비', won(c.deliveryCharge));
    }
    if (c.deliveryChargeType === 'CONDITIONAL_FREE') add('무료배송 기준금액', won(c.freeShipOverAmount));
    add('배송방법', optionLabel(DELIVERY_METHODS, c.deliveryMethod));
    if (EXTRA_INFO_METHODS.has(c.deliveryMethod ?? '')) {
      add(
        '추가 안내문구',
        presetIndex >= 0 ? `프리셋 ${presetIndex + 1} — ${EXTRA_INFO_PRESETS[presetIndex]}` : text(c.extraInfoMessage),
      );
    }
    add('반품지', placeName(data.returns, c.returnCenterCode));
    if (data.returns.length === 0) {
      add('반품지명', text(c.returnChargeName));
      add('연락처', text(c.returnContactNumber));
      add('우편번호', text(c.returnZipCode));
      add('주소', text(c.returnAddress));
      add('상세 주소', text(c.returnAddressDetail));
    }
    add('초도배송(편도)', won(c.deliveryChargeOnReturn));
    add('반품배송비(편도)', won(c.returnCharge));
  }

  return (
    <div className="space-y-4">
      {rows.map((row) => (
        <div key={row.label}>
          <label className="block text-sm font-medium mb-1">{row.label}</label>
          {row.lines.map((line, index) => (
            <p key={index} className="text-sm text-gray-900">
              {line}
            </p>
          ))}
        </div>
      ))}
    </div>
  );
}
