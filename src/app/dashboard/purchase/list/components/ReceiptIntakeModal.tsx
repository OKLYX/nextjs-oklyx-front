'use client';

import { useEffect, useMemo, useState } from 'react';
import { useFieldArray, useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { PurchaseReceiptRepositoryImpl } from '@/infrastructure/repositories/PurchaseReceiptRepositoryImpl';
import { PurchaseReceiptUseCase } from '@/application/usecases/PurchaseReceiptUseCase';
import { SellerCardRepositoryImpl } from '@/infrastructure/repositories/SellerCardRepositoryImpl';
import { SellerCardUseCase } from '@/application/usecases/SellerCardUseCase';
import type { Seller } from '@/domain/entities/SellerEntity';
import type { SellerCard } from '@/domain/entities/SellerCardEntity';
import type { CreateReceiptRequest } from '@/application/dto/PurchaseReceiptDTOs';
import { toast } from '@/infrastructure/stores/toastStore';
import { extractErrorMessage } from '@/infrastructure/utils/errorMessage';
import { Button } from '@/presentation/components/ui/Button';
import { Modal } from '@/presentation/components/ui/Modal';
import { ProductPicker } from '@/presentation/components/ProductPicker';

/**
 * Receipt check-in popup (FEATURE_2610_18 D46 · D74 · D76 · D87 · D89 · D96 · D97).
 *
 * **Purpose**: one receipt photo = one check-in of several products. Opened by [영수증 입고] above the purchase list.
 * **File**: src/app/dashboard/purchase/list/components/ReceiptIntakeModal.tsx
 *
 * - Photo (jpeg/png upload) is required (D76). Nothing is read from it (D74).
 * - 「결제 카드」 = visible cards + 「카드로 알 수 없음」; the card owner is the payer seller, 「카드로 알 수 없음」 asks for
 *   the payer seller (D87). One seller → both fields hidden and that seller pays (D53).
 * - Product lines: product (any product, D96) · quantity 1 or more (D97) · amount (total/unit, blank = not entered,
 *   D41) · base price checkbox. No seller per line — every line belongs to the payer seller (D89).
 *
 * ⚠️ No debt is written for a receipt (D88).
 * ❌ No negative quantity here — a correction goes through the per-product check-in (D97 · D75).
 */

const FORM_ID = 'receipt-intake-form';
/** Card select value of 「카드로 알 수 없음」 (D87). '' = nothing picked yet. */
const UNKNOWN_CARD = 'UNKNOWN';

const isIntStr = (v: string) => v.trim() !== '' && Number.isInteger(Number(v));

const lineSchema = z.object({
  productId: z.string().refine((v) => v !== '', '상품을 검색해 선택하세요.'),
  productName: z.string(),
  quantity: z
    .string()
    .refine(isIntStr, '정수만 입력 가능합니다.')
    .refine((v) => Number(v) >= 1, '수량은 1 이상이어야 합니다.'),
  amountMode: z.enum(['TOTAL', 'UNIT']),
  amount: z
    .string()
    .refine(
      (v) => v.trim() === '' || (!Number.isNaN(Number(v)) && Number(v) >= 0),
      '금액은 0 이상의 숫자여야 합니다.'
    ),
  reflectToBasePrice: z.boolean(),
});

const schema = z.object({
  purchasedOn: z.string().min(1, '구매일은 필수입니다.'),
  cardChoice: z.string(),
  payerSellerId: z.string(),
  lines: z.array(lineSchema).min(1, '상품 줄을 하나 이상 넣으세요.'),
});
type FormData = z.infer<typeof schema>;
type LineData = FormData['lines'][number];

// Local calendar day (YYYY-MM-DD) — toISOString (UTC) can be a day off in KST.
const today = () => {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
};

const emptyLine = (): LineData => ({
  productId: '',
  productName: '',
  quantity: '1',
  amountMode: 'TOTAL',
  amount: '',
  reflectToBasePrice: true,
});

const defaults = (): FormData => ({
  purchasedOn: today(),
  cardChoice: '',
  payerSellerId: '',
  lines: [emptyLine()],
});

const SELECT_CLASS =
  'w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500';

interface ReceiptIntakeModalProps {
  isOpen: boolean;
  sellers: Seller[];
  onClose: () => void;
  /** Called after a successful save — the container reloads the list. */
  onSaved: () => void | Promise<void>;
}

export function ReceiptIntakeModal({ isOpen, sellers, onClose, onSaved }: ReceiptIntakeModalProps) {
  const receiptUseCase = useMemo(() => new PurchaseReceiptUseCase(new PurchaseReceiptRepositoryImpl()), []);
  const cardUseCase = useMemo(() => new SellerCardUseCase(new SellerCardRepositoryImpl()), []);

  // D53 · D87: one seller → no card / payer fields, that seller pays.
  const soleSeller = sellers.length === 1 ? sellers[0] : null;

  const [cards, setCards] = useState<SellerCard[]>([]);
  const [cardError, setCardError] = useState('');
  const [photo, setPhoto] = useState<File | null>(null);
  const [submitError, setSubmitError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<FormData>({ resolver: zodResolver(schema), defaultValues: defaults() });
  const { fields, append, remove } = useFieldArray({ control: form.control, name: 'lines' });
  const [cardChoice, lines] = useWatch({ control: form.control, name: ['cardChoice', 'lines'] });

  // Every opening starts empty (today, no card, one blank line) and reloads the cards.
  useEffect(() => {
    if (!isOpen) return;
    void (async () => {
      form.reset(defaults());
      setPhoto(null);
      setSubmitError('');
      setCardError('');
      if (soleSeller) return;
      try {
        setCards(await cardUseCase.getVisible());
      } catch {
        setCards([]);
        setCardError('카드 목록을 불러오지 못했습니다. 「카드로 알 수 없음」 으로 결제 판매자를 고를 수 있습니다.');
      }
    })();
  }, [isOpen, form, cardUseCase, soleSeller]);

  const photoPreview = useMemo(() => (photo ? URL.createObjectURL(photo) : ''), [photo]);
  useEffect(() => {
    return () => {
      if (photoPreview) URL.revokeObjectURL(photoPreview);
    };
  }, [photoPreview]);

  if (!isOpen) return null;

  const pickedCard = cards.find((card) => String(card.id) === cardChoice) ?? null;

  const submit = async (data: FormData) => {
    setSubmitError('');
    if (!photo) {
      setSubmitError('영수증 사진을 올리세요.');
      return;
    }
    let payer: Pick<CreateReceiptRequest, 'cardId' | 'payerSellerId'>;
    if (soleSeller) {
      payer = { payerSellerId: soleSeller.id };
    } else if (data.cardChoice === '') {
      setSubmitError('결제 카드를 고르세요.');
      return;
    } else if (data.cardChoice === UNKNOWN_CARD) {
      if (data.payerSellerId === '') {
        setSubmitError('결제 판매자를 선택하세요.');
        return;
      }
      payer = { payerSellerId: Number(data.payerSellerId) };
    } else {
      payer = { cardId: Number(data.cardChoice) };
    }
    const request: CreateReceiptRequest = {
      purchasedOn: data.purchasedOn,
      ...payer,
      lines: data.lines.map((line) => {
        // Only one of total/unit travels; a blank amount is "no key", never 0 (PLAN 2609_28 D1 · D41).
        const amount = line.amount.trim() === '' ? undefined : Number(line.amount);
        return {
          productId: Number(line.productId),
          quantity: Number(line.quantity),
          ...(amount !== undefined && line.amountMode === 'TOTAL' ? { totalAmount: amount } : {}),
          ...(amount !== undefined && line.amountMode === 'UNIT' ? { unitPrice: amount } : {}),
          reflectToBasePrice: line.reflectToBasePrice,
        };
      }),
    };
    setIsSubmitting(true);
    try {
      await receiptUseCase.create(photo, request);
      toast.success('영수증 입고를 저장했습니다.');
      await onSaved();
    } catch (err) {
      setSubmitError(extractErrorMessage(err, '영수증 입고를 저장하지 못했습니다.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const firstFieldError = (() => {
    const errors = form.formState.errors;
    if (errors.purchasedOn?.message) return errors.purchasedOn.message;
    if (errors.lines?.message) return errors.lines.message;
    for (let index = 0; index < fields.length; index += 1) {
      const line = errors.lines?.[index];
      const message = line?.productId?.message || line?.quantity?.message || line?.amount?.message;
      if (message) return message;
    }
    return '';
  })();

  return (
    <Modal
      isOpen
      onClose={onClose}
      title="영수증 입고"
      disableClose={isSubmitting}
      // The picked products live in the form state, not in a DOM control — tell the modal directly.
      isDirty={form.formState.isDirty || photo !== null}
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
      <form id={FORM_ID} onSubmit={form.handleSubmit(submit)} className="space-y-4">
        {(submitError || firstFieldError) && (
          <div className="p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
            {submitError || firstFieldError}
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">영수증 사진</label>
          <input
            type="file"
            accept="image/jpeg,image/png"
            disabled={isSubmitting}
            onChange={(e) => setPhoto(e.target.files?.[0] ?? null)}
            className="block w-full text-sm text-gray-700"
          />
          {photoPreview && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={photoPreview} alt="영수증 사진" className="mt-2 max-h-48 w-auto rounded border border-gray-200" />
          )}
        </div>

        {!soleSeller && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">결제 카드</label>
            <select {...form.register('cardChoice')} disabled={isSubmitting} className={SELECT_CLASS}>
              <option value="">선택</option>
              {cards.map((card) => (
                <option key={card.id} value={card.id}>
                  {card.sellerName} · {card.alias} ({card.maskedNumber})
                </option>
              ))}
              <option value={UNKNOWN_CARD}>카드로 알 수 없음</option>
            </select>
            {cardError && <p className="mt-1 text-xs text-amber-700">{cardError}</p>}
            {pickedCard && <p className="mt-1 text-xs text-gray-500">결제 판매자: {pickedCard.sellerName}</p>}
          </div>
        )}

        {!soleSeller && cardChoice === UNKNOWN_CARD && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">결제 판매자</label>
            <select {...form.register('payerSellerId')} disabled={isSubmitting} className={SELECT_CLASS}>
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
            {...form.register('purchasedOn')}
            disabled={isSubmitting}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="space-y-3">
          <p className="text-sm font-medium text-gray-700">상품</p>
          {fields.map((field, index) => {
            const line = lines?.[index];
            return (
              <div key={field.id} className="border border-gray-200 rounded-lg p-3 space-y-2">
                <ProductPicker
                  productId={line && line.productId !== '' ? Number(line.productId) : null}
                  productName={line?.productName ?? ''}
                  onSelect={(id, name) => {
                    form.setValue(`lines.${index}.productId`, String(id), { shouldValidate: true, shouldDirty: true });
                    form.setValue(`lines.${index}.productName`, name, { shouldDirty: true });
                  }}
                  onClear={() => {
                    form.setValue(`lines.${index}.productId`, '', { shouldDirty: true });
                    form.setValue(`lines.${index}.productName`, '', { shouldDirty: true });
                  }}
                  disabled={isSubmitting}
                />
                <div className="flex flex-wrap items-end gap-2">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">수량</label>
                    <input
                      type="number"
                      {...form.register(`lines.${index}.quantity`)}
                      disabled={isSubmitting}
                      className="w-24 px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">금액 기준</label>
                    <select
                      {...form.register(`lines.${index}.amountMode`)}
                      disabled={isSubmitting}
                      className="px-2 py-1 border border-gray-300 rounded text-sm bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                    >
                      <option value="TOTAL">총액</option>
                      <option value="UNIT">단가</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">
                      {line?.amountMode === 'UNIT' ? '단가' : '총액'}
                    </label>
                    <div className="flex items-center gap-1">
                      <input
                        type="text"
                        inputMode="decimal"
                        placeholder="모르면 비움"
                        {...form.register(`lines.${index}.amount`)}
                        disabled={isSubmitting}
                        className="w-32 px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                      <span className="text-sm text-gray-500">원</span>
                    </div>
                  </div>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => remove(index)}
                    disabled={isSubmitting || fields.length === 1}
                    className="ml-auto"
                  >
                    줄 삭제
                  </Button>
                </div>
                <label className="flex items-center gap-2 text-xs text-gray-600">
                  <input
                    type="checkbox"
                    {...form.register(`lines.${index}.reflectToBasePrice`)}
                    disabled={isSubmitting}
                    className="h-4 w-4 accent-blue-600"
                  />
                  상품 기준가에 반영
                </label>
              </div>
            );
          })}
          <Button variant="secondary" size="sm" onClick={() => append(emptyLine())} disabled={isSubmitting}>
            상품 줄 추가
          </Button>
        </div>
      </form>
    </Modal>
  );
}
