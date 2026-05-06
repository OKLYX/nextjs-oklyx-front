import type {
  CreateStockRequest,
  CreateStockResponse,
  GetStockResponse,
  StockRepository,
} from '@/domain/repositories/StockRepository';

export class StockUseCase {
  constructor(private repository: StockRepository) {}

  async getCurrentStock(barcodeId: string): Promise<GetStockResponse> {
    return this.repository.getCurrentStock(barcodeId);
  }

  async createStock(data: CreateStockRequest): Promise<CreateStockResponse> {
    return this.repository.createStock(data);
  }
}
