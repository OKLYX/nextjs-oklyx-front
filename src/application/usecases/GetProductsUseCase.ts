import type { ProductRepository, GetProductsParams, GetProductsResponse } from '@/domain/repositories/ProductRepository';

export class GetProductsUseCase {
  constructor(private repository: ProductRepository) {}

  async getProducts(params: GetProductsParams): Promise<GetProductsResponse> {
    return this.repository.getProducts(params);
  }
}
