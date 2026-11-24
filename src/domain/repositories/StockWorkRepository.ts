import type { OutboundWorkRequest } from '@/application/dto/StockWorkDTOs';

/** Stock work screens (FEATURE_2611_34). */
export interface StockWorkRepository {
  outboundWork(request: OutboundWorkRequest): Promise<void>;
}
