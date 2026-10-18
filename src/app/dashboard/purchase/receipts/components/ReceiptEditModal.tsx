'use client';

import { useEffect, useMemo, useState } from 'react';
import { PurchaseReceiptRepositoryImpl } from '@/infrastructure/repositories/PurchaseReceiptRepositoryImpl';
import { PurchaseReceiptUseCase } from '@/application/usecases/PurchaseReceiptUseCase';
import { SellerCardRepositoryImpl } from '@/infrastructure/repositories/SellerCardRepositoryImpl';
import { SellerCardUseCase } from '@/application/usecases/SellerCardUseCase';
import type { ReceiptDetail } from '@/domain/entities/PurchaseReceiptEntity';
import type { Seller } from '@/domain/entities/SellerEntity';
import type { SellerCard } from '@/domain/entities/SellerCardEntity';
import type { UpdateReceiptRequest } from '@/application/dto/PurchaseReceiptDTOs';
import { toast } from '@/infrastructure/stores/toastStore';
import { extractErrorMessage } from '@/infrastructure/utils/errorMessage';
import { Button } from '@/presentation/components/ui/Button';
import { Modal } from '@/presentation/components/ui/Modal';

/**
 * Receipt header edit (FEATURE_2610_18 D100 · D101 · D102) — opened by [수정] of `ReceiptDetailModal`.
 *
 * **File**: src/app/dashboard/purchase/receipts/components/ReceiptEditModal.tsx
 * - Fields = 「결제 카드」 (visible cards + the receipt's own hidden card + 「카드로 알 수 없음」) · 「결제 판매자」 (only for
 *   「카드로 알 수 없음」) · 「구매일」. A card decides the payer seller (D54 · D87). One seller → only 「구매일」 (D53).
 * - The photo and the product lines are not editable (D100). The server moves every line — and the stock rows tied to
 *   them — to the new payer seller (D100 · D101).
 *
 * ⚠️ `detail` null = closed. Every opening starts from `detail` and loads the cards again.
 */
const FORM_ID = 'receipt-edit-form';
/** Card select value of 「카드로 알 수 없음」 (D87). */
const UNKNOWN_CARD = 'UNKNOWN';

const SELECT_CLASS =
  'w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500';

interface ReceiptEditModalProps {
  detail: ReceiptDetail | null;
  sellers: Seller[];
  onClose: () => void;
  /** Called with the receipt as saved. */
  onSaved: (updated: ReceiptDetail) => void | Promise<void>;
}

export function ReceiptEditModal({ detail, ...rest }: ReceiptEditModalProps) {
  // Mounted per opening — the form starts from `detail` every time.
  if (!detail) return null;
  return <ReceiptEditForm detail={detail} {...rest} />;
}

function ReceiptEditForm({
  detail,
  sellers,
  onClose,
  onSaved,
}: ReceiptEditModalProps & { detail: ReceiptDetail }) {
  const receiptUseCase = useMemo(() => new PurchaseReceiptUseCase(new PurchaseReceiptRepositoryImpl()), []);
  const cardUseCase = useMemo(() => new SellerCardUseCase(new SellerCardRepositoryImpl()), []);

  // D53 · D100 ②: one seller → no card / payer fields, only the purchase day changes.
  const soleSeller = sellers.length === 1;

  const [cards, setCards] = useState<SellerCard[]>([]);
  const [cardError, setCardError] = useState('');
  const [cardChoice, setCardChoice] = useState(detail.cardId != null ? String(detail.cardId) : UNKNOWN_CARD);
  const [payerSellerId, setPayerSellerId] = useState(String(detail.payerSellerId));
  const [purchasedOn, setPurchasedOn] = useState(detail.purchasedOn);
  const [submitError, setSubmitError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (soleSeller) return;
    void (async () => {
      try {
        setCards(await cardUseCase.getVisible());
      } catch {
        setCards([]);
        setCardError('카드 목록을 불러오지 못했습니다. 「카드로 알 수 없음」 으로 결제 판매자를 고를 수 있습니다.');
      }
    })();
  }, [cardUseCase, soleSeller]);

  // D100 ⑥: the receipt's own card stays pickable even when it is hidden (it is not in the visible list).
  const ownHiddenCard =
    detail.cardId != null && !cards.some((card) => card.id === detail.cardId)
      ? { id: detail.cardId, label: `${detail.payerSellerName} · ${detail.cardAlias} (${detail.cardMaskedNumber})` }
      : null;
  const pickedCard = cards.find((card) => String(card.id) === cardChoice) ?? null;
  const pickedPayerName = pickedCard
    ? pickedCard.sellerName
    : ownHiddenCard && String(ownHiddenCard.id) === cardChoice
      ? detail.payerSellerName
      : null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError('');
    if (purchasedOn === '') {
      setSubmitError('구매일은 필수입니다.');
      return;
    }
    let payer: Pick<UpdateReceiptRequest, 'cardId' | 'payerSellerId'>;
    if (soleSeller) {
      // D100 ②: card and payer seller stay as saved.
      payer = detail.cardId != null ? { cardId: detail.cardId } : { payerSellerId: detail.payerSellerId };
    } else if (cardChoice === UNKNOWN_CARD) {
      if (payerSellerId === '') {
        setSubmitError('결제 판매자를 선택하세요.');
        return;
      }
      payer = { payerSellerId: Number(payerSellerId) };
    } else {
      payer = { cardId: Number(cardChoice) };
    }
    setIsSubmitting(true);
    try {
      const updated = await receiptUseCase.update(detail.id, { purchasedOn, ...payer });
      toast.success('영수증을 수정했습니다.');
      await onSaved(updated);
    } catch (err) {
      setSubmitError(extractErrorMessage(err, '영수증을 수정하지 못했습니다.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen
      nested
      onClose={onClose}
      title="영수증 수정"
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
      <form id={FORM_ID} onSubmit={submit} className="space-y-4">
        {submitError && (
          <div className="p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">{submitError}</div>
        )}

        {!soleSeller && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">결제 카드</label>
            <select
              value={cardChoice}
              onChange={(e) => setCardChoice(e.target.value)}
              disabled={isSubmitting}
              className={SELECT_CLASS}
            >
              {cards.map((card) => (
                <option key={card.id} value={card.id}>
                  {card.sellerName} · {card.alias} ({card.maskedNumber})
                </option>
              ))}
              {ownHiddenCard && <option value={ownHiddenCard.id}>{ownHiddenCard.label}</option>}
              <option value={UNKNOWN_CARD}>카드로 알 수 없음</option>
            </select>
            {cardError && <p className="mt-1 text-xs text-amber-700">{cardError}</p>}
            {pickedPayerName && <p className="mt-1 text-xs text-gray-500">결제 판매자: {pickedPayerName}</p>}
          </div>
        )}

        {!soleSeller && cardChoice === UNKNOWN_CARD && (
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
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </form>
    </Modal>
  );
}
