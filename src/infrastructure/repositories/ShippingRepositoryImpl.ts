'use client';

import { axiosInstance } from '@/infrastructure/api/axiosInstance';
import { ShippingRepository } from '@/domain/repositories/ShippingRepository';
import {
  OutboundPlace,
  ReturnCenter,
  ShippingConfig,
  ShippingConfigRequest,
} from '@/domain/entities/ShippingEntity';

// Base path matches backend 72 ShippingConfigController
// (@RequestMapping("/api/admin/marketplace-account/{id}")).
const base = (accountId: number) => `/api/admin/marketplace-account/${accountId}`;

export class ShippingRepositoryImpl implements ShippingRepository {
  async listOutbound(accountId: number): Promise<OutboundPlace[]> {
    const response = await axiosInstance.get(`${base(accountId)}/shipping-places/outbound`);
    return response.data.data;
  }

  async listReturn(accountId: number): Promise<ReturnCenter[]> {
    const response = await axiosInstance.get(`${base(accountId)}/shipping-places/return`);
    return response.data.data;
  }

  async getConfig(accountId: number): Promise<ShippingConfig> {
    const response = await axiosInstance.get(`${base(accountId)}/shipping-config`);
    return response.data.data;
  }

  async upsertConfig(accountId: number, data: ShippingConfigRequest): Promise<ShippingConfig> {
    const response = await axiosInstance.put(`${base(accountId)}/shipping-config`, data);
    return response.data.data;
  }
}
