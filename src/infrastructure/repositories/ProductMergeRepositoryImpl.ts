import { axiosInstance } from '@/infrastructure/api/axiosInstance';
import type {
  MergeProductsRequest,
  MergeProductsResponse,
  ProductMergeRepository,
} from '@/domain/repositories/ProductMergeRepository';

export class ProductMergeRepositoryImpl implements ProductMergeRepository {
  async merge(request: MergeProductsRequest): Promise<MergeProductsResponse> {
    const response = await axiosInstance.post('/api/products/merge', request);
    return response.data.data;
  }
}
