import { ShippingRepository } from '@/domain/repositories/ShippingRepository';
import {
  OutboundPlace,
  ReturnCenter,
  ShippingConfig,
  ShippingConfigRequest,
} from '@/domain/entities/ShippingEntity';

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
}
