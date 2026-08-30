import {
  OutboundPlace,
  ReturnCenter,
  ShippingConfig,
  ShippingConfigRequest,
} from '@/domain/entities/ShippingEntity';

export interface ShippingRepository {
  listOutbound(accountId: number): Promise<OutboundPlace[]>;
  listReturn(accountId: number): Promise<ReturnCenter[]>;
  getConfig(accountId: number): Promise<ShippingConfig>;
  upsertConfig(accountId: number, data: ShippingConfigRequest): Promise<ShippingConfig>;
}
