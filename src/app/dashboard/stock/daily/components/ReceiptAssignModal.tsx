'use client';

import { useEffect, useMemo, useState } from 'react';
import { StockLotUseCase } from '@/application/usecases/StockLotUseCase';
import { StockLotRepositoryImpl } from '@/infrastructure/repositories/StockLotRepositoryImpl';
import { SellerCardRepositoryImpl } from '@/infrastructure/repositories/SellerCardRepositoryImpl';
import { SellerCardUseCase } from '@/application/usecases/SellerCardUseCase';
import type { Seller } from '@/domain/entities/SellerEntity';
import type { SellerCard } from '@/domain/entities/SellerCardEntity';
import type { UnregisteredProduct } from '@/domain/entities/StockLotEntity';
import type { CreateReceiptRequest, ReceiptLineRequest } from '@/application/dto/PurchaseReceiptDTOs';
import type { ReceiptlessAssignRequest } from '@/application/dto/StockLotDTOs';
import { toast } from '@/infrastructure/stores/toastStore';
import { extractErrorMessage } from '@/infrastructure/utils/errorMessage';
import { Button } from '@/presentation/components/ui/Button';
import { Modal } from '@/presentation/components/ui/Modal';

/**
 * Receipt assignment popup of 「일별 입출고 내역」 (FEATURE_2610_19 D118 · D121 · D87 · D135).
 *
 * - Photo (required, D121 ⑦) · 「결제 카드」 = visible cards + 「카드로 알 수 없음」 (then 「결제 판매자」) · 「구매일」 (first = the
 *   screen day). The card fields follow the receipt check-in popup (`ReceiptIntakeModal`).
 * - The given products (every undecided product of the screen day, or the checked ones — FEATURE_2611_01 D14) with
 *   their 「남은 미등록 수량」; the person types how many this receipt covers (0 = not on this receipt, more than left is
 *   refused, D121 ①) and the amount (total or unit, blank = the registered price, D135) and the base price checkbox.
 * - Saved assignments are not edited here (D121 ⑧) — the receipt header is edited from the receipt list (D100).
 * - `mode="WITHOUT_RECEIPT"` = 「영수증 없이 판매자 정하기」 (FEATURE_2611_01 D2 · D4 · D8): no photo, card or purchase day —
 *   「영수증 나중에」 / 「영수증 없음(발견 재고 등)」 and 「판매자」 instead; the same product · count · amount lines.
 * - `prefillRemaining` = opened from checked rows (D14): only those products, the count starts at the remaining
 *   unregistered quantity. Without it every product starts at 0.
 */

const FORM_ID = 'receipt-assign-form';
const UNKNOWN_CARD = 'UNKNOWN';
const SELECT_CLASS =
  'w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500';
const INPUT_CLASS =
  'px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500';

interface LineState {
  /** The count the popup opened with — the dirty check compares against it. */
  initialQuantity: string;
  quantity: string;
  amountMode: 'TOTAL' | 'UNIT';
  amount: string;
  reflectToBasePrice: boolean;
}

type ReceiptChoice = '' | ReceiptlessAssignRequest['mode'];

interface ReceiptAssignModalProps {
  isOpen: boolean;
  /** RECEIPT = [영수증 올리기] · WITHOUT_RECEIPT = [영수증 없이 판매자 정하기] (FEATURE_2611_01 D2). */
  mode: 'RECEIPT' | 'WITHOUT_RECEIPT';
  /** true = the counts start at each product's remaining unregistered quantity (D14). */
  prefillRemaining: boolean;
  /** The screen day — only that day's undecided intake can be assigned (D121 ⑥). */
  date: string;
  products: UnregisteredProduct[];
  sellers: Seller[];
  onClose: () => void;
  onSaved: () => void | Promise<void>;
}

export function ReceiptAssignModal({
  isOpen,
  mode,
  prefillRemaining,
  date,
  products,
  sellers,
  onClose,
  onSaved,
}: ReceiptAssignModalProps) {
  const lotUseCase = useMemo(() => new StockLotUseCase(new StockLotRepositoryImpl()), []);
  const cardUseCase = useMemo(() => new SellerCardUseCase(new SellerCardRepositoryImpl()), []);

  const [cards, setCards] = useState<SellerCard[]>([]);
  const [cardChoice, setCardChoice] = useState('');
  const [payerSellerId, setPayerSellerId] = useState('');
  const [purchasedOn, setPurchasedOn] = useState(date);
  const [photo, setPhoto] = useState<File | null>(null);
  const [lines, setLines] = useState<Record<number, LineState>>({});
  const [receiptChoice, setReceiptChoice] = useState<ReceiptChoice>('');
  const [sellerId, setSellerId] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Every opening starts from the props (counts at 0, or at the remaining quantity — D14) and reloads the cards of a
  // receipt. Inline async IIFE defers setState past the sync effect body (set-state-in-effect lint).
  useEffect(() => {
    if (!isOpen) return;
    void (async () => {
      setCardChoice('');
      setPayerSellerId('');
      setPurchasedOn(date);
      setPhoto(null);
      setReceiptChoice('');
      setSellerId('');
      setError('');
      setLines(
        Object.fromEntries(
          products.map((p) => {
            const quantity = prefillRemaining ? String(p.remainingQty) : '0';
            return [
              p.productId,
              { initialQuantity: quantity, quantity, amountMode: 'TOTAL', amount: '', reflectToBasePrice: true },
            ];
          })
        )
      );
      if (mode !== 'RECEIPT') return;
      try {
        setCards(await cardUseCase.getVisible());
      } catch {
        setCards([]);
      }
    })();
  }, [isOpen, mode, prefillRemaining, date, products, cardUseCase]);

  if (!isOpen) return null;

  const setLine = (productId: number, patch: Partial<LineState>) =>
    setLines((prev) => ({ ...prev, [productId]: { ...prev[productId], ...patch } }));

  const withoutReceipt = mode === 'WITHOUT_RECEIPT';

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    let payer: Pick<CreateReceiptRequest, 'cardId' | 'payerSellerId'> = {};
    if (withoutReceipt) {
      // D4: one of the two must be picked · the seller is required (never back to 「미정」).
      if (receiptChoice === '') {
        setError('영수증 처리를 고르세요.');
        return;
      }
      if (sellerId === '') {
        setError('판매자를 선택하세요.');
        return;
      }
    } else {
      if (!photo) {
        setError('영수증 사진을 올리세요.');
        return;
      }
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
    }
    const picked = products.filter((p) => Number(lines[p.productId]?.quantity ?? '0') > 0);
    if (picked.length === 0) {
      setError(
        withoutReceipt ? '판매자를 정할 상품의 개수를 입력하세요.' : '이 영수증으로 처리한 상품의 개수를 입력하세요.'
      );
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
    const requestLines: ReceiptLineRequest[] = picked.map((p) => {
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
    });
    setIsSubmitting(true);
    try {
      if (withoutReceipt && receiptChoice !== '') {
        await lotUseCase.assignWithoutReceipt(date, {
          mode: receiptChoice,
          sellerId: Number(sellerId),
          lines: requestLines,
        });
        toast.success('판매자를 정했습니다.');
      } else if (photo) {
        await lotUseCase.assign(date, photo, { purchasedOn, ...payer, lines: requestLines });
        toast.success('영수증을 배정했습니다.');
      }
      await onSaved();
    } catch (err) {
      setError(
        extractErrorMessage(err, withoutReceipt ? '판매자를 정하지 못했습니다.' : '영수증을 배정하지 못했습니다.')
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const pickedCard = cards.find((card) => String(card.id) === cardChoice) ?? null;

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={withoutReceipt ? '영수증 없이 판매자 정하기' : '영수증 올리기'}
      disableClose={isSubmitting}
      // The typed quantities live in component state, not in a DOM form value — tell the modal directly.
      isDirty={
        photo !== null ||
        receiptChoice !== '' ||
        sellerId !== '' ||
        Object.values(lines).some((l) => l.quantity !== l.initialQuantity || l.amount !== '')
      }
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

        {withoutReceipt && (
          <>
            <div>
              <p className="block text-sm font-medium text-gray-700 mb-1">영수증 처리</p>
              <div className="flex flex-wrap gap-4 text-sm text-gray-700">
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="receipt-choice"
                    checked={receiptChoice === 'RECEIPT_LATER'}
                    onChange={() => setReceiptChoice('RECEIPT_LATER')}
                    disabled={isSubmitting}
                    className="h-4 w-4 accent-blue-600"
                  />
                  영수증 나중에
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="receipt-choice"
                    checked={receiptChoice === 'NO_RECEIPT'}
                    onChange={() => setReceiptChoice('NO_RECEIPT')}
                    disabled={isSubmitting}
                    className="h-4 w-4 accent-blue-600"
                  />
                  영수증 없음(발견 재고 등)
                </label>
              </div>
            </div>
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
          </>
        )}

        {!withoutReceipt && (
          <>
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
          </>
        )}

        <div className="space-y-3">
          <p className="text-sm font-medium text-gray-700">
            {withoutReceipt ? '판매자를 정할 상품' : '이 영수증으로 처리한 상품'}
          </p>
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
