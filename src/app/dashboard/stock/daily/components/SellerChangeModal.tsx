'use client';

import { useEffect, useMemo, useState } from 'react';
import { StockLotUseCase } from '@/application/usecases/StockLotUseCase';
import { StockLotRepositoryImpl } from '@/infrastructure/repositories/StockLotRepositoryImpl';
import type { Seller } from '@/domain/entities/SellerEntity';
import { toast } from '@/infrastructure/stores/toastStore';
import { extractErrorMessage } from '@/infrastructure/utils/errorMessage';
import { Button } from '@/presentation/components/ui/Button';
import { Modal } from '@/presentation/components/ui/Modal';

/**
 * 「판매자 바꾸기」 popup of 「일별 입출고 내역」 (FEATURE_2611_01 D7 · D14 · D15).
 *
 * - Opened with the checked targets: incoming rows with a decided seller and no receipt (`movementIds`) and
 *   「영수증 없음」 shares of undecided intake rows (`shareRecordIds`). `labels` lists them as the screen shows them.
 * - One field: 「판매자」 (required — never back to 「미정」, FEATURE_2610_19 D116 ⑤). The server moves the purchase record,
 *   the stock rows and the rows that used them, and rewrites the debts (D6).
 */

const FORM_ID = 'seller-change-form';
const SELECT_CLASS =
  'w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500';

interface SellerChangeModalProps {
  isOpen: boolean;
  movementIds: number[];
  shareRecordIds: number[];
  /** One text per checked target, e.g. 「양말 2개 · A상사」. */
  labels: string[];
  sellers: Seller[];
  onClose: () => void;
  onSaved: () => void | Promise<void>;
}

export function SellerChangeModal({
  isOpen,
  movementIds,
  shareRecordIds,
  labels,
  sellers,
  onClose,
  onSaved,
}: SellerChangeModalProps) {
  const lotUseCase = useMemo(() => new StockLotUseCase(new StockLotRepositoryImpl()), []);
  const [sellerId, setSellerId] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Every opening starts empty. Inline async IIFE defers setState past the sync effect body (set-state-in-effect lint).
  useEffect(() => {
    if (!isOpen) return;
    void (async () => {
      setSellerId('');
      setError('');
    })();
  }, [isOpen]);

  if (!isOpen) return null;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    if (sellerId === '') {
      setError('판매자를 선택하세요.');
      return;
    }
    setIsSubmitting(true);
    try {
      await lotUseCase.changeSeller({ sellerId: Number(sellerId), movementIds, shareRecordIds });
      toast.success('판매자를 바꿨습니다.');
      await onSaved();
    } catch (err) {
      setError(extractErrorMessage(err, '판매자를 바꾸지 못했습니다.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen
      onClose={onClose}
      title="판매자 바꾸기"
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
      <form id={FORM_ID} onSubmit={(e) => void submit(e)} className="space-y-4">
        {error && <div className="p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">{error}</div>}
        <ul className="space-y-1 text-sm text-gray-700">
          {labels.map((label, index) => (
            <li key={index}>{label}</li>
          ))}
        </ul>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">판매자</label>
          <select
            value={sellerId}
            onChange={(e) => setSellerId(e.target.value)}
            disabled={isSubmitting}
            className={SELECT_CLASS}
          >
            <option value="">선택</option>
            {sellers.map((seller) => (
              <option key={seller.id} value={seller.id}>
                {seller.sellerName}
              </option>
            ))}
          </select>
        </div>
      </form>
    </Modal>
  );
}
