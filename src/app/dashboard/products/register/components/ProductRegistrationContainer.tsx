'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import { CreateProductUseCase } from '@/application/usecases/CreateProductUseCase';
import { ProductRepositoryImpl } from '@/infrastructure/repositories/ProductRepositoryImpl';
import { tokenStorage } from '@/infrastructure/auth/tokenStorage';
import { ROUTES } from '@/config/routes';
import type { CreateProductRequest } from '@/domain/repositories/ProductRepository';
import { ProductRegistrationForm } from './ProductRegistrationForm';
import { SuccessDialog } from './SuccessDialog';

export function ProductRegistrationContainer() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);

  const useCase = useMemo(
    () => new CreateProductUseCase(new ProductRepositoryImpl()),
    []
  );

  const handleImageChange = useCallback((file: File | null, previewUrl: string | null) => {
    setImageFile(file);
    setImagePreviewUrl(previewUrl);
  }, []);

  const handleCheckBarcode = useCallback(async (barcodeId: string): Promise<boolean> => {
    try {
      return await useCase.checkBarcodeExists(barcodeId);
    } catch {
      return false;
    }
  }, [useCase]);

  const handleSubmit = useCallback(
    async (data: CreateProductRequest) => {
      setIsLoading(true);
      setError(null);

      try {
        const product = await useCase.createProduct(data);

        if (imageFile) {
          try {
            await useCase.uploadImage(product.id, imageFile);
          } catch {
            // Image upload failure is non-critical, product is already created
          }
        }

        setShowSuccessDialog(true);
      } catch (err) {
        if (axios.isAxiosError(err) && err.response?.status === 401) {
          tokenStorage.removeToken();
          router.push(ROUTES.LOGIN);
          throw err;
        }

        let errorMessage = 'Failed to register product';
        if (axios.isAxiosError(err)) {
          errorMessage = (err.response?.data as any)?.message || err.message;
        } else if (err instanceof Error) {
          errorMessage = err.message;
        }
        setError(errorMessage);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [useCase, imageFile, router]
  );

  const handleSubmitSuccess = useCallback(() => {
    setImageFile(null);
    setImagePreviewUrl(null);
  }, []);

  const handleGoToList = useCallback(() => {
    router.push(ROUTES.PRODUCTS_RETRIEVE);
  }, [router]);

  const handleRegisterAnother = useCallback(() => {
    setShowSuccessDialog(false);
    setImageFile(null);
    setImagePreviewUrl(null);
    setError(null);
  }, []);

  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => {
        setError(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  return (
    <div className="space-y-6">
      {error && (
        <div className="flex items-center justify-between p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-700">{error}</p>
          <button
            onClick={() => setError(null)}
            className="text-red-600 hover:text-red-700 text-lg font-bold"
          >
            ×
          </button>
        </div>
      )}
      <ProductRegistrationForm
        onSubmit={handleSubmit}
        isLoading={isLoading}
        imageFile={imageFile}
        imagePreviewUrl={imagePreviewUrl}
        onImageChange={handleImageChange}
        onCheckBarcode={handleCheckBarcode}
        onSubmitSuccess={handleSubmitSuccess}
      />
      <SuccessDialog
        isOpen={showSuccessDialog}
        onGoToList={handleGoToList}
        onRegisterAnother={handleRegisterAnother}
      />
    </div>
  );
}
