export interface GetStockResponse {
  barcodeId: string;
  inStock: number;
}

export interface CreateStockRequest {
  barcodeId: string;
  type: 'IN' | 'OUT';
  quantity: number;
  name: string;
}

export interface CreateStockResponse {
  stockId: number;
  barcodeId: string;
  inStock: number;
  name: string;
  stockAdd: number;
  stockSub: number;
  createdDate: string;
}

export interface StockRepository {
  getCurrentStock(barcodeId: string): Promise<GetStockResponse>;
  createStock(data: CreateStockRequest): Promise<CreateStockResponse>;
}
