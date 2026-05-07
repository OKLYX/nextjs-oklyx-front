'use client';

import { useState, useEffect, RefObject } from 'react';
import { axiosInstance } from '@/infrastructure/api/axiosInstance';

interface StockInOutFormProps {
  stockType: 'IN' | 'OUT';
  onTypeChange: (type: 'IN' | 'OUT') => void;
  onAddItem: (barcodeId: string, productName: string, currentStock: number) => void;
  barcodeInputRef: RefObject<HTMLInputElement | null>;
  submitError: string | null;
}

export function StockInOutForm({
  stockType,
  onTypeChange,
  onAddItem,
  barcodeInputRef,
  submitError,
}: StockInOutFormProps) {
  const [barcodeInput, setBarcodeInput] = useState('');
  const [isLookingUp, setIsLookingUp] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);

  useEffect(() => {
    if (!isLookingUp) {
      barcodeInputRef.current?.focus();
    }
  }, [isLookingUp, barcodeInputRef]);

  const handleTypeChange = (type: 'IN' | 'OUT') => {
    onTypeChange(type);
    setBarcodeInput('');
    setLookupError(null);
    barcodeInputRef.current?.focus();
  };

  const handleBarcodeKeyDown = async (
    e: React.KeyboardEvent<HTMLInputElement>
  ) => {
    if (e.key !== 'Enter') return;

    if (!barcodeInput.trim()) {
      setLookupError('바코드를 입력하세요');
      return;
    }

    try {
      setIsLookingUp(true);
      setLookupError(null);
      const response = await axiosInstance.get(`/api/stock/${barcodeInput}`);
      const stockData = response.data.data;

      onAddItem(
        stockData.barcodeId,
        stockData.productName || '알 수 없는 상품',
        stockData.inStock
      );
      setBarcodeInput('');
    } catch {
      setLookupError('상품을 찾을 수 없습니다');
    } finally {
      setIsLookingUp(false);
    }
  };

  return (
    <div className="p-6 space-y-4">
      <div className="flex gap-2">
        <button
          onClick={() => handleTypeChange('IN')}
          className={`flex-1 px-4 py-2 rounded-lg font-semibold transition-colors ${
            stockType === 'IN'
              ? 'bg-blue-500 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          입고
        </button>
        <button
          onClick={() => handleTypeChange('OUT')}
          className={`flex-1 px-4 py-2 rounded-lg font-semibold transition-colors ${
            stockType === 'OUT'
              ? 'bg-blue-500 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          출고
        </button>
      </div>

      <div>
        <input
          ref={barcodeInputRef}
          type="text"
          value={barcodeInput}
          onChange={(e) => setBarcodeInput(e.target.value)}
          onKeyDown={handleBarcodeKeyDown}
          placeholder="바코드를 입력하세요"
          disabled={isLookingUp}
          autoFocus
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
        />
        <div className="mt-3 space-y-2 text-sm">
          <div className="text-gray-600">
            Status: {isLookingUp ? <span className="text-blue-600 font-semibold">Loading...</span> : <span className="text-gray-400">-</span>}
          </div>
          <div className="text-gray-600 min-h-5">
            Message: {submitError || lookupError ? <span className="text-red-600 font-semibold">{submitError || lookupError}</span> : <span className="text-gray-400">-</span>}
          </div>
        </div>
      </div>
    </div>
  );
}
