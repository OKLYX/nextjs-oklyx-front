import { axiosInstance } from '@/infrastructure/api/axiosInstance';
import type { StockWorkRepository } from '@/domain/repositories/StockWorkRepository';
import type { OutboundWorkRequest } from '@/application/dto/StockWorkDTOs';

export class StockWorkRepositoryImpl implements StockWorkRepository {
  async outboundWork(request: OutboundWorkRequest): Promise<void> {
    await axiosInstance.post('/api/admin/stock/outbound-work', request);
  }
}
