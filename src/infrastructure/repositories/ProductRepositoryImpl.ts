import { axiosInstance } from '@/infrastructure/api/axiosInstance';
import type { Product } from '@/domain/entities/Product';
import type { ProductRepository, GetProductsParams, GetProductsResponse } from '@/domain/repositories/ProductRepository';

export class ProductRepositoryImpl implements ProductRepository {
  async getProducts(params: GetProductsParams): Promise<GetProductsResponse> {
    const response = await axiosInstance.get('/api/products', {
      params: {
        page: params.page,
        size: params.size,
        search: params.search,
      },
    });

    return response.data.data;
  }

  async getProductDetail(id: number): Promise<Product> {
    const response = await axiosInstance.get(`/api/products/${id}`);
    return response.data.data;
  }
}
