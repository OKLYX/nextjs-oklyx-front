import axios from 'axios';
import { axiosInstance } from '@/infrastructure/api/axiosInstance';
import type {
  CreateStockRequest,
  CreateStockResponse,
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
}
