import { axiosInstance } from '@/infrastructure/api/axiosInstance';
import type { StockLotRepository } from '@/domain/repositories/StockLotRepository';
import type {
  FillCandidate,
  FillLot,
  IntakeBarcode,
  SellerDebtEntry,
  SellerDebtPair,
  StockDaily,
} from '@/domain/entities/StockLotEntity';
import type {
  DailyDateMoveRequest,
  DailyRowEditRequest,
  IntakeRequest,
  PurchasePriceRequest,
  ReceiptlessAssignRequest,
  SellerChangeRequest,
  SettlementRequest,
  StockFillRequest,
} from '@/application/dto/StockLotDTOs';
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

  async intake(request: IntakeRequest): Promise<number[]> {
    const response = await axiosInstance.post('/api/admin/stock/intake', request);
    return response.data.data.lotIds;
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

  async assignWithoutReceipt(movedOn: string, request: ReceiptlessAssignRequest): Promise<void> {
    await axiosInstance.post('/api/admin/purchase-receipts/assign-without-receipt', request, { params: { movedOn } });
  }

  async changeSeller(request: SellerChangeRequest): Promise<void> {
    await axiosInstance.post('/api/admin/stock/daily/change-seller', request);
  }

  async retypePrices(movedOn: string, photo: File | null, request: PurchasePriceRequest): Promise<void> {
    const formData = new FormData();
    if (photo) formData.append('photo', photo);
    // The server reads this part as JSON (@RequestPart) — it needs the application/json type.
    formData.append('request', new Blob([JSON.stringify(request)], { type: 'application/json' }));
    await axiosInstance.post('/api/admin/stock/daily/purchase-price', formData, {
      params: { movedOn },
      headers: { 'Content-Type': undefined },
    });
  }

  async editRow(movedOn: string, photo: File | null, request: DailyRowEditRequest): Promise<void> {
    const formData = new FormData();
    if (photo) formData.append('photo', photo);
    // The server reads this part as JSON (@RequestPart) — it needs the application/json type.
    formData.append('request', new Blob([JSON.stringify(request)], { type: 'application/json' }));
    await axiosInstance.post('/api/admin/stock/daily/row-edit', formData, {
      params: { movedOn },
      headers: { 'Content-Type': undefined },
    });
  }

  async moveDate(request: DailyDateMoveRequest): Promise<void> {
    await axiosInstance.post('/api/admin/stock/daily/move-date', request);
  }

  async fillCandidates(lotIds: number[]): Promise<FillCandidate[]> {
    // One comma-separated value — the server reads it as a list (FEATURE_2611_22 PLAN §3).
    const response = await axiosInstance.get('/api/admin/stock/fill/candidates', {
      params: { lotIds: lotIds.join(',') },
    });
    return response.data.data;
  }

  async fillLots(movementId: number): Promise<FillLot[]> {
    const response = await axiosInstance.get('/api/admin/stock/fill/lots', { params: { movementId } });
    return response.data.data;
  }

  async fill(request: StockFillRequest): Promise<void> {
    await axiosInstance.post('/api/admin/stock/fill', request);
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
