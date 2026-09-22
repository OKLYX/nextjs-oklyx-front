import type { ProductListingRepository } from '@/domain/repositories/ProductListingRepository';
import type { ProductListing, ProductListingOption } from '@/domain/entities/ProductListingEntity';
import type { UpdateProductListingRequest } from '@/application/dto/ProductListingDTOs';

export class ProductListingUseCase {
  constructor(private repository: ProductListingRepository) {}

  async getById(id: number): Promise<ProductListing> {
    return this.repository.getProductListingById(id);
  }

  async getByPlatform(platform: string, page: number, size: number, masterLinked?: boolean) {
    return this.repository.getProductListingsByPlatform(platform, page, size, masterLinked);
  }

  async update(id: number, request: UpdateProductListingRequest): Promise<ProductListing> {
    return this.repository.updateProductListing(id, request);
  }

  async delete(id: number): Promise<void> {
    return this.repository.deleteProductListing(id);
  }

  async getOptions(listingId: number): Promise<ProductListingOption[]> {
    return this.repository.getProductListingOptions(listingId);
  }
}
