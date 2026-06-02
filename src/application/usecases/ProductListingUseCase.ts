import type { ProductListingRepository } from '@/domain/repositories/ProductListingRepository';
import type { ProductListing, ProductListingOption, ProductListingProduct } from '@/domain/entities/ProductListingEntity';
import type { CreateProductListingRequest, UpdateProductListingRequest, CreateProductListingOptionRequest, CreateProductListingProductRequest } from '@/application/dto/ProductListingDTOs';

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

  async addOption(request: CreateProductListingOptionRequest): Promise<ProductListingOption> {
    return this.repository.addProductListingOption(request);
  }

  async addProduct(request: CreateProductListingProductRequest): Promise<ProductListingProduct> {
    return this.repository.addProductListingProduct(request);
  }
}
