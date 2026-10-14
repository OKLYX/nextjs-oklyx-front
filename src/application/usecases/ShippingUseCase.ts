import { ShippingRepository } from '@/domain/repositories/ShippingRepository';
import {
  OutboundPlace,
  ReturnCenter,
  ShippingConfig,
  ShippingConfigRequest,
} from '@/domain/entities/ShippingEntity';
import type { ElevenstShippingConfig, ElevenstShippingMap } from '@/domain/entities/ElevenstShipping';

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
}
