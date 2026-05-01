'use client';

import { useCallback, useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import type { Product } from '@/domain/entities/Product';
import type { UpdateProductRequest } from '@/domain/repositories/ProductRepository';
import { ProductImageSection } from './ProductImageSection';

const numberField = z.union([
  z.number().positive('Must be positive'),
  z.nan(),
]).optional().transform(val => isNaN(val as number) ? undefined : val) as unknown as z.ZodOptional<z.ZodNumber>;

const schema = z.object({
  productName: z.string().min(1, 'Product name is required'),
  barcodeId: z.string().min(1, 'Barcode ID is required'),
  brand: z.string().optional(),
  price: z.union([
    z.number().positive('Price must be positive'),
    z.nan(),
  ]).optional().transform(val => isNaN(val as number) ? undefined : val) as unknown as z.ZodOptional<z.ZodNumber>,
  store: z.string().optional(),
  unit: z.string().optional(),
  volumeHeight: numberField,
  volumeLong: numberField,
  volumeShort: numberField,
  weight: numberField,
  description: z.string().optional(),
});

interface ProductEditFormProps {
  product: Product;
  onSave: (data: UpdateProductRequest) => Promise<void>;
  onCancel: () => void;
  onCheckBarcode: (barcodeId: string) => Promise<boolean>;
  onImageUpload: (file: File) => Promise<void>;
  onImageDelete: () => Promise<void>;
}

export function ProductEditForm({
  product,
  onSave,
  onCancel,
  onCheckBarcode,
  onImageUpload,
  onImageDelete,
}: ProductEditFormProps) {
  const [barcodeError, setBarcodeError] = useState<string | null>(null);
  const [isCheckingBarcode, setIsCheckingBarcode] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [productImage, setProductImage] = useState<string | null>(product.imageUrl || null);

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
  } = useForm<UpdateProductRequest>({
    resolver: zodResolver(schema) as any,
    defaultValues: {
      productName: product.productName,
      barcodeId: product.barcodeId,
      brand: product.brand,
      price: product.price,
      store: product.store,
      unit: product.unit,
      volumeHeight: product.volumeHeight,
      volumeLong: product.volumeLong,
      volumeShort: product.volumeShort,
      weight: product.weight,
      description: product.description,
    },
  });

  const barcodeValue = watch('barcodeId');

  const handleBarcodeBlur = useCallback(async () => {
    if (!barcodeValue || barcodeValue.trim() === '') {
      setBarcodeError(null);
      return;
    }

    if (barcodeValue === product.barcodeId) {
      setBarcodeError(null);
      return;
    }

    setIsCheckingBarcode(true);
    try {
      const exists = await onCheckBarcode(barcodeValue);
      if (exists) {
        setBarcodeError('Barcode already exists');
      } else {
        setBarcodeError(null);
      }
    } catch {
      setBarcodeError('Error checking barcode');
    } finally {
      setIsCheckingBarcode(false);
    }
  }, [barcodeValue, onCheckBarcode, product.barcodeId]);

  useEffect(() => {
    if (barcodeValue !== product.barcodeId) {
      setBarcodeError(null);
    }
  }, [barcodeValue, product.barcodeId]);

  const handleFormSubmit = useCallback(
    async (data: UpdateProductRequest) => {
      setIsSaving(true);
      try {
        await onSave(data);
      } catch {
        setIsSaving(false);
      }
    },
    [onSave]
  );

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="max-w-2xl space-y-8">
      <h1 className="text-3xl font-bold">Edit Product</h1>

      {/* Required Fields */}
      <fieldset className="border border-gray-300 rounded-lg p-6 bg-gray-50">
        <legend className="text-lg font-semibold text-gray-900 px-2">Required</legend>
        <div className="space-y-4">
          <div>
            <label htmlFor="barcodeId" className="block text-sm font-medium text-gray-900 mb-1">
              Barcode ID
            </label>
            <input
              id="barcodeId"
              type="text"
              {...register('barcodeId')}
              onBlur={handleBarcodeBlur}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
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

          <div>
            <label htmlFor="productName" className="block text-sm font-medium text-gray-900 mb-1">
              Product Name
            </label>
            <input
              id="productName"
              type="text"
              {...register('productName')}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {errors.productName && <p className="text-red-600 text-sm mt-1">{errors.productName.message}</p>}
          </div>
        </div>
      </fieldset>

      {/* Optional Fields */}
      <fieldset className="border border-gray-200 rounded-lg p-6 bg-white">
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
                {...register('brand')}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label htmlFor="price" className="block text-sm font-medium text-gray-900 mb-1">
                Price
              </label>
              <input
                id="price"
                type="number"
                step="any"
                {...register('price', { valueAsNumber: true })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {errors.price && <p className="text-red-600 text-sm mt-1">{errors.price.message}</p>}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="store" className="block text-sm font-medium text-gray-900 mb-1">
                Store
              </label>
              <input
                id="store"
                type="text"
                {...register('store')}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label htmlFor="unit" className="block text-sm font-medium text-gray-900 mb-1">
                Unit
              </label>
              <input
                id="unit"
                type="text"
                {...register('unit')}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="volumeHeight" className="block text-sm font-medium text-gray-900 mb-1">
                Volume Height
              </label>
              <input
                id="volumeHeight"
                type="number"
                step="any"
                {...register('volumeHeight', { valueAsNumber: true })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {errors.volumeHeight && <p className="text-red-600 text-sm mt-1">{errors.volumeHeight.message}</p>}
            </div>

            <div>
              <label htmlFor="volumeLong" className="block text-sm font-medium text-gray-900 mb-1">
                Volume Long
              </label>
              <input
                id="volumeLong"
                type="number"
                step="any"
                {...register('volumeLong', { valueAsNumber: true })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                type="number"
                step="any"
                {...register('volumeShort', { valueAsNumber: true })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {errors.volumeShort && <p className="text-red-600 text-sm mt-1">{errors.volumeShort.message}</p>}
            </div>

            <div>
              <label htmlFor="weight" className="block text-sm font-medium text-gray-900 mb-1">
                Weight
              </label>
              <input
                id="weight"
                type="number"
                step="any"
                {...register('weight', { valueAsNumber: true })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
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
              rows={4}
              {...register('description')}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      </fieldset>

      {/* Buttons */}
      <div className="flex gap-4">
        <button
          type="submit"
          disabled={!!barcodeError || isSaving}
          className="flex-1 px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
        >
          {isSaving ? 'Saving...' : 'Save'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={isSaving}
          className="flex-1 px-6 py-3 bg-gray-600 text-white font-medium rounded-lg hover:bg-gray-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
        >
          Cancel
        </button>
      </div>

      {/* Image */}
      <ProductImageSection
        imageUrl={productImage}
        onUpload={async (file) => {
          await onImageUpload(file);
          setProductImage(URL.createObjectURL(file));
        }}
        onDelete={async () => {
          await onImageDelete();
          setProductImage(null);
        }}
        isViewMode={false}
      />
    </form>
  );
}
