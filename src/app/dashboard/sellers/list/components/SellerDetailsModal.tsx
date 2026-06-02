'use client';

import { useEffect, useState, useMemo } from 'react';
import { SellerRepositoryImpl } from '@/infrastructure/repositories/SellerRepositoryImpl';
import { SellerUseCase } from '@/application/usecases/SellerUseCase';
import type { Seller } from '@/domain/entities/SellerEntity';

interface SellerDetailsModalProps {
  isOpen: boolean;
  sellerId: number | null;
  onClose: () => void;
}

export function SellerDetailsModal({
  isOpen,
  sellerId,
  onClose,
}: SellerDetailsModalProps) {
  const [seller, setSeller] = useState<Seller | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const sellerUseCase = useMemo(() => {
    const repository = new SellerRepositoryImpl();
    return new SellerUseCase(repository);
  }, []);

  useEffect(() => {
    if (!isOpen || !sellerId) return;

    const fetchSeller = async () => {
      try {
        setIsLoading(true);
        setError('');
        setSeller(null);
        const result = await sellerUseCase.getById(sellerId);
        setSeller(result);
      } catch {
        setError('판매자 정보를 찾을 수 없습니다');
      } finally {
        setIsLoading(false);
      }
    };

    fetchSeller();
  }, [isOpen, sellerId, sellerUseCase]);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isLoading) {
        onClose();
      }
    };

    if (isOpen) {
      window.addEventListener('keydown', handleEsc);
      return () => window.removeEventListener('keydown', handleEsc);
    }
  }, [isOpen, isLoading, onClose]);

  if (!isOpen) {
    return null;
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toISOString().split('T')[0];
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-lg shadow-lg max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b px-6 py-4 flex justify-between items-center">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">판매자 정보</h2>
            {seller && <p className="text-xs text-gray-500 mt-1">ID: {seller.id}</p>}
          </div>
          <button
            onClick={onClose}
            disabled={isLoading}
            className="text-gray-500 hover:text-gray-700 disabled:opacity-50"
          >
            ✕
          </button>
        </div>

        {isLoading && (
          <div className="p-6 space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i}>
                <div className="h-4 bg-gray-200 rounded w-24 animate-pulse mb-2"></div>
                <div className="h-6 bg-gray-200 rounded animate-pulse"></div>
              </div>
            ))}
          </div>
        )}

        {error && !isLoading && (
          <div className="mx-6 mt-4 p-3 bg-red-50 border border-red-200 rounded text-sm text-red-800">
            {error}
          </div>
        )}

        {seller && !isLoading && (
          <div className="p-6 space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                판매자명
              </label>
              <p className="text-sm text-gray-900">{seller.sellerName}</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                사업자등록번호
              </label>
              <p className="text-sm text-gray-900">{seller.businessRegistration}</p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                등록일
              </label>
              <p className="text-sm text-gray-900">{formatDate(seller.createdAt)}</p>
            </div>

            {seller.updatedAt && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  수정일
                </label>
                <p className="text-sm text-gray-900">{formatDate(seller.updatedAt)}</p>
              </div>
            )}
          </div>
        )}

        <div className="border-t p-6">
          <button
            onClick={onClose}
            disabled={isLoading}
            className="w-full px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 disabled:opacity-50 transition-colors text-sm font-medium"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}
