'use client';

import { useState, useRef, useMemo } from 'react';
import axios from 'axios';
import { StockRepositoryImpl } from '@/infrastructure/repositories/StockRepositoryImpl';
import { StockUseCase } from '@/application/usecases/StockUseCase';
import { StockInOutForm } from './StockInOutForm';
import { StockInOutTable } from './StockInOutTable';

interface StockInOutItem {
  id: string;
  barcodeId: string;
  productName: string;
  currentStock: number;
  quantity: number;
}

export function StockInOutContainer() {
  const [stockType, setStockType] = useState<'IN' | 'OUT'>('IN');
  const [items, setItems] = useState<StockInOutItem[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState(false);

  const barcodeInputRef = useRef<HTMLInputElement | null>(null);

  const stockUseCase = useMemo(() => {
    const repository = new StockRepositoryImpl();
    return new StockUseCase(repository);
  }, []);

  const handleAddItem = (
    barcodeId: string,
    productName: string,
    currentStock: number
  ) => {
    const existing = items.find((item) => item.barcodeId === barcodeId);
    if (existing) {
      setItems((prev) =>
        prev.map((item) =>
          item.barcodeId === barcodeId
            ? { ...item, quantity: item.quantity + 1 }
            : item
        )
      );
    } else {
      setItems((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          barcodeId,
          productName,
          currentStock,
          quantity: 1,
        },
      ]);
    }
  };

  const handleUpdateQuantity = (id: string, quantity: number) => {
    if (quantity < 1) return;
    setItems((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, quantity } : item
      )
    );
  };

  const handleDeleteItem = (id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
  };

  const handleTypeChange = (type: 'IN' | 'OUT') => {
    setStockType(type);
    setItems([]);
  };

  const handleSubmit = async () => {
    try {
      setIsSubmitting(true);
      setSubmitError(null);
      await stockUseCase.createBatchStock({
        type: stockType,
        items: items.map((item) => ({
          barcodeId: item.barcodeId,
          quantity: item.quantity,
          name: item.productName,
        })),
      });
      setItems([]);
      setSubmitSuccess(true);
      setTimeout(() => setSubmitSuccess(false), 3000);
      barcodeInputRef.current?.focus();
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 409) {
        setSubmitError('재고가 부족합니다. 수량을 확인해주세요.');
      } else {
        setSubmitError('처리 중 오류가 발생했습니다.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="bg-white rounded-lg shadow">
        <StockInOutForm
          stockType={stockType}
          onTypeChange={handleTypeChange}
          onAddItem={handleAddItem}
          barcodeInputRef={barcodeInputRef}
        />
      </div>

      <div className="bg-white rounded-lg shadow">
        <StockInOutTable
          items={items}
          stockType={stockType}
          isSubmitting={isSubmitting}
          submitError={submitError}
          submitSuccess={submitSuccess}
          onUpdateQuantity={handleUpdateQuantity}
          onDeleteItem={handleDeleteItem}
          onSubmit={handleSubmit}
          barcodeInputRef={barcodeInputRef}
        />
      </div>
    </div>
  );
}
