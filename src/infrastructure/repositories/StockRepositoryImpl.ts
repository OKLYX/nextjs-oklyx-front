import axios from 'axios';
import { axiosInstance } from '@/infrastructure/api/axiosInstance';
import type {
  BatchStockRequest,
  BatchStockResponse,
  CreateStockRequest,
  CreateStockResponse,
  GetStockLogsParams,
  GetStockLogsResponse,
  GetStockResponse,
  StockRepository,
} from '@/domain/repositories/StockRepository';

export class StockRepositoryImpl implements StockRepository {
  async getCurrentStock(barcodeId: string): Promise<GetStockResponse> {
    try {
      const response = await axiosInstance.get(`/api/stock/${barcodeId}`);
      return response.data.data;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        return { barcodeId, inStock: 0 };
      }
      throw error;
    }
  }

  async createStock(data: CreateStockRequest): Promise<CreateStockResponse> {
    const response = await axiosInstance.post('/api/stock', data);
    return response.data.data;
  }

  async createBatchStock(data: BatchStockRequest): Promise<BatchStockResponse> {
    const response = await axiosInstance.post('/api/stock/batch', data);
    return response.data.data;
  }

  async getStockLogs(params: GetStockLogsParams): Promise<GetStockLogsResponse> {
    const queryParams = {
      ...(params.barcodeId && { barcodeId: params.barcodeId }),
      ...(params.productName && { productName: params.productName }),
      ...(params.startDate && { startDate: params.startDate }),
      ...(params.endDate && { endDate: params.endDate }),
      page: params.page ?? 0,
      size: params.size ?? 20,
    };
    const response = await axiosInstance.get('/api/stock', { params: queryParams });
    return response.data.data;
  }
}
