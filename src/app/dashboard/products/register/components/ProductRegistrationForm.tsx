'use client';

import { useCallback, useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { ROUTES } from '@/config/routes';
import type { CreateProductRequest } from '@/domain/repositories/ProductRepository';

const numberField = z
  .string()
  .optional()
  .transform(val => {
    if (!val || val === '') return undefined;
    const num = Number(val);
    return Number.isNaN(num) || num <= 0 ? undefined : num;
  });

const schema = z.object({
  productName: z.string().min(1, 'Product name is required'),
  barcodeId: z.string().min(1, 'Barcode ID is required'),
  brand: z.string().optional(),
  price: z
    .string()
    .optional()
    .transform(val => {
      if (!val || val === '') return undefined;
      const num = Number(val);
      return Number.isNaN(num) || num <= 0 ? undefined : num;
    }),
  store: z.string().optional(),
  unit: z.string().optional(),
  volumeHeight: numberField,
  volumeLong: numberField,
  volumeShort: numberField,
  weight: numberField,
  description: z.string().optional(),
});

interface ProductRegistrationFormProps {
  onSubmit: (data: CreateProductRequest, imageFile: File | null) => Promise<void>;
  isLoading: boolean;
  imageFile: File | null;
  imagePreviewUrl: string | null;
  onImageChange: (file: File | null, previewUrl: string | null) => void;
  onCheckBarcode: (barcodeId: string) => Promise<boolean>;
  onSubmitSuccess: () => void;
}

export function ProductRegistrationForm({
  onSubmit,
  isLoading,
  imageFile,
  imagePreviewUrl,
  onImageChange,
  onCheckBarcode,
  onSubmitSuccess,
}: ProductRegistrationFormProps) {
  const router = useRouter();
  const [barcodeError, setBarcodeError] = useState<string | null>(null);
  const [isCheckingBarcode, setIsCheckingBarcode] = useState(false);
  const [validatedBarcode, setValidatedBarcode] = useState<string | null>(null);
  const [imageValidationError, setImageValidationError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
    reset,
    setValue,
  } = useForm<CreateProductRequest>({
    resolver: zodResolver(schema),
  });

  const barcodeValue = watch('barcodeId');

  const handleCheckBarcode = useCallback(async () => {
    if (!barcodeValue || barcodeValue.trim() === '') {
      return;
    }

    setIsCheckingBarcode(true);
    try {
      const exists = await onCheckBarcode(barcodeValue);
      if (exists) {
        setBarcodeError('Barcode already exists');
        setValidatedBarcode(null);
      } else {
        setBarcodeError(null);
        setValidatedBarcode(barcodeValue);
      }
    } catch {
      setBarcodeError('Error checking barcode');
      setValidatedBarcode(null);
    } finally {
      setIsCheckingBarcode(false);
    }
  }, [barcodeValue, onCheckBarcode]);

  const handleReset = useCallback(() => {
    reset();
    setBarcodeError(null);
    setValidatedBarcode(null);
  }, [reset]);

  const handleImageFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      setImageValidationError(null);

      if (!file) {
        onImageChange(null, null);
        return;
      }

      const validTypes = ['image/jpeg', 'image/png'];
      if (!validTypes.includes(file.type)) {
        setImageValidationError('Only JPEG and PNG images are allowed.');
        onImageChange(null, null);
        return;
      }

      const maxSize = 20 * 1024 * 1024;
      if (file.size > maxSize) {
        setImageValidationError('Image size must not exceed 20MB.');
        onImageChange(null, null);
        return;
      }

      const previewUrl = URL.createObjectURL(file);
      onImageChange(file, previewUrl);
    },
    [onImageChange]
  );

  const handleFormSubmit = useCallback(
    async (data: CreateProductRequest) => {
      try {
        await onSubmit(data, imageFile);
        reset();
        setValidatedBarcode(null);
        onSubmitSuccess();
      } catch {
        // Error is handled in container, form state preserved
      }
    },
    [onSubmit, imageFile, reset, onSubmitSuccess]
  );

  useEffect(() => {
    if (validatedBarcode === null && barcodeValue && barcodeValue.trim() !== '') {
      setBarcodeError(null);
    }
  }, [barcodeValue, validatedBarcode]);

  useEffect(() => {
    if (barcodeError) {
      const timer = setTimeout(() => {
        setBarcodeError(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [barcodeError]);

  useEffect(() => {
    return () => {
      if (imagePreviewUrl) {
        URL.revokeObjectURL(imagePreviewUrl);
      }
    };
  }, [imagePreviewUrl]);

  const isProductNameDisabled = !validatedBarcode;

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="max-w-2xl space-y-8">
      <h1 className="text-3xl font-bold">Register New Product</h1>

      {/* Required Fields */}
      <fieldset className="border border-gray-300 rounded-lg p-6 bg-gray-50">
        <legend className="text-lg font-semibold text-gray-900 px-2">Required</legend>
        <div className="space-y-4">
          {/* Barcode ID */}
          <div>
            <label htmlFor="barcodeId" className="block text-sm font-medium text-gray-900 mb-1">
              Barcode ID
            </label>
            <div className="flex gap-2">
              <div className="flex-1">
                <input
                  id="barcodeId"
                  type="text"
                  placeholder="Enter barcode ID"
                  {...register('barcodeId')}
                  disabled={validatedBarcode !== null}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                />
              </div>
              {validatedBarcode !== null ? (
                <button
                  type="button"
                  onClick={handleReset}
                  className="px-4 py-2 bg-gray-500 text-white font-medium rounded-lg hover:bg-gray-600 transition-colors"
                >
                  Reset
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleCheckBarcode}
                  disabled={!barcodeValue || barcodeValue.trim() === '' || isCheckingBarcode}
                  className="px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
                >
                  {isCheckingBarcode ? 'Checking...' : 'Check'}
                </button>
              )}
            </div>
            {barcodeError && (
              <div className="flex items-center gap-2 mt-1">
                <p className="text-red-600 text-sm flex-1">{barcodeError}</p>
                <button
                  type="button"
                  onClick={() => setBarcodeError(null)}
                  className="text-red-600 hover:text-red-700 text-lg font-bold"
                >
                  ×
                </button>
              </div>
            )}
            {errors.barcodeId && <p className="text-red-600 text-sm mt-1">{errors.barcodeId.message}</p>}
          </div>

          {/* Product Name */}
          <div>
            <label htmlFor="productName" className="block text-sm font-medium text-gray-900 mb-1">
              Product Name
            </label>
            <input
              id="productName"
              type="text"
              placeholder="Enter product name"
              disabled={isProductNameDisabled || isLoading}
              {...register('productName')}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
            />
            {errors.productName && <p className="text-red-600 text-sm mt-1">{errors.productName.message}</p>}
          </div>
        </div>
      </fieldset>

      {/* Optional Fields */}
      <fieldset disabled={isProductNameDisabled} className="border border-gray-200 rounded-lg p-6 bg-white disabled:opacity-50 disabled:pointer-events-none">
        <legend className="text-lg font-semibold text-gray-900 px-2">Optional</legend>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="brand" className="block text-sm font-medium text-gray-900 mb-1">
                Brand
              </label>
              <input
                id="brand"
                type="text"
                placeholder="Enter brand name"
                disabled={isLoading}
                {...register('brand')}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
              />
            </div>

            <div>
              <label htmlFor="price" className="block text-sm font-medium text-gray-900 mb-1">
                Price
              </label>
              <input
                id="price"
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                placeholder="0.00"
                disabled={isLoading}
                {...register('price')}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
              />
              {errors.price && <p className="text-red-600 text-sm mt-1">{errors.price.message}</p>}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="store" className="block text-sm font-medium text-gray-900 mb-1">
                Store
              </label>
              <select
                id="store"
                disabled={isLoading}
                {...register('store')}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
              >
                <option value="">Select store</option>
                <option value="이마트">이마트</option>
                <option value="코스트코">코스트코</option>
                <option value="노브랜드">노브랜드</option>
              </select>
            </div>

            <div>
              <label htmlFor="unit" className="block text-sm font-medium text-gray-900 mb-1">
                Unit
              </label>
              <select
                id="unit"
                disabled={isLoading}
                {...register('unit')}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
              >
                <option value="">Select unit</option>
                <option value="G">g</option>
                <option value="KG">kg</option>
                <option value="L">l</option>
                <option value="ML">ml</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="volumeHeight" className="block text-sm font-medium text-gray-900 mb-1">
                Volume Height
              </label>
              <input
                id="volumeHeight"
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                placeholder="0"
                disabled={isLoading}
                {...register('volumeHeight')}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
              />
              {errors.volumeHeight && <p className="text-red-600 text-sm mt-1">{errors.volumeHeight.message}</p>}
            </div>

            <div>
              <label htmlFor="volumeLong" className="block text-sm font-medium text-gray-900 mb-1">
                Volume Long
              </label>
              <input
                id="volumeLong"
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                placeholder="0"
                disabled={isLoading}
                {...register('volumeLong')}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
              />
              {errors.volumeLong && <p className="text-red-600 text-sm mt-1">{errors.volumeLong.message}</p>}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="volumeShort" className="block text-sm font-medium text-gray-900 mb-1">
                Volume Short
              </label>
              <input
                id="volumeShort"
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                placeholder="0"
                disabled={isLoading}
                {...register('volumeShort')}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
              />
              {errors.volumeShort && <p className="text-red-600 text-sm mt-1">{errors.volumeShort.message}</p>}
            </div>

            <div>
              <label htmlFor="weight" className="block text-sm font-medium text-gray-900 mb-1">
                Weight
              </label>
              <input
                id="weight"
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                placeholder="0"
                disabled={isLoading}
                {...register('weight')}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
              />
              {errors.weight && <p className="text-red-600 text-sm mt-1">{errors.weight.message}</p>}
            </div>
          </div>

          <div>
            <label htmlFor="description" className="block text-sm font-medium text-gray-900 mb-1">
              Description
            </label>
            <textarea
              id="description"
              placeholder="Enter product description"
              rows={4}
              disabled={isLoading}
              {...register('description')}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
            />
          </div>
        </div>
      </fieldset>

      {/* Image Upload */}
      <fieldset disabled={isProductNameDisabled} className="border border-gray-200 rounded-lg p-6 bg-white disabled:opacity-50 disabled:pointer-events-none">
        <legend className="text-lg font-semibold text-gray-900 px-2">Product Image (Optional)</legend>
        <div className="space-y-4">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png"
            onChange={handleImageFileChange}
            disabled={isLoading}
            className="block w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
          />

          {imageValidationError && <p className="text-red-600 text-sm">{imageValidationError}</p>}

          {imagePreviewUrl && (
            <div className="space-y-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={imagePreviewUrl}
                alt="Preview"
                className="max-h-48 rounded-lg border border-gray-300"
              />
              {imageFile && (
                <div className="flex items-center justify-between">
                  <p className="text-sm text-gray-600">
                    {imageFile.name} ({(imageFile.size / 1024 / 1024).toFixed(2)}MB)
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      onImageChange(null, null);
                      if (fileInputRef.current) {
                        fileInputRef.current.value = '';
                      }
                    }}
                    className="text-sm text-red-600 hover:text-red-700 font-medium"
                  >
                    Remove
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </fieldset>

      {/* Submit Button */}
      <button
        type="submit"
        disabled={isLoading || isProductNameDisabled}
        className="w-full px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
      >
        {isLoading ? 'Registering...' : 'Register Product'}
      </button>
    </form>
  );
}
