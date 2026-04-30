import { axiosInstance } from '@/infrastructure/api/axiosInstance';
import type { Product } from '@/domain/entities/Product';
import type { ProductRepository, GetProductsParams, GetProductsResponse, CreateProductRequest } from '@/domain/repositories/ProductRepository';

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

  async createProduct(data: CreateProductRequest): Promise<Product> {
    const payload = Object.fromEntries(
      Object.entries(data).filter(([, value]) => value !== undefined && value !== null && value !== '')
    );
    const response = await axiosInstance.post('/api/products', payload);
    return response.data.data;
  }

  async uploadProductImage(id: number, file: File): Promise<void> {
    const formData = new FormData();
    formData.append('file', file);
    await axiosInstance.put(`/api/products/${id}/image`, formData);
  }

  async checkBarcodeExists(barcodeId: string): Promise<boolean> {
    const response = await axiosInstance.get('/api/products/check-barcode', {
      params: {
        barcode: barcodeId,
      },
    });
    return response.data.data.exists;
  }
}
