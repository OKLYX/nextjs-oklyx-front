'use client';

import { useEffect, useMemo, useState } from 'react';
import { StockLotUseCase } from '@/application/usecases/StockLotUseCase';
import { StockLotRepositoryImpl } from '@/infrastructure/repositories/StockLotRepositoryImpl';
import type { SellerDebtEntry } from '@/domain/entities/StockLotEntity';
import { toast } from '@/infrastructure/stores/toastStore';
import { extractErrorMessage } from '@/infrastructure/utils/errorMessage';
import { Button } from '@/presentation/components/ui/Button';
import { Modal } from '@/presentation/components/ui/Modal';

/**
 * [단가 입력] · [단가 수정] popup (FEATURE_2610_19 D141 · D143 · D144 ~ D146): one purchase unit price, 0 or more,
 * never empty. The server writes it into the lot behind the debt, rewrites the debts and decides the registered price.
 */

const FORM_ID = 'unit-price-form';

interface UnitPriceModalProps {
  /** The debt row; null = closed. */
  entry: SellerDebtEntry | null;
  onClose: () => void;
  onSaved: () => void | Promise<void>;
}

export function UnitPriceModal({ entry, onClose, onSaved }: UnitPriceModalProps) {
  const useCase = useMemo(() => new StockLotUseCase(new StockLotRepositoryImpl()), []);
  const [value, setValue] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Inline async IIFE defers setState past the sync effect body (set-state-in-effect lint).
  useEffect(() => {
    if (!entry) return;
    void (async () => {
      setValue(entry.unitPrice === null ? '' : String(entry.unitPrice));
      setError('');
    })();
  }, [entry]);

  if (!entry) return null;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const price = Number(value);
    if (value.trim() === '' || Number.isNaN(price) || price < 0) {
      setError('단가는 0 이상의 숫자여야 합니다.');
      return;
    }
    setIsSubmitting(true);
    try {
      await useCase.fillUnitPrice(entry.id, price);
      toast.success('매입 단가를 저장했습니다.');
      await onSaved();
    } catch (err) {
      setError(extractErrorMessage(err, '매입 단가를 저장하지 못했습니다.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={entry.canFillPrice ? '단가 입력' : '단가 수정'}
      disableClose={isSubmitting}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
            취소
          </Button>
          <Button type="submit" form={FORM_ID} isLoading={isSubmitting} loadingText="저장 중...">
            저장
          </Button>
        </>
      }
    >
      <form id={FORM_ID} onSubmit={(e) => void submit(e)} className="space-y-3">
        {error && <div className="p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">{error}</div>}
        <p className="text-sm text-gray-700">
          {entry.productName} · 주문 {entry.orderNumber ?? '-'} · {entry.quantity}개
        </p>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">매입 단가</label>
          <div className="flex items-center gap-1">
            <input
              type="text"
              inputMode="decimal"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              className="w-40 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <span className="text-sm text-gray-500">원</span>
          </div>
        </div>
      </form>
    </Modal>
  );
}
