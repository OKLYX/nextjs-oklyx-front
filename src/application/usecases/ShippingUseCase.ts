import { ShippingRepository } from '@/domain/repositories/ShippingRepository';
import {
  OutboundPlace,
  ReturnCenter,
  ShippingConfig,
  ShippingConfigRequest,
} from '@/domain/entities/ShippingEntity';
import type { ElevenstShippingConfig, ElevenstShippingMap } from '@/domain/entities/ElevenstShipping';
import type { EsmChoice, EsmShippingConfig, EsmShippingMap } from '@/domain/entities/EsmShipping';
import type { LotteonChoice, LotteonShippingConfig, LotteonShippingMap } from '@/domain/entities/LotteonShipping';

export class ShippingUseCase {
  constructor(private repository: ShippingRepository) {}

  listOutbound(accountId: number): Promise<OutboundPlace[]> {
    return this.repository.listOutbound(accountId);
  }

  listReturn(accountId: number): Promise<ReturnCenter[]> {
    return this.repository.listReturn(accountId);
  }

  getConfig(accountId: number): Promise<ShippingConfig> {
    return this.repository.getConfig(accountId);
  }

  upsertConfig(accountId: number, data: ShippingConfigRequest): Promise<ShippingConfig> {
    return this.repository.upsertConfig(accountId, data);
  }

  getElevenstConfig(accountId: number): Promise<ElevenstShippingConfig> {
    return this.repository.getElevenstConfig(accountId);
  }

  upsertElevenstConfig(accountId: number, settings: ElevenstShippingMap): Promise<ElevenstShippingConfig> {
    return this.repository.upsertElevenstConfig(accountId, settings);
  }

  getEsmConfig(accountId: number): Promise<EsmShippingConfig> {
    return this.repository.getEsmConfig(accountId);
  }

  upsertEsmConfig(accountId: number, settings: EsmShippingMap): Promise<EsmShippingConfig> {
    return this.repository.upsertEsmConfig(accountId, settings);
  }

  listEsmBundlePolicies(accountId: number, placeNo: string): Promise<EsmChoice[]> {
    return this.repository.listEsmBundlePolicies(accountId, placeNo);
  }

  listEsmDispatchPolicies(accountId: number): Promise<EsmChoice[]> {
    return this.repository.listEsmDispatchPolicies(accountId);
  }

  listEsmDeliveryCompanies(accountId: number): Promise<EsmChoice[]> {
    return this.repository.listEsmDeliveryCompanies(accountId);
  }

  getLotteonConfig(accountId: number): Promise<LotteonShippingConfig> {
    return this.repository.getLotteonConfig(accountId);
  }

  upsertLotteonConfig(accountId: number, settings: LotteonShippingMap): Promise<LotteonShippingConfig> {
    return this.repository.upsertLotteonConfig(accountId, settings);
  }

  listLotteonFeePolicies(accountId: number): Promise<LotteonChoice[]> {
    return this.repository.listLotteonFeePolicies(accountId);
  }
}
