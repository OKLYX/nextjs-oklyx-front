import type { ProductListingRepository } from '@/domain/repositories/ProductListingRepository';
import type { ProductListing } from '@/domain/entities/ProductListingEntity';
import type { CreateProductListingRequest, UpdateProductListingRequest } from '@/application/dto/ProductListingDTOs';

export class ProductListingUseCase {
  constructor(private repository: ProductListingRepository) {}

  async getById(id: number): Promise<ProductListing> {
    return this.repository.getProductListingById(id);
  }

  async getByPlatform(platform: string, page: number, size: number) {
    return this.repository.getProductListingsByPlatform(platform, page, size);
  }

  async create(request: CreateProductListingRequest): Promise<ProductListing> {
    return this.repository.createProductListing(request);
  }

  async update(id: number, request: UpdateProductListingRequest): Promise<ProductListing> {
    return this.repository.updateProductListing(id, request);
  }

  async delete(id: number): Promise<void> {
    return this.repository.deleteProductListing(id);
  }
}
