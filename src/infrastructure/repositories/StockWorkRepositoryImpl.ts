import { axiosInstance } from '@/infrastructure/api/axiosInstance';
import type { StockWorkRepository } from '@/domain/repositories/StockWorkRepository';
import type { ClaimWorkRequest, OutboundWorkRequest } from '@/application/dto/StockWorkDTOs';
import type { ClaimWork, ShippedOrder } from '@/domain/entities/StockWorkEntity';

export class StockWorkRepositoryImpl implements StockWorkRepository {
  async outboundWork(request: OutboundWorkRequest): Promise<void> {
    await axiosInstance.post('/api/admin/stock/outbound-work', request);
  }

  async byReturnInvoice(value: string): Promise<ClaimWork[]> {
    const response = await axiosInstance.get('/api/admin/stock/return-work/by-return-invoice', { params: { value } });
    return response.data.data;
  }

  async byParcelInvoice(value: string): Promise<ClaimWork[]> {
    const response = await axiosInstance.get('/api/admin/stock/return-work/by-parcel-invoice', { params: { value } });
    return response.data.data;
  }

  async shippedOrders(): Promise<ShippedOrder[]> {
    const response = await axiosInstance.get('/api/admin/stock/return-work/shipped-orders');
    return response.data.data;
  }

  async byOrder(orderId: number): Promise<ClaimWork[]> {
    const response = await axiosInstance.get(`/api/admin/stock/return-work/orders/${orderId}`);
    return response.data.data;
  }

  async returnIn(request: ClaimWorkRequest): Promise<void> {
    await axiosInstance.post('/api/admin/stock/return-work', request);
  }

  async byReshipInvoice(value: string): Promise<ClaimWork[]> {
    const response = await axiosInstance.get('/api/admin/stock/exchange-work/by-reship-invoice', { params: { value } });
    return response.data.data;
  }

  async openExchanges(): Promise<ClaimWork[]> {
    const response = await axiosInstance.get('/api/admin/stock/exchange-work/open');
    return response.data.data;
  }

  async exchangeShip(request: ClaimWorkRequest): Promise<void> {
    await axiosInstance.post('/api/admin/stock/exchange-work', request);
  }
}
