'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import axios from 'axios';
import { axiosInstance } from '@/infrastructure/api/axiosInstance';
import { GetProductDetailUseCase } from '@/application/usecases/GetProductDetailUseCase';
import { UpdateProductUseCase } from '@/application/usecases/UpdateProductUseCase';
import { ProductRepositoryImpl } from '@/infrastructure/repositories/ProductRepositoryImpl';
import { tokenStorage } from '@/infrastructure/auth/tokenStorage';
import { ROUTES } from '@/config/routes';
import type { Product } from '@/domain/entities/Product';
import type { UpdateProductRequest } from '@/domain/repositories/ProductRepository';
import { ProductDetailView } from './ProductDetailView';
import { ProductEditForm } from './ProductEditForm';

interface ProductDetailContainerProps {
  id: number;
}

export function ProductDetailContainer({ id }: ProductDetailContainerProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [product, setProduct] = useState<Product | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const isEditMode = searchParams.get('mode') === 'edit';

  const getUseCase = useMemo(
    () => new GetProductDetailUseCase(new ProductRepositoryImpl()),
    []
  );

  const updateUseCase = useMemo(
    () => new UpdateProductUseCase(new ProductRepositoryImpl()),
    []
  );

  const fetchProduct = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await getUseCase.getProduct(id);
      setProduct(data);
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.status === 401) {
        tokenStorage.removeToken();
        router.push(ROUTES.LOGIN);
        return;
      }

      if (axios.isAxiosError(err) && err.response?.status === 404) {
        setError('Product not found');
      } else {
        const errorMessage = err instanceof Error ? err.message : 'Failed to fetch product';
        setError(errorMessage);
      }
    } finally {
      setIsLoading(false);
    }
  }, [id, getUseCase, router]);

  useEffect(() => {
    fetchProduct();
  }, [fetchProduct]);

  const handleDelete = useCallback(async () => {
    await axiosInstance.delete(`/api/products/${id}`);
  }, [id]);

  const handleSave = useCallback(
    async (data: UpdateProductRequest) => {
      try {
        const updated = await updateUseCase.updateProduct(id, data);
        setProduct(updated);
        router.push(ROUTES.PRODUCT_DETAIL(id));
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to update product';
        setError(errorMessage);
        throw err;
      }
    },
    [id, updateUseCase, router]
  );

  const handleCancel = useCallback(() => {
    router.push(ROUTES.PRODUCT_DETAIL(id));
  }, [id, router]);

  const handleImageUpload = useCallback(
    async (file: File) => {
      try {
        const updated = await updateUseCase.uploadImage(id, file);
        setProduct(updated);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to upload image';
        setError(errorMessage);
      }
    },
    [id, updateUseCase]
  );

  const handleImageDelete = useCallback(async () => {
    try {
      await updateUseCase.deleteImage(id);
      fetchProduct();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete image';
      setError(errorMessage);
    }
  }, [id, updateUseCase, fetchProduct]);

  const handleCheckBarcode = useCallback(
    async (barcodeId: string) => {
      try {
        return await updateUseCase.checkBarcodeExists(barcodeId);
      } catch {
        return false;
      }
    },
    [updateUseCase]
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <p className="text-gray-600">Loading...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
        <p className="text-red-700">{error}</p>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
        <p className="text-red-700">Product not found</p>
      </div>
    );
  }

  if (isEditMode) {
    return (
      <ProductEditForm
        product={product}
        onSave={handleSave}
        onCancel={handleCancel}
        onCheckBarcode={handleCheckBarcode}
        onImageUpload={handleImageUpload}
        onImageDelete={handleImageDelete}
      />
    );
  }

  return (
    <ProductDetailView
      product={product}
      onDelete={handleDelete}
      onImageUpload={handleImageUpload}
      onImageDelete={handleImageDelete}
    />
  );
}
