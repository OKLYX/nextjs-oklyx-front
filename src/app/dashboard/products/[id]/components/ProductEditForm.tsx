'use client';

import { useCallback, useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import type { Product } from '@/domain/entities/Product';
import type { UpdateProductRequest } from '@/domain/repositories/ProductRepository';
import { ProductImageSection } from './ProductImageSection';

interface ProductEditFormValues {
  productName: string;
  barcodeId: string;
  brand: string;
  price: string;
  store: string;
  unit: string;
  volumeHeight: string;
  volumeLong: string;
  volumeShort: string;
  weight: string;
  description: string;
}

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
    watch,
  } = useForm<ProductEditFormValues>({
    defaultValues: {
      productName: product.productName,
      barcodeId: product.barcodeId,
      brand: product.brand ?? '',
      price: product.price ? String(product.price) : '',
      store: product.store ?? '',
      unit: product.unit ?? '',
      volumeHeight: product.volumeHeight ? String(product.volumeHeight) : '',
      volumeLong: product.volumeLong ? String(product.volumeLong) : '',
      volumeShort: product.volumeShort ? String(product.volumeShort) : '',
      weight: product.weight ? String(product.weight) : '',
      description: product.description ?? '',
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
      setBarcodeError(exists ? 'Barcode already exists' : null);
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
    async (data: ProductEditFormValues) => {
      setIsSaving(true);
      try {
        const payload: UpdateProductRequest = {
          ...data,
          price: data.price ? Number(data.price) : null,
          volumeHeight: data.volumeHeight ? Number(data.volumeHeight) : null,
          volumeLong: data.volumeLong ? Number(data.volumeLong) : null,
          volumeShort: data.volumeShort ? Number(data.volumeShort) : null,
          weight: data.weight ? Number(data.weight) : null,
        };
        await onSave(payload);
      } catch {
        setIsSaving(false);
      }
    },
    [onSave]
  );

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="max-w-2xl space-y-8">
      <h1 className="text-3xl font-bold">Edit Product</h1>

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
              placeholder="Enter barcode ID"
              {...register('barcodeId')}
              onBlur={handleBarcodeBlur}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {barcodeError && <p className="text-red-600 text-sm mt-1">{barcodeError}</p>}
          </div>

          <div>
            <label htmlFor="productName" className="block text-sm font-medium text-gray-900 mb-1">
              Product Name
            </label>
            <input
              id="productName"
              type="text"
              placeholder="Enter product name"
              {...register('productName')}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      </fieldset>

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
                placeholder="Enter brand name"
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
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                placeholder="Enter price"
                {...register('price')}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="store" className="block text-sm font-medium text-gray-900 mb-1">
                Store
              </label>
              <select
                id="store"
                {...register('store')}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                {...register('unit')}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                placeholder="Enter volume height"
                {...register('volumeHeight')}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
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
                placeholder="Enter volume long"
                {...register('volumeLong')}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
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
                placeholder="Enter volume short"
                {...register('volumeShort')}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
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
                placeholder="Enter weight"
                {...register('weight')}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
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
              {...register('description')}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      </fieldset>

      <div className="flex gap-4">
        <button type="submit" disabled={!!barcodeError || isSaving} className="btn-primary">
          {isSaving ? 'Saving...' : 'Save'}
        </button>
        <button type="button" onClick={onCancel} className="btn-secondary">
          Cancel
        </button>
      </div>

      <ProductImageSection
        imageUrl={productImage}
        onUpload={async file => {
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