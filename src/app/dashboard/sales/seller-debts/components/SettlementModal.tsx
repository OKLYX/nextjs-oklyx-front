'use client';

import { useEffect, useMemo, useState } from 'react';
import { StockLotUseCase } from '@/application/usecases/StockLotUseCase';
import { StockLotRepositoryImpl } from '@/infrastructure/repositories/StockLotRepositoryImpl';
import type { SellerDebtPair } from '@/domain/entities/StockLotEntity';
import { toast } from '@/infrastructure/stores/toastStore';
import { extractErrorMessage } from '@/infrastructure/utils/errorMessage';
import { Button } from '@/presentation/components/ui/Button';
import { Modal } from '@/presentation/components/ui/Modal';

/**
 * [돈으로 정리] popup (FEATURE_2610_19 D90 · D99 ①): day · amount (1 won or more, no upper limit) · memo · the paying seller (one of
 * the pair; the other one received it). oclyx does not check it against the balance.
 */

const FORM_ID = 'settlement-form';
const INPUT_CLASS =
  'w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500';

// Local calendar day (YYYY-MM-DD) — toISOString (UTC) can be a day off in KST.
const today = () => {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
};

interface SettlementModalProps {
  /** The pair to settle; null = closed. */
  pair: SellerDebtPair | null;
  onClose: () => void;
  onSaved: () => void | Promise<void>;
}

export function SettlementModal({ pair, onClose, onSaved }: SettlementModalProps) {
  const useCase = useMemo(() => new StockLotUseCase(new StockLotRepositoryImpl()), []);
  const [payerId, setPayerId] = useState('');
  const [settledOn, setSettledOn] = useState(today());
  const [amount, setAmount] = useState('');
  const [memo, setMemo] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Every opening starts empty; the debtor is the first guess of who paid. Inline async IIFE defers setState past the
  // sync effect body (set-state-in-effect lint).
  useEffect(() => {
    if (!pair) return;
    void (async () => {
      setPayerId(pair.debtorId === null ? '' : String(pair.debtorId));
      setSettledOn(today());
      setAmount('');
      setMemo('');
      setError('');
    })();
  }, [pair]);

  if (!pair) return null;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    if (payerId === '') {
      setError('돈을 낸 판매자를 고르세요.');
      return;
    }
    const value = Number(amount);
    if (amount.trim() === '' || Number.isNaN(value) || value < 1) {
      setError('금액은 1원 이상이어야 합니다.');
      return;
    }
    const payer = Number(payerId);
    const receiver = payer === pair.sellerAId ? pair.sellerBId : pair.sellerAId;
    setIsSubmitting(true);
    try {
      await useCase.settle({
        payerSellerId: payer,
        receiverSellerId: receiver,
        settledOn,
        amount: value,
        ...(memo.trim() !== '' ? { memo: memo.trim() } : {}),
      });
      toast.success('돈 정리를 기록했습니다.');
      await onSaved();
    } catch (err) {
      setError(extractErrorMessage(err, '돈 정리를 기록하지 못했습니다.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen
      onClose={onClose}
      title="돈으로 정리"
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
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">돈을 낸 판매자</label>
          <select value={payerId} onChange={(e) => setPayerId(e.target.value)} className={INPUT_CLASS}>
            <option value="">선택</option>
            <option value={pair.sellerAId}>{pair.sellerAName}</option>
            <option value={pair.sellerBId}>{pair.sellerBName}</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">날짜</label>
          <input type="date" value={settledOn} onChange={(e) => setSettledOn(e.target.value)} className={INPUT_CLASS} />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">금액</label>
          <input
            type="text"
            inputMode="numeric"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className={INPUT_CLASS}
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">메모</label>
          <input value={memo} onChange={(e) => setMemo(e.target.value)} maxLength={500} className={INPUT_CLASS} />
        </div>
      </form>
    </Modal>
  );
}
