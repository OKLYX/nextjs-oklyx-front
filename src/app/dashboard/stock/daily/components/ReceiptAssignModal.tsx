'use client';

import { useEffect, useMemo, useState } from 'react';
import { StockLotUseCase } from '@/application/usecases/StockLotUseCase';
import { StockLotRepositoryImpl } from '@/infrastructure/repositories/StockLotRepositoryImpl';
import { SellerCardRepositoryImpl } from '@/infrastructure/repositories/SellerCardRepositoryImpl';
import { SellerCardUseCase } from '@/application/usecases/SellerCardUseCase';
import type { Seller } from '@/domain/entities/SellerEntity';
import type { SellerCard } from '@/domain/entities/SellerCardEntity';
import type { UnregisteredProduct } from '@/domain/entities/StockLotEntity';
import type { CreateReceiptRequest } from '@/application/dto/PurchaseReceiptDTOs';
import { toast } from '@/infrastructure/stores/toastStore';
import { extractErrorMessage } from '@/infrastructure/utils/errorMessage';
import { Button } from '@/presentation/components/ui/Button';
import { Modal } from '@/presentation/components/ui/Modal';

/**
 * Receipt assignment popup of 「그날 입출고 내역」 (FEATURE_2610_19 D118 · D121 · D87 · D135).
 *
 * - Photo (required, D121 ⑦) · 「결제 카드」 = visible cards + 「카드로 알 수 없음」 (then 「결제 판매자」) · 「구매일」 (first = the
 *   screen day). The card fields follow the receipt check-in popup (`ReceiptIntakeModal`).
 * - Every undecided product of the screen day with its 「남은 미등록 수량」; the person types how many this receipt
 *   covers (0 = not on this receipt, more than left is refused, D121 ①) and the amount (total or unit, blank = the
 *   registered price, D135) and the base price checkbox.
 * - Saved assignments are not edited here (D121 ⑧) — the receipt header is edited from the receipt list (D100).
 */

const FORM_ID = 'receipt-assign-form';
const UNKNOWN_CARD = 'UNKNOWN';
const SELECT_CLASS =
  'w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500';
const INPUT_CLASS =
  'px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500';

interface LineState {
  quantity: string;
  amountMode: 'TOTAL' | 'UNIT';
  amount: string;
  reflectToBasePrice: boolean;
}

interface ReceiptAssignModalProps {
  isOpen: boolean;
  /** The screen day — only that day's undecided intake can be assigned (D121 ⑥). */
  date: string;
  products: UnregisteredProduct[];
  sellers: Seller[];
  onClose: () => void;
  onSaved: () => void | Promise<void>;
}

export function ReceiptAssignModal({ isOpen, date, products, sellers, onClose, onSaved }: ReceiptAssignModalProps) {
  const lotUseCase = useMemo(() => new StockLotUseCase(new StockLotRepositoryImpl()), []);
  const cardUseCase = useMemo(() => new SellerCardUseCase(new SellerCardRepositoryImpl()), []);

  const [cards, setCards] = useState<SellerCard[]>([]);
  const [cardChoice, setCardChoice] = useState('');
  const [payerSellerId, setPayerSellerId] = useState('');
  const [purchasedOn, setPurchasedOn] = useState(date);
  const [photo, setPhoto] = useState<File | null>(null);
  const [lines, setLines] = useState<Record<number, LineState>>({});
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Every opening starts empty and reloads the cards. Inline async IIFE defers setState past the sync effect body
  // (set-state-in-effect lint).
  useEffect(() => {
    if (!isOpen) return;
    void (async () => {
      setCardChoice('');
      setPayerSellerId('');
      setPurchasedOn(date);
      setPhoto(null);
      setError('');
      setLines(
        Object.fromEntries(
          products.map((p) => [p.productId, { quantity: '0', amountMode: 'TOTAL', amount: '', reflectToBasePrice: true }])
        )
      );
      try {
        setCards(await cardUseCase.getVisible());
      } catch {
        setCards([]);
      }
    })();
  }, [isOpen, date, products, cardUseCase]);

  if (!isOpen) return null;

  const setLine = (productId: number, patch: Partial<LineState>) =>
    setLines((prev) => ({ ...prev, [productId]: { ...prev[productId], ...patch } }));

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    if (!photo) {
      setError('영수증 사진을 올리세요.');
      return;
    }
    let payer: Pick<CreateReceiptRequest, 'cardId' | 'payerSellerId'>;
    if (cardChoice === '') {
      setError('결제 카드를 고르세요.');
      return;
    } else if (cardChoice === UNKNOWN_CARD) {
      if (payerSellerId === '') {
        setError('결제 판매자를 선택하세요.');
        return;
      }
      payer = { payerSellerId: Number(payerSellerId) };
    } else {
      payer = { cardId: Number(cardChoice) };
    }
    const picked = products.filter((p) => Number(lines[p.productId]?.quantity ?? '0') > 0);
    if (picked.length === 0) {
      setError('이 영수증으로 처리한 상품의 개수를 입력하세요.');
      return;
    }
    for (const p of products) {
      const qty = Number(lines[p.productId]?.quantity ?? '0');
      if (!Number.isInteger(qty) || qty < 0) {
        setError('개수는 0 이상 정수만 입력할 수 있습니다.');
        return;
      }
      if (qty > p.remainingQty) {
        setError(`${p.productName}: 남은 영수증 미등록 수량(${p.remainingQty}개)보다 많습니다.`);
        return;
      }
    }
    const request: CreateReceiptRequest = {
      purchasedOn,
      ...payer,
      lines: picked.map((p) => {
        const line = lines[p.productId];
        // Only one of total/unit travels; blank = no key (the server fills the registered price, D135).
        const amount = line.amount.trim() === '' ? undefined : Number(line.amount);
        return {
          productId: p.productId,
          quantity: Number(line.quantity),
          ...(amount !== undefined && line.amountMode === 'TOTAL' ? { totalAmount: amount } : {}),
          ...(amount !== undefined && line.amountMode === 'UNIT' ? { unitPrice: amount } : {}),
          reflectToBasePrice: line.reflectToBasePrice,
        };
      }),
    };
    setIsSubmitting(true);
    try {
      await lotUseCase.assign(date, photo, request);
      toast.success('영수증을 배정했습니다.');
      await onSaved();
    } catch (err) {
      setError(extractErrorMessage(err, '영수증을 배정하지 못했습니다.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const pickedCard = cards.find((card) => String(card.id) === cardChoice) ?? null;

  return (
    <Modal
      isOpen
      onClose={onClose}
      title="영수증 올리기"
      disableClose={isSubmitting}
      // The typed quantities live in component state, not in a DOM form value — tell the modal directly.
      isDirty={photo !== null || Object.values(lines).some((l) => l.quantity !== '0' || l.amount !== '')}
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
          <label className="block text-sm font-medium text-gray-700 mb-1">영수증 사진</label>
          <input
            type="file"
            accept="image/jpeg,image/png"
            disabled={isSubmitting}
            onChange={(e) => setPhoto(e.target.files?.[0] ?? null)}
            className="block w-full text-sm text-gray-700"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">결제 카드</label>
          <select
            value={cardChoice}
            onChange={(e) => setCardChoice(e.target.value)}
            disabled={isSubmitting}
            className={SELECT_CLASS}
          >
            <option value="">선택</option>
            {cards.map((card) => (
              <option key={card.id} value={card.id}>
                {card.sellerName} · {card.alias} ({card.maskedNumber})
              </option>
            ))}
            <option value={UNKNOWN_CARD}>카드로 알 수 없음</option>
          </select>
          {pickedCard && <p className="mt-1 text-xs text-gray-500">결제 판매자: {pickedCard.sellerName}</p>}
        </div>

        {cardChoice === UNKNOWN_CARD && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">결제 판매자</label>
            <select
              value={payerSellerId}
              onChange={(e) => setPayerSellerId(e.target.value)}
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
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">구매일</label>
          <input
            type="date"
            value={purchasedOn}
            onChange={(e) => setPurchasedOn(e.target.value)}
            disabled={isSubmitting}
            className={INPUT_CLASS}
          />
        </div>

        <div className="space-y-3">
          <p className="text-sm font-medium text-gray-700">이 영수증으로 처리한 상품</p>
          {products.map((p) => {
            const line = lines[p.productId];
            if (!line) return null;
            return (
              <div key={p.productId} className="border border-gray-200 rounded-lg p-3 space-y-2">
                <p className="text-sm text-gray-900">
                  {p.productName} <span className="text-gray-500">(남은 미등록 {p.remainingQty}개)</span>
                </p>
                <div className="flex flex-wrap items-end gap-2">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">개수</label>
                    <input
                      type="number"
                      min={0}
                      max={p.remainingQty}
                      value={line.quantity}
                      onChange={(e) => setLine(p.productId, { quantity: e.target.value })}
                      disabled={isSubmitting}
                      className={`${INPUT_CLASS} w-24`}
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">금액 기준</label>
                    <select
                      value={line.amountMode}
                      onChange={(e) => setLine(p.productId, { amountMode: e.target.value as 'TOTAL' | 'UNIT' })}
                      disabled={isSubmitting}
                      className={INPUT_CLASS}
                    >
                      <option value="TOTAL">총액</option>
                      <option value="UNIT">단가</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">{line.amountMode === 'UNIT' ? '단가' : '총액'}</label>
                    <input
                      type="text"
                      inputMode="decimal"
                      placeholder="모르면 비움"
                      value={line.amount}
                      onChange={(e) => setLine(p.productId, { amount: e.target.value })}
                      disabled={isSubmitting}
                      className={`${INPUT_CLASS} w-32`}
                    />
                  </div>
                </div>
                <label className="flex items-center gap-2 text-xs text-gray-600">
                  <input
                    type="checkbox"
                    checked={line.reflectToBasePrice}
                    onChange={(e) => setLine(p.productId, { reflectToBasePrice: e.target.checked })}
                    disabled={isSubmitting}
                    className="h-4 w-4 accent-blue-600"
                  />
                  상품 기준가에 반영
                </label>
              </div>
            );
          })}
        </div>
      </form>
    </Modal>
  );
}
