'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import axios from 'axios';
import { StockUseCase } from '@/application/usecases/StockUseCase';
import { StockRepositoryImpl } from '@/infrastructure/repositories/StockRepositoryImpl';
import type { CreateStockRequest } from '@/domain/repositories/StockRepository';

interface StockCardProps {
  barcodeId: string;
  productName: string;
}

export function StockCard({ barcodeId, productName }: StockCardProps) {
  const [inStock, setInStock] = useState<number | null>(null);
  const [isStockLoading, setIsStockLoading] = useState(true);
  const [stockError, setStockError] = useState<string | null>(null);
  const [stockType, setStockType] = useState<'IN' | 'OUT'>('IN');
  const [quantity, setQuantity] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState(false);

  const stockUseCase = useMemo(
    () => new StockUseCase(new StockRepositoryImpl()),
    []
  );

  const fetchStock = useCallback(async () => {
    setIsStockLoading(true);
    setStockError(null);
    try {
      const data = await stockUseCase.getCurrentStock(barcodeId);
      setInStock(data.inStock);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to load stock';
      setStockError(errorMessage);
    } finally {
      setIsStockLoading(false);
    }
  }, [barcodeId, stockUseCase]);

  useEffect(() => {
    fetchStock();
  }, [fetchStock]);

  const handleSubmit = useCallback(async () => {
    try {
      setIsSubmitting(true);
      setSubmitError(null);

      const payload: CreateStockRequest = {
        barcodeId,
        type: stockType,
        quantity: Number(quantity),
        name: productName,
      };

      await stockUseCase.createStock(payload);

      setQuantity('');
      setSubmitSuccess(true);

      const updated = await stockUseCase.getCurrentStock(barcodeId);
      setInStock(updated.inStock);

      setTimeout(() => setSubmitSuccess(false), 2000);
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 409) {
        setSubmitError('재고가 부족합니다');
      } else {
        setSubmitError('처리 중 오류가 발생했습니다');
      }
    } finally {
      setIsSubmitting(false);
    }
  }, [barcodeId, stockType, quantity, productName, stockUseCase]);

  const isQuantityValid = quantity && Number(quantity) >= 1;
  const isSubmitDisabled = isSubmitting || !isQuantityValid;

  return (
    <div className="border border-gray-200 rounded-lg p-6 bg-white">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">재고 관리</h2>

      {isStockLoading ? (
        <p className="text-gray-600">Loading...</p>
      ) : stockError ? (
        <p className="text-red-600 text-sm">{stockError}</p>
      ) : (
        <>
          <div className="mb-6 p-4 bg-gray-50 rounded-lg">
            <p className="text-sm text-gray-700">
              현재 재고: <span className="font-bold text-lg">{inStock}</span>
            </p>
          </div>

          <div className="space-y-4">
            <div className="flex gap-2">
              <button
                onClick={() => setStockType('IN')}
                className={`flex-1 py-2 px-4 rounded-lg font-medium transition-colors ${
                  stockType === 'IN'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                IN
              </button>
              <button
                onClick={() => setStockType('OUT')}
                className={`flex-1 py-2 px-4 rounded-lg font-medium transition-colors ${
                  stockType === 'OUT'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                OUT
              </button>
            </div>

            <input
              type="number"
              min="1"
              step="1"
              placeholder="수량 입력"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              disabled={isSubmitting}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50"
            />

            {submitError && (
              <p className="text-red-600 text-sm bg-red-50 p-3 rounded-lg">{submitError}</p>
            )}

            {submitSuccess && (
              <p className="text-green-600 text-sm bg-green-50 p-3 rounded-lg">
                재고가 성공적으로 처리되었습니다
              </p>
            )}

            <button
              onClick={handleSubmit}
              disabled={isSubmitDisabled}
              className="w-full py-2 px-4 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isSubmitting ? '처리 중...' : stockType === 'IN' ? '입고' : '출고'}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
