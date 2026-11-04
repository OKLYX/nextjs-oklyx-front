import { axiosInstance } from '@/infrastructure/api/axiosInstance';
import type {
  MergePreviewRequest,
  MergePreviewResponse,
  MergeProductsRequest,
  MergeProductsResponse,
  ProductMergeRepository,
} from '@/domain/repositories/ProductMergeRepository';

export class ProductMergeRepositoryImpl implements ProductMergeRepository {
  async merge(request: MergeProductsRequest): Promise<MergeProductsResponse> {
    const response = await axiosInstance.post('/api/products/merge', request);
    return response.data.data;
  }

  async preview(request: MergePreviewRequest): Promise<MergePreviewResponse> {
    const response = await axiosInstance.post('/api/products/merge/preview', request);
    return response.data.data;
  }
}
