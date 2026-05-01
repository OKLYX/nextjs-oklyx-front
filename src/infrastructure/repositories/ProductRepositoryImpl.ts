import { axiosInstance } from '@/infrastructure/api/axiosInstance';
import type { Product } from '@/domain/entities/Product';
import type { ProductRepository, GetProductsParams, GetProductsResponse, CreateProductRequest, UpdateProductRequest } from '@/domain/repositories/ProductRepository';

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

  async uploadProductImage(id: number, file: File): Promise<Product> {
    const formData = new FormData();
    formData.append('file', file);
    const response = await axiosInstance.put(`/api/products/${id}/image`, formData, {
      headers: {
        'Content-Type': undefined,
      },
    });
    return response.data.data;
  }

  async checkBarcodeExists(barcodeId: string): Promise<boolean> {
    const response = await axiosInstance.get('/api/products/check-barcode', {
      params: {
        barcode: barcodeId,
      },
    });
    return response.data.data.exists;
  }

  async updateProduct(id: number, data: UpdateProductRequest): Promise<Product> {
    const response = await axiosInstance.patch(`/api/products/${id}`, data);
    return response.data.data;
  }

  async deleteProductImage(id: number): Promise<void> {
    await axiosInstance.delete(`/api/products/${id}/image`);
  }
}
