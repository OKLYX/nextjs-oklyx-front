'use client';

import { useState, RefObject } from 'react';
import { axiosInstance } from '@/infrastructure/api/axiosInstance';

interface StockInOutFormProps {
  stockType: 'IN' | 'OUT';
  onTypeChange: (type: 'IN' | 'OUT') => void;
  onAddItem: (barcodeId: string, productName: string, currentStock: number) => void;
  barcodeInputRef: RefObject<HTMLInputElement | null>;
}

export function StockInOutForm({
  stockType,
  onTypeChange,
  onAddItem,
  barcodeInputRef,
}: StockInOutFormProps) {
  const [barcodeInput, setBarcodeInput] = useState('');
  const [isLookingUp, setIsLookingUp] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);

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
      barcodeInputRef.current?.focus();
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
        {isLookingUp && <p className="mt-2 text-gray-500">Loading...</p>}
        {lookupError && (
          <p className="mt-2 text-red-600 text-sm">{lookupError}</p>
        )}
      </div>
    </div>
  );
}
