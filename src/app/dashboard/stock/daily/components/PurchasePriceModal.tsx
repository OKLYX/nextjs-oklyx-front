'use client';

import { useEffect, useMemo, useState } from 'react';
import { StockLotUseCase } from '@/application/usecases/StockLotUseCase';
import { StockLotRepositoryImpl } from '@/infrastructure/repositories/StockLotRepositoryImpl';
import { SellerCardRepositoryImpl } from '@/infrastructure/repositories/SellerCardRepositoryImpl';
import { SellerCardUseCase } from '@/application/usecases/SellerCardUseCase';
import type { SellerCard } from '@/domain/entities/SellerCardEntity';
import {
  PHOTO_ONE_SELLER_MESSAGE,
  formatWonOrUnknown,
  purchasePricePhoto,
  type PurchasePriceTarget,
} from '@/domain/entities/StockLotEntity';
import type { PurchasePriceRequest } from '@/application/dto/StockLotDTOs';
import { toast } from '@/infrastructure/stores/toastStore';
import { extractErrorMessage } from '@/infrastructure/utils/errorMessage';
import { Button } from '@/presentation/components/ui/Button';
import { Modal } from '@/presentation/components/ui/Modal';

/**
 * 「매입가 넣기」 popup of 「일별 입출고 내역」 (FEATURE_2611_16 D2 · D3 · D7 · D11 · D12 · D13 · D18).
 *
 * - One line per checked target (a decided row's purchase record or a share), in table order: 「금액 기준」 total/unit,
 *   the amount (blank = keep the current amount, D7) and 「상품 기준가에 반영」.
 * - The 「영수증 사진」 field follows `purchasePricePhoto(targets)`:
 *   NEW_RECEIPT = a new receipt from the photo; with one seller its 「결제 카드」 lists that seller's cards (D12), with two
 *   or more sellers the save is refused (D11) · LATER_RECEIPT = the photo goes to the checked 「영수증 나중에」 receipt,
 *   no card field (D13) · BLOCKED = no file field, only the reason (D13 · D18).
 */

const FORM_ID = 'purchase-price-form';
const UNKNOWN_CARD = 'UNKNOWN';
const SELECT_CLASS =
  'w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500';
const INPUT_CLASS =
  'px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500';

interface LineState {
  amountMode: 'TOTAL' | 'UNIT';
  amount: string;
  reflectToBasePrice: boolean;
}

interface PurchasePriceModalProps {
  isOpen: boolean;
  /** The screen day — the server retypes that day's records only. */
  date: string;
  /** The checked targets in table order — memoized by the caller (the fields reset whenever this array changes). */
  targets: PurchasePriceTarget[];
  onClose: () => void;
  onSaved: () => void | Promise<void>;
}

export function PurchasePriceModal({ isOpen, date, targets, onClose, onSaved }: PurchasePriceModalProps) {
  const lotUseCase = useMemo(() => new StockLotUseCase(new StockLotRepositoryImpl()), []);
  const cardUseCase = useMemo(() => new SellerCardUseCase(new SellerCardRepositoryImpl()), []);

  const [cards, setCards] = useState<SellerCard[]>([]);
  const [cardChoice, setCardChoice] = useState('');
  const [photo, setPhoto] = useState<File | null>(null);
  const [lines, setLines] = useState<Record<number, LineState>>({});
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Every opening starts empty (total · blank amount · base price on) and reloads the cards.
  // Inline async IIFE defers setState past the sync effect body (set-state-in-effect lint).
  useEffect(() => {
    if (!isOpen) return;
    void (async () => {
      setCardChoice('');
      setPhoto(null);
      setError('');
      setLines(
        Object.fromEntries(
          targets.map((t) => [t.recordId, { amountMode: 'TOTAL', amount: '', reflectToBasePrice: true }])
        )
      );
      try {
        setCards(await cardUseCase.getVisible());
      } catch {
        setCards([]);
      }
    })();
  }, [isOpen, targets, cardUseCase]);

  if (!isOpen) return null;

  const setLine = (recordId: number, patch: Partial<LineState>) =>
    setLines((prev) => ({ ...prev, [recordId]: { ...prev[recordId], ...patch } }));

  const photoRule = purchasePricePhoto(targets);
  const cardSellerId = photoRule.kind === 'NEW_RECEIPT' ? photoRule.sellerId : null;
  const showCard = photo !== null && photoRule.kind === 'NEW_RECEIPT' && cardSellerId !== null;
  const sellerCards = cards.filter((card) => card.sellerId === cardSellerId);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    const typed = targets.map((t) => lines[t.recordId]?.amount.trim() ?? '');
    if (typed.some((text) => text !== '' && (!Number.isFinite(Number(text)) || Number(text) < 0))) {
      setError('금액은 0 이상 숫자만 입력할 수 있습니다.');
      return;
    }
    if (photo === null && typed.every((text) => text === '')) {
      setError('바꿀 금액을 넣거나 영수증 사진을 올리세요.');
      return;
    }
    if (photo !== null && photoRule.kind === 'NEW_RECEIPT' && photoRule.sellerId === null) {
      setError(PHOTO_ONE_SELLER_MESSAGE);
      return;
    }
    if (photo !== null && photoRule.kind === 'NEW_RECEIPT' && cardChoice === '') {
      setError('결제 카드를 고르세요.');
      return;
    }
    const request: PurchasePriceRequest = {
      ...(showCard && cardChoice !== UNKNOWN_CARD ? { cardId: Number(cardChoice) } : {}),
      lines: targets.map((t, index) => {
        const line = lines[t.recordId];
        // Only one of total/unit travels; blank = no key (the amount stays, D7).
        const amount = typed[index] === '' ? undefined : Number(typed[index]);
        return {
          recordId: t.recordId,
          ...(amount !== undefined && line.amountMode === 'TOTAL' ? { totalAmount: amount } : {}),
          ...(amount !== undefined && line.amountMode === 'UNIT' ? { unitPrice: amount } : {}),
          reflectToBasePrice: line.reflectToBasePrice,
        };
      }),
    };
    setIsSubmitting(true);
    try {
      await lotUseCase.retypePrices(date, photo, request);
      toast.success('매입가를 반영했습니다.');
      await onSaved();
    } catch (err) {
      setError(extractErrorMessage(err, '매입가를 반영하지 못했습니다.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen
      onClose={onClose}
      title="매입가 넣기"
      disableClose={isSubmitting}
      // The typed amounts live in component state, not in a DOM form value — tell the modal directly.
      isDirty={
        photo !== null ||
        Object.values(lines).some((l) => l.amount !== '' || !l.reflectToBasePrice || l.amountMode === 'UNIT')
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

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">영수증 사진</label>
          {photoRule.kind === 'BLOCKED' ? (
            <p className="text-sm text-gray-500">{photoRule.message}</p>
          ) : (
            <input
              type="file"
              accept="image/jpeg,image/png"
              disabled={isSubmitting}
              onChange={(e) => setPhoto(e.target.files?.[0] ?? null)}
              className="block w-full text-sm text-gray-700"
            />
          )}
        </div>

        {showCard && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">결제 카드</label>
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
        )}

        <div className="space-y-3">
          <p className="text-sm font-medium text-gray-700">매입가를 넣을 입고</p>
          {targets.map((t) => {
            const line = lines[t.recordId];
            if (!line) return null;
            return (
              <div key={t.recordId} className="border border-gray-200 rounded-lg p-3 space-y-2">
                <p className="text-sm text-gray-900">
                  {t.productName} {t.quantity}개 · {t.sellerName}{' '}
                  <span className="text-gray-500">(지금 금액 {formatWonOrUnknown(t.amount)})</span>
                </p>
                <div className="flex flex-wrap items-end gap-2">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">금액 기준</label>
                    <select
                      value={line.amountMode}
                      onChange={(e) => setLine(t.recordId, { amountMode: e.target.value as 'TOTAL' | 'UNIT' })}
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
                      placeholder="비우면 그대로"
                      value={line.amount}
                      onChange={(e) => setLine(t.recordId, { amount: e.target.value })}
                      disabled={isSubmitting}
                      className={`${INPUT_CLASS} w-32`}
                    />
                  </div>
                </div>
                <label className="flex items-center gap-2 text-xs text-gray-600">
                  <input
                    type="checkbox"
                    checked={line.reflectToBasePrice}
                    onChange={(e) => setLine(t.recordId, { reflectToBasePrice: e.target.checked })}
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
