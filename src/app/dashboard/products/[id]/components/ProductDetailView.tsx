'use client';

import { useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ROUTES } from '@/config/routes';
import type { Product } from '@/domain/entities/Product';
import { ProductImageSection } from './ProductImageSection';

interface ProductDetailViewProps {
  product: Product;
  onDelete: () => Promise<void>;
  onImageUpload: (file: File) => Promise<void>;
  onImageDelete: () => Promise<void>;
}

export function ProductDetailView({ product, onDelete, onImageUpload, onImageDelete }: ProductDetailViewProps) {
  const router = useRouter();
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDeleteConfirm = useCallback(async () => {
    setIsDeleting(true);
    try {
      await onDelete();
      router.push(ROUTES.PRODUCTS_RETRIEVE);
    } catch {
      setIsDeleting(false);
      setShowDeleteConfirmation(false);
    }
  }, [onDelete, router]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Product Details</h1>
        <div className="flex gap-2">
          <button
            onClick={() => router.push(ROUTES.PRODUCT_EDIT(product.id))}
            className="px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
          >
            Edit
          </button>
          <button
            onClick={() => setShowDeleteConfirmation(true)}
            className="px-4 py-2 bg-red-600 text-white font-medium rounded-lg hover:bg-red-700 transition-colors"
          >
            Delete
          </button>
        </div>
      </div>

      {/* Product Details */}
      <div className="grid grid-cols-2 gap-6">
        <div className="border border-gray-200 rounded-lg p-6 bg-white">
          <div className="space-y-4">
            <div>
              <p className="text-sm text-gray-600">Product Name</p>
              <p className="text-lg font-semibold text-gray-900">{product.productName}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Barcode ID</p>
              <p className="text-lg font-semibold text-gray-900">{product.barcodeId}</p>
            </div>
            {product.brand && (
              <div>
                <p className="text-sm text-gray-600">Brand</p>
                <p className="text-lg font-semibold text-gray-900">{product.brand}</p>
              </div>
            )}
            {product.price && (
              <div>
                <p className="text-sm text-gray-600">Price</p>
                <p className="text-lg font-semibold text-gray-900">${product.price}</p>
              </div>
            )}
            {product.store && (
              <div>
                <p className="text-sm text-gray-600">Store</p>
                <p className="text-lg font-semibold text-gray-900">{product.store}</p>
              </div>
            )}
            {product.unit && (
              <div>
                <p className="text-sm text-gray-600">Unit</p>
                <p className="text-lg font-semibold text-gray-900">{product.unit}</p>
              </div>
            )}
          </div>
        </div>

        <div className="border border-gray-200 rounded-lg p-6 bg-white">
          <div className="space-y-4">
            {product.volumeHeight && (
              <div>
                <p className="text-sm text-gray-600">Volume Height</p>
                <p className="text-lg font-semibold text-gray-900">{product.volumeHeight}</p>
              </div>
            )}
            {product.volumeLong && (
              <div>
                <p className="text-sm text-gray-600">Volume Long</p>
                <p className="text-lg font-semibold text-gray-900">{product.volumeLong}</p>
              </div>
            )}
            {product.volumeShort && (
              <div>
                <p className="text-sm text-gray-600">Volume Short</p>
                <p className="text-lg font-semibold text-gray-900">{product.volumeShort}</p>
              </div>
            )}
            {product.weight && (
              <div>
                <p className="text-sm text-gray-600">Weight</p>
                <p className="text-lg font-semibold text-gray-900">{product.weight}</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Description */}
      {product.description && (
        <div className="border border-gray-200 rounded-lg p-6 bg-white">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Description</h2>
          <p className="text-gray-700 whitespace-pre-wrap">{product.description}</p>
        </div>
      )}

      {/* Image */}
      <ProductImageSection imageUrl={product.imageUrl || null} onUpload={onImageUpload} onDelete={onImageDelete} isViewMode={false} />

      {/* Delete Confirmation Dialog */}
      {showDeleteConfirmation && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-8 max-w-md w-full mx-4 shadow-lg">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Confirm Delete</h2>
            <p className="text-gray-600 mb-8">
              Are you sure you want to delete this product? This action cannot be undone.
            </p>
            <div className="flex gap-4">
              <button
                onClick={() => setShowDeleteConfirmation(false)}
                disabled={isDeleting}
                className="flex-1 px-4 py-2 bg-gray-600 text-white font-medium rounded-lg hover:bg-gray-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteConfirm}
                disabled={isDeleting}
                className="flex-1 px-4 py-2 bg-red-600 text-white font-medium rounded-lg hover:bg-red-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                {isDeleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
