'use client';

import { useRef } from 'react';
import { getImageUrl } from '@/infrastructure/utils/imageUrl';

interface ProductImageSectionProps {
  imageUrl: string | null;
  onUpload?: (file: File) => Promise<void>;
  onDelete?: () => Promise<void>;
  isViewMode: boolean;
}

export function ProductImageSection({ imageUrl, onUpload, onDelete, isViewMode }: ProductImageSectionProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && onUpload) {
      await onUpload(file);
    }
  };

  return (
    <div className="border border-gray-200 rounded-lg p-6 bg-white">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">Product Image</h2>
      {imageUrl ? (
        <div className="space-y-4">
          <img src={getImageUrl(imageUrl) || imageUrl} alt="Product" className="max-h-96 rounded-lg border border-gray-300" />
          {!isViewMode && onDelete && (
            <button
              type="button"
              onClick={onDelete}
              className="w-full px-4 py-2 bg-red-600 text-white font-medium rounded-lg hover:bg-red-700 transition-colors"
            >
              Delete Image
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="w-full aspect-video bg-gray-100 rounded-lg border border-gray-300 flex items-center justify-center">
            <p className="text-gray-500">No Image</p>
          </div>
          {!isViewMode && (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="w-full px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
            >
              Upload Image
            </button>
          )}
        </div>
      )}
      {!isViewMode && (
        <input ref={fileInputRef} type="file" accept="image/jpeg,image/png" onChange={handleImageSelect} hidden />
      )}
    </div>
  );
}
