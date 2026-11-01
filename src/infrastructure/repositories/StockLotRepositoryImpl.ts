import { axiosInstance } from '@/infrastructure/api/axiosInstance';
import type { StockLotRepository } from '@/domain/repositories/StockLotRepository';
import type { IntakeBarcode, SellerDebtEntry, SellerDebtPair, StockDaily } from '@/domain/entities/StockLotEntity';
import type { IntakeRequest, SettlementRequest } from '@/application/dto/StockLotDTOs';
import type { CreateReceiptRequest } from '@/application/dto/PurchaseReceiptDTOs';

export class StockLotRepositoryImpl implements StockLotRepository {
  async daily(date: string): Promise<StockDaily> {
    const response = await axiosInstance.get('/api/admin/stock/daily', { params: { date } });
    return response.data.data;
  }

  async barcode(value: string): Promise<IntakeBarcode> {
    const response = await axiosInstance.get('/api/admin/stock/intake/barcode', { params: { value } });
    return response.data.data;
  }

  async intake(request: IntakeRequest): Promise<void> {
    await axiosInstance.post('/api/admin/stock/intake', request);
  }

  async assign(movedOn: string, photo: File, request: CreateReceiptRequest): Promise<void> {
    const formData = new FormData();
    formData.append('photo', photo);
    // The server reads this part as JSON (@RequestPart) — it needs the application/json type.
    formData.append('request', new Blob([JSON.stringify(request)], { type: 'application/json' }));
    await axiosInstance.post('/api/admin/purchase-receipts/assign', formData, {
      params: { movedOn },
      headers: { 'Content-Type': undefined },
    });
  }

  async debtPairs(): Promise<SellerDebtPair[]> {
    const response = await axiosInstance.get('/api/admin/seller-debts');
    return response.data.data;
  }

  async debtEntries(sellerAId: number, sellerBId: number): Promise<SellerDebtEntry[]> {
    const response = await axiosInstance.get('/api/admin/seller-debts/entries', {
      params: { sellerA: sellerAId, sellerB: sellerBId },
    });
    return response.data.data;
  }

  async settle(request: SettlementRequest): Promise<void> {
    await axiosInstance.post('/api/admin/seller-debts/settlements', request);
  }

  async cancelSettlement(settlementId: number): Promise<void> {
    await axiosInstance.post(`/api/admin/seller-debts/settlements/${settlementId}/cancel`);
  }

  async fillUnitPrice(debtId: number, unitPrice: number): Promise<void> {
    await axiosInstance.put(`/api/admin/seller-debts/${debtId}/unit-price`, { unitPrice });
  }
}
