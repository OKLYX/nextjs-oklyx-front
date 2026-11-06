import {
  OutboundPlace,
  ReturnCenter,
  ShippingConfig,
  ShippingConfigRequest,
} from '@/domain/entities/ShippingEntity';
import type { ElevenstShippingConfig, ElevenstShippingMap } from '@/domain/entities/ElevenstShipping';
import type { EsmChoice, EsmShippingConfig, EsmShippingMap } from '@/domain/entities/EsmShipping';
import type { LotteonChoice, LotteonShippingConfig, LotteonShippingMap } from '@/domain/entities/LotteonShipping';

export interface ShippingRepository {
  listOutbound(accountId: number): Promise<OutboundPlace[]>;
  listReturn(accountId: number): Promise<ReturnCenter[]>;
  getConfig(accountId: number): Promise<ShippingConfig>;
  upsertConfig(accountId: number, data: ShippingConfigRequest): Promise<ShippingConfig>;
  // FEATURE_2610_13 / D84: the 11st channel default (an 11st account only).
  getElevenstConfig(accountId: number): Promise<ElevenstShippingConfig>;
  upsertElevenstConfig(accountId: number, settings: ElevenstShippingMap): Promise<ElevenstShippingConfig>;
  // FEATURE_2610_26 / D36 · D37: the ESM channel layer and the ESM lists (an ESM account only).
  getEsmConfig(accountId: number): Promise<EsmShippingConfig>;
  upsertEsmConfig(accountId: number, settings: EsmShippingMap): Promise<EsmShippingConfig>;
  listEsmBundlePolicies(accountId: number, placeNo: string): Promise<EsmChoice[]>;
  listEsmDispatchPolicies(accountId: number): Promise<EsmChoice[]>;
  listEsmDeliveryCompanies(accountId: number): Promise<EsmChoice[]>;
  // FEATURE_2610_24 / D42 · D43 · D65: the LotteON channel layer and its shipping fee policy list.
  getLotteonConfig(accountId: number): Promise<LotteonShippingConfig>;
  upsertLotteonConfig(accountId: number, settings: LotteonShippingMap): Promise<LotteonShippingConfig>;
  listLotteonFeePolicies(accountId: number): Promise<LotteonChoice[]>;
}
