'use client';

import { axiosInstance } from '@/infrastructure/api/axiosInstance';
import { ShippingRepository } from '@/domain/repositories/ShippingRepository';
import {
  OutboundPlace,
  ReturnCenter,
  ShippingConfig,
  ShippingConfigRequest,
} from '@/domain/entities/ShippingEntity';
import type { ElevenstShippingConfig, ElevenstShippingMap } from '@/domain/entities/ElevenstShipping';
import type { EsmChoice, EsmShippingConfig, EsmShippingMap } from '@/domain/entities/EsmShipping';

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

  async getElevenstConfig(accountId: number): Promise<ElevenstShippingConfig> {
    const response = await axiosInstance.get(`${base(accountId)}/elevenst-shipping-config`);
    return response.data.data;
  }

  async upsertElevenstConfig(accountId: number, settings: ElevenstShippingMap): Promise<ElevenstShippingConfig> {
    const response = await axiosInstance.put(`${base(accountId)}/elevenst-shipping-config`, { settings });
    return response.data.data;
  }

  async getEsmConfig(accountId: number): Promise<EsmShippingConfig> {
    const response = await axiosInstance.get(`${base(accountId)}/esm-shipping-config`);
    return response.data.data;
  }

  async upsertEsmConfig(accountId: number, settings: EsmShippingMap): Promise<EsmShippingConfig> {
    const response = await axiosInstance.put(`${base(accountId)}/esm-shipping-config`, { settings });
    return response.data.data;
  }

  async listEsmBundlePolicies(accountId: number, placeNo: string): Promise<EsmChoice[]> {
    const response = await axiosInstance.get(`${base(accountId)}/esm-shipping/bundle-policies`, {
      params: { placeNo },
    });
    return response.data.data;
  }

  async listEsmDispatchPolicies(accountId: number): Promise<EsmChoice[]> {
    const response = await axiosInstance.get(`${base(accountId)}/esm-shipping/dispatch-policies`);
    return response.data.data;
  }

  async listEsmDeliveryCompanies(accountId: number): Promise<EsmChoice[]> {
    const response = await axiosInstance.get(`${base(accountId)}/esm-shipping/delivery-companies`);
    return response.data.data;
  }
}
