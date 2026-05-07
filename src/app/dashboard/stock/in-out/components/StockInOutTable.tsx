'use client';

import { RefObject } from 'react';

interface StockInOutItem {
  id: string;
  barcodeId: string;
  productName: string;
  currentStock: number;
  quantity: number;
}

interface StockInOutTableProps {
  items: StockInOutItem[];
  stockType: 'IN' | 'OUT';
  isSubmitting: boolean;
  submitError: string | null;
  submitSuccess: boolean;
  onUpdateQuantity: (id: string, quantity: number) => void;
  onDeleteItem: (id: string) => void;
  onSubmit: () => void;
  barcodeInputRef: RefObject<HTMLInputElement | null>;
}

export function StockInOutTable({
  items,
  stockType,
  isSubmitting,
  submitError,
  submitSuccess,
  onUpdateQuantity,
  onDeleteItem,
  onSubmit,
  barcodeInputRef,
}: StockInOutTableProps) {
  const handleQuantityKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === 'Escape') {
      barcodeInputRef.current?.focus();
    }
  };

  const handleDeleteClick = (id: string) => {
    onDeleteItem(id);
    barcodeInputRef.current?.focus();
  };

  const handleQuantityBlur = () => {
    barcodeInputRef.current?.focus();
  };

  const submitButtonLabel = stockType === 'IN' ? '입고 처리' : '출고 처리';
  const successMessage =
    stockType === 'IN' ? '입고가 완료되었습니다' : '출고가 완료되었습니다';

  return (
    <div className="p-6 space-y-4">
      {submitError && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-600 text-sm">
          {submitError}
        </div>
      )}

      {submitSuccess && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-green-600 text-sm">
          {successMessage}
        </div>
      )}

      {items.length === 0 ? (
        <p className="text-center text-gray-500 py-8">
          스캔하거나 바코드를 입력하세요
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left px-4 py-3 font-semibold text-gray-900">
                  바코드
                </th>
                <th className="text-left px-4 py-3 font-semibold text-gray-900">
                  상품명
                </th>
                <th className="text-left px-4 py-3 font-semibold text-gray-900">
                  현재재고
                </th>
                <th className="text-left px-4 py-3 font-semibold text-gray-900">
                  수량
                </th>
                <th className="text-left px-4 py-3 font-semibold text-gray-900">
                  삭제
                </th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className="border-b border-gray-200">
                  <td className="px-4 py-3 text-sm text-gray-700">
                    {item.barcodeId}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700">
                    {item.productName}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700">
                    {item.currentStock}
                  </td>
                  <td className="px-4 py-3">
                    <input
                      type="number"
                      min="1"
                      step="1"
                      value={item.quantity}
                      onChange={(e) =>
                        onUpdateQuantity(item.id, parseInt(e.target.value) || 1)
                      }
                      onKeyDown={handleQuantityKeyDown}
                      onBlur={handleQuantityBlur}
                      className="w-20 px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => handleDeleteClick(item.id)}
                      className="text-red-600 hover:text-red-800 font-semibold"
                    >
                      [x]
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <button
        onClick={onSubmit}
        disabled={items.length === 0 || isSubmitting}
        className="w-full px-4 py-3 bg-blue-500 text-white font-semibold rounded-lg hover:bg-blue-600 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
      >
        {isSubmitting ? '처리 중...' : submitButtonLabel}
      </button>
    </div>
  );
}
