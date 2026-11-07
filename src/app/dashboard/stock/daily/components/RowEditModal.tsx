'use client';

import { useEffect, useMemo, useState } from 'react';
import { StockLotUseCase } from '@/application/usecases/StockLotUseCase';
import { StockLotRepositoryImpl } from '@/infrastructure/repositories/StockLotRepositoryImpl';
import { SellerCardUseCase } from '@/application/usecases/SellerCardUseCase';
import { SellerCardRepositoryImpl } from '@/infrastructure/repositories/SellerCardRepositoryImpl';
import { PurchaseReceiptUseCase } from '@/application/usecases/PurchaseReceiptUseCase';
import { PurchaseReceiptRepositoryImpl } from '@/infrastructure/repositories/PurchaseReceiptRepositoryImpl';
import type { SellerCard } from '@/domain/entities/SellerCardEntity';
import type { Seller } from '@/domain/entities/SellerEntity';
import type { ReceiptSummary } from '@/domain/entities/PurchaseReceiptEntity';
import {
  dayReceiptChoices,
  formatWonOrUnknown,
  receiptChoiceLabel,
  sellerSwitchMessage,
  type RowEditTarget,
} from '@/domain/entities/StockLotEntity';
import type { DailyRowEditRequest } from '@/application/dto/StockLotDTOs';
import { toast } from '@/infrastructure/stores/toastStore';
import { extractErrorMessage } from '@/infrastructure/utils/errorMessage';
import { Button } from '@/presentation/components/ui/Button';
import { Modal } from '@/presentation/components/ui/Modal';
import { ConfirmDialog } from '@/presentation/components/ui/ConfirmDialog';

/**
 * The row popup of 「일별 입출고 내역」 (FEATURE_2611_17 D5 · D6 · D17 ~ D23) — one row or share, one save.
 *
 * - 「판매자」: a select when the target is seller-changeable, otherwise the seller's name as text.
 * - Price (`target.price` not null): 「금액 기준」 total/unit and the amount (blank = keep); 「상품 기준가에 반영」 for a
 *   purchase only (an opening-stock row has none, D18).
 * - Receipt (`target.receipt`): PICK = 「영수증 없음」 · a receipt of that day (`dayReceiptChoices`, D23) · a new photo
 *   with its card · LATER_PHOTO = a photo for the 「영수증 나중에」 receipt, no card (D19) · FIXED = the receipt as
 *   text · null = no receipt field (D20).
 * - Picking a receipt paid by another seller asks first (nested `ConfirmDialog`) and moves the seller to that payer;
 *   changing the seller clears the card and drops a picked receipt of another payer (D21).
 */

const FORM_ID = 'row-edit-form';
const NO_RECEIPT = '';
const NEW_RECEIPT = 'NEW';
const UNKNOWN_CARD = 'UNKNOWN';
const SELECT_CLASS =
  'w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500';
const INPUT_CLASS =
  'px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500';
const LABEL_CLASS = 'block text-sm font-medium text-gray-700 mb-1';

interface RowEditModalProps {
  /** The row or share to edit; null = closed. A new object on every click resets the fields. */
  target: RowEditTarget | null;
  /** The screen day — the day of the receipts offered and of a new receipt from the photo. */
  date: string;
  sellers: Seller[];
  onClose: () => void;
  onSaved: () => void | Promise<void>;
}

export function RowEditModal({ target, date, sellers, onClose, onSaved }: RowEditModalProps) {
  const lotUseCase = useMemo(() => new StockLotUseCase(new StockLotRepositoryImpl()), []);
  const cardUseCase = useMemo(() => new SellerCardUseCase(new SellerCardRepositoryImpl()), []);
  const receiptUseCase = useMemo(() => new PurchaseReceiptUseCase(new PurchaseReceiptRepositoryImpl()), []);

  const [sellerId, setSellerId] = useState(0);
  const [amountMode, setAmountMode] = useState<'TOTAL' | 'UNIT'>('TOTAL');
  const [amount, setAmount] = useState('');
  const [reflectToBasePrice, setReflectToBasePrice] = useState(true);
  // NO_RECEIPT · NEW_RECEIPT · a receipt id of that day.
  const [receiptChoice, setReceiptChoice] = useState(NO_RECEIPT);
  const [photo, setPhoto] = useState<File | null>(null);
  const [cardChoice, setCardChoice] = useState('');
  const [cards, setCards] = useState<SellerCard[]>([]);
  const [receipts, setReceipts] = useState<ReceiptSummary[]>([]);
  const [pendingReceipt, setPendingReceipt] = useState<ReceiptSummary | null>(null);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Every opening starts from the target (its seller · total · blank amount · base price on · no receipt) and reloads
  // the cards and that day's receipts. Inline async IIFE defers setState past the sync effect body (set-state-in-effect lint).
  useEffect(() => {
    if (!target) return;
    void (async () => {
      setSellerId(target.sellerId);
      setAmountMode('TOTAL');
      setAmount('');
      setReflectToBasePrice(true);
      setReceiptChoice(NO_RECEIPT);
      setPhoto(null);
      setCardChoice('');
      setPendingReceipt(null);
      setError('');
      const [loadedCards, loadedReceipts] = await Promise.all([
        cardUseCase.getVisible().catch(() => [] as SellerCard[]),
        receiptUseCase.search({ from: date, to: date }).catch(() => [] as ReceiptSummary[]),
      ]);
      setCards(loadedCards);
      setReceipts(loadedReceipts);
    })();
  }, [target, date, cardUseCase, receiptUseCase]);

  if (!target) return null;

  const sellerNameOf = (id: number) =>
    sellers.find((s) => s.id === id)?.sellerName ?? (id === target.sellerId ? target.sellerName : '');
  const choices = dayReceiptChoices(receipts, sellerId);
  const pickedReceipt =
    receiptChoice !== NO_RECEIPT && receiptChoice !== NEW_RECEIPT
      ? receipts.find((r) => String(r.id) === receiptChoice) ?? null
      : null;
  const isNewReceipt = target.receipt === 'PICK' && receiptChoice === NEW_RECEIPT;
  const sellerCards = cards.filter((card) => card.sellerId === sellerId);
  const fixedReceipt = receipts.find((r) => r.id === target.receiptId);

  const changeSeller = (nextId: number) => {
    setSellerId(nextId);
    setCardChoice('');
    if (pickedReceipt && pickedReceipt.payerSellerId !== nextId) setReceiptChoice(NO_RECEIPT);
  };

  const changeReceipt = (value: string) => {
    if (value !== NO_RECEIPT && value !== NEW_RECEIPT) {
      const receipt = receipts.find((r) => String(r.id) === value);
      if (receipt && receipt.payerSellerId !== sellerId) {
        // Ask first; nothing changes until 「바꾸기」.
        setPendingReceipt(receipt);
        return;
      }
    }
    setReceiptChoice(value);
    if (value !== NEW_RECEIPT) setPhoto(null);
  };

  const confirmSwitch = () => {
    if (!pendingReceipt) return;
    setSellerId(pendingReceipt.payerSellerId);
    setCardChoice('');
    setReceiptChoice(String(pendingReceipt.id));
    setPhoto(null);
    setPendingReceipt(null);
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    const typed = amount.trim();
    if (typed !== '' && (!Number.isFinite(Number(typed)) || Number(typed) < 0)) {
      setError('금액은 0 이상 숫자만 입력할 수 있습니다.');
      return;
    }
    if (isNewReceipt && photo === null) {
      setError('영수증 사진을 고르세요.');
      return;
    }
    if (isNewReceipt && cardChoice === '') {
      setError('결제 카드를 고르세요.');
      return;
    }
    const sendPhoto = isNewReceipt || target.receipt === 'LATER_PHOTO' ? photo : null;
    const sellerChanged = target.sellerEditable && sellerId !== target.sellerId;
    const receiptPicked = target.receipt === 'PICK' && pickedReceipt !== null;
    if (!sellerChanged && typed === '' && sendPhoto === null && !receiptPicked) {
      setError('바꿀 내용이 없습니다.');
      return;
    }
    const value = typed === '' ? undefined : Number(typed);
    const request: DailyRowEditRequest = {
      ...(target.movementId !== null ? { movementId: target.movementId } : {}),
      ...(target.movementId === null && target.shareRecordId !== null ? { shareRecordId: target.shareRecordId } : {}),
      ...(sellerChanged ? { sellerId } : {}),
      // Only the chosen basis travels; blank = no key (the price stays).
      ...(target.price !== null && value !== undefined && amountMode === 'TOTAL' ? { totalAmount: value } : {}),
      ...(target.price !== null && value !== undefined && amountMode === 'UNIT' ? { unitPrice: value } : {}),
      ...(target.price === 'PURCHASE' ? { reflectToBasePrice } : {}),
      ...(receiptPicked && pickedReceipt ? { receiptId: pickedReceipt.id } : {}),
      ...(isNewReceipt && cardChoice !== UNKNOWN_CARD ? { cardId: Number(cardChoice) } : {}),
    };
    setIsSubmitting(true);
    try {
      await lotUseCase.editRow(date, sendPhoto, request);
      toast.success('저장했습니다.');
      await onSaved();
    } catch (err) {
      setError(extractErrorMessage(err, '저장하지 못했습니다.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <Modal
        isOpen
        onClose={onClose}
        title="입고 정보 수정"
        disableClose={isSubmitting}
        // The fields live in component state, not in a DOM form value — tell the modal directly.
        isDirty={
          sellerId !== target.sellerId ||
          amount !== '' ||
          amountMode === 'UNIT' ||
          !reflectToBasePrice ||
          receiptChoice !== NO_RECEIPT ||
          photo !== null ||
          cardChoice !== ''
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

          <p className="text-sm text-gray-900">
            {target.productName} {target.quantity}개{' '}
            <span className="text-gray-500">(지금 금액 {formatWonOrUnknown(target.amount)})</span>
          </p>

          <div>
            <label className={LABEL_CLASS}>판매자</label>
            {target.sellerEditable ? (
              <select
                value={sellerId}
                onChange={(e) => changeSeller(Number(e.target.value))}
                disabled={isSubmitting}
                className={SELECT_CLASS}
              >
                {sellers.map((seller) => (
                  <option key={seller.id} value={seller.id}>
                    {seller.sellerName}
                  </option>
                ))}
              </select>
            ) : (
              <>
                <p className="text-sm text-gray-900">{target.sellerName}</p>
                {target.receipt !== null && (
                  <p className="text-xs text-gray-500 mt-1">판매자는 영수증 수정에서 바꿉니다</p>
                )}
              </>
            )}
          </div>

          {target.price !== null && (
            <div className="space-y-2">
              <div className="flex flex-wrap items-end gap-2">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">금액 기준</label>
                  <select
                    value={amountMode}
                    onChange={(e) => setAmountMode(e.target.value as 'TOTAL' | 'UNIT')}
                    disabled={isSubmitting}
                    className={INPUT_CLASS}
                  >
                    <option value="TOTAL">총액</option>
                    <option value="UNIT">단가</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">{amountMode === 'UNIT' ? '단가' : '총액'}</label>
                  <input
                    type="text"
                    inputMode="decimal"
                    placeholder="비우면 그대로"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    disabled={isSubmitting}
                    className={`${INPUT_CLASS} w-32`}
                  />
                </div>
              </div>
              {target.price === 'PURCHASE' && (
                <label className="flex items-center gap-2 text-xs text-gray-600">
                  <input
                    type="checkbox"
                    checked={reflectToBasePrice}
                    onChange={(e) => setReflectToBasePrice(e.target.checked)}
                    disabled={isSubmitting}
                    className="h-4 w-4 accent-blue-600"
                  />
                  상품 기준가에 반영
                </label>
              )}
            </div>
          )}

          {target.receipt === 'PICK' && (
            <>
              <div>
                <label className={LABEL_CLASS}>영수증</label>
                <select
                  value={receiptChoice}
                  onChange={(e) => changeReceipt(e.target.value)}
                  disabled={isSubmitting}
                  className={SELECT_CLASS}
                >
                  <option value={NO_RECEIPT}>영수증 없음</option>
                  {choices.map((receipt) => (
                    <option key={receipt.id} value={String(receipt.id)}>
                      {receiptChoiceLabel(receipt)}
                    </option>
                  ))}
                  <option value={NEW_RECEIPT}>새 영수증 사진 올리기</option>
                </select>
              </div>
              {isNewReceipt && (
                <>
                  <input
                    type="file"
                    accept="image/jpeg,image/png"
                    disabled={isSubmitting}
                    onChange={(e) => setPhoto(e.target.files?.[0] ?? null)}
                    className="block w-full text-sm text-gray-700"
                  />
                  <div>
                    <label className={LABEL_CLASS}>결제 카드</label>
                    <select
                      value={cardChoice}
                      onChange={(e) => setCardChoice(e.target.value)}
                      disabled={isSubmitting}
                      className={SELECT_CLASS}
                    >
                      <option value="">선택</option>
                      {sellerCards.map((card) => (
                        <option key={card.id} value={card.id}>
                          {card.sellerName} · {card.alias} ({card.maskedNumber})
                        </option>
                      ))}
                      <option value={UNKNOWN_CARD}>카드로 알 수 없음</option>
                    </select>
                  </div>
                </>
              )}
            </>
          )}

          {target.receipt === 'LATER_PHOTO' && (
            <div>
              <label className={LABEL_CLASS}>영수증 사진</label>
              <input
                type="file"
                accept="image/jpeg,image/png"
                disabled={isSubmitting}
                onChange={(e) => setPhoto(e.target.files?.[0] ?? null)}
                className="block w-full text-sm text-gray-700"
              />
            </div>
          )}

          {target.receipt === 'FIXED' && (
            <div>
              <label className={LABEL_CLASS}>영수증</label>
              <p className="text-sm text-gray-900">
                {fixedReceipt ? receiptChoiceLabel(fixedReceipt) : `영수증 #${target.receiptId}`}
              </p>
            </div>
          )}
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={pendingReceipt !== null}
        title="판매자 바뀜"
        message={
          pendingReceipt ? sellerSwitchMessage(sellerNameOf(sellerId), pendingReceipt.payerSellerName) : ''
        }
        confirmText="바꾸기"
        onConfirm={confirmSwitch}
        onCancel={() => setPendingReceipt(null)}
        nested
      />
    </>
  );
}
