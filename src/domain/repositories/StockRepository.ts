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

export interface BatchStockItem {
  barcodeId: string;
  quantity: number;
  name: string;
}

export interface BatchStockRequest {
  type: 'IN' | 'OUT';
  items: BatchStockItem[];
}

export interface BatchStockResponse {
  items: CreateStockResponse[];
}

export interface GetStockLogsParams {
  barcodeId?: string;
  productName?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  size?: number;
}

export interface StockLog {
  stockId: number;
  barcodeId: string;
  productName: string;
  inStock: number;
  stockAdd: number;
  stockSub: number;
  createdDate: string;
}

export interface GetStockLogsResponse {
  content: StockLog[];
  page: number;
  size: number;
  totalElements: number;
}

export interface StockRepository {
  getCurrentStock(barcodeId: string): Promise<GetStockResponse>;
  createStock(data: CreateStockRequest): Promise<CreateStockResponse>;
  createBatchStock(data: BatchStockRequest): Promise<BatchStockResponse>;
  getStockLogs(params: GetStockLogsParams): Promise<GetStockLogsResponse>;
}
