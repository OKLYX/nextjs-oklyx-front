'use client';

import { useState, RefObject } from 'react';
import { PopupDialogModal } from '@/presentation/components/PopupDialogModal';

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
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [tempQuantity, setTempQuantity] = useState(0);
  const [deleteConfirm, setDeleteConfirm] = useState<{
    itemId: string;
    productName: string;
  } | null>(null);

  const handleEditStart = (item: StockInOutItem) => {
    setEditingItemId(item.id);
    setTempQuantity(item.quantity);
  };

  const handleEditConfirm = (item: StockInOutItem) => {
    let newQuantity = tempQuantity;
    if (newQuantity < 1) newQuantity = 1;
    if (stockType === 'OUT' && newQuantity > item.currentStock) {
      newQuantity = item.currentStock;
    }
    onUpdateQuantity(item.id, newQuantity);
    setEditingItemId(null);
    barcodeInputRef.current?.focus();
  };

  const handleEditCancel = () => {
    setEditingItemId(null);
    barcodeInputRef.current?.focus();
  };

  const handleDeleteClick = (item: StockInOutItem) => {
    setDeleteConfirm({
      itemId: item.id,
      productName: item.productName,
    });
  };

  const handleConfirmDelete = () => {
    if (deleteConfirm) {
      onDeleteItem(deleteConfirm.itemId);
      setDeleteConfirm(null);
      barcodeInputRef.current?.focus();
    }
  };

  const handleCancelDelete = () => {
    setDeleteConfirm(null);
  };

  const submitButtonLabel = stockType === 'IN' ? '입고 처리' : '출고 처리';
  const successMessage =
    stockType === 'IN' ? '입고가 완료되었습니다' : '출고가 완료되었습니다';

  return (
    <div className="p-6 space-y-4">
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
                    {editingItemId === item.id ? (
                      <div className="flex gap-1">
                        <input
                          type="number"
                          min="1"
                          value={tempQuantity}
                          onChange={(e) =>
                            setTempQuantity(parseInt(e.target.value) || 1)
                          }
                          className="w-16 px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                          autoFocus
                        />
                        <button
                          onClick={() => handleEditConfirm(item)}
                          className="px-2 py-1 bg-blue-500 text-white text-xs rounded hover:bg-blue-600"
                        >
                          완료
                        </button>
                        <button
                          onClick={handleEditCancel}
                          className="px-2 py-1 bg-gray-400 text-white text-xs rounded hover:bg-gray-500"
                        >
                          취소
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <span className="text-sm">{item.quantity}</span>
                        <button
                          onClick={() => handleEditStart(item)}
                          className="px-2 py-1 bg-gray-200 text-gray-700 text-xs rounded hover:bg-gray-300"
                        >
                          수정
                        </button>
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => handleDeleteClick(item)}
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

      <PopupDialogModal
        isOpen={deleteConfirm !== null}
        title="상품 삭제 확인"
        message={
          deleteConfirm ? (
            <>
              <span className="font-semibold">{deleteConfirm.productName}</span>
              을(를) {stockType === 'IN' ? '입고' : '출고'} 목록에서 제거하시겠습니까?
            </>
          ) : null
        }
        confirmText="삭제"
        cancelText="취소"
        onConfirm={handleConfirmDelete}
        onCancel={handleCancelDelete}
        isDangerous
      />
    </div>
  );
}
