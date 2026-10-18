'use client';

import { useEffect, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import type { AddManualItemRequest } from '@/application/dto/PurchaseListDTOs';
import type { Seller } from '@/domain/entities/SellerEntity';
import { Input } from '@/presentation/components/ui/Input';
import { Modal } from '@/presentation/components/ui/Modal';
import { ProductPicker } from '@/presentation/components/ProductPicker';

const isIntStr = (v: string) => v.trim() !== '' && Number.isInteger(Number(v));

const schema = z.object({
  productId: z.string().refine((v) => v !== '', '상품을 검색해 선택하세요.'),
  productName: z.string(),
  // FEATURE_2610_09 D11: required. D12: starts empty every time the popup opens.
  sellerId: z.string().min(1, '판매자를 선택하세요.'),
  quantity: z
    .string()
    .refine(isIntStr, '정수만 입력 가능합니다.')
    .refine((v) => Number(v) >= 1, '수량은 1 이상이어야 합니다.'),
});
type FormData = z.infer<typeof schema>;

interface AddManualItemModalProps {
  isOpen: boolean;
  sellers: Seller[];
  onClose: () => void;
  onSubmit: (request: AddManualItemRequest) => Promise<void>;
}

export function AddManualItemModal({ isOpen, sellers, onClose, onSubmit }: AddManualItemModalProps) {
  // D53: one seller → the field is hidden and that seller is used.
  const soleSellerId = sellers.length === 1 ? String(sellers[0].id) : '';

  const [submitError, setSubmitError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    control,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { productId: '', productName: '', sellerId: soleSellerId, quantity: '1' },
  });
  const productId = useWatch({ control, name: 'productId' });
  const productName = useWatch({ control, name: 'productName' });

  useEffect(() => {
    if (!isOpen) return;
    const initForm = async () => {
      reset({ productId: '', productName: '', sellerId: soleSellerId, quantity: '1' });
      setSubmitError('');
    };
    initForm();
  }, [isOpen, reset, soleSellerId]);

  if (!isOpen) return null;

  const onFormSubmit = async (data: FormData) => {
    setSubmitError('');
    setIsSubmitting(true);
    try {
      await onSubmit({
        productId: Number(data.productId),
        sellerId: Number(data.sellerId),
        quantity: Number(data.quantity),
      });
    } catch {
      setSubmitError('수동 항목 추가에 실패했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen
      onClose={onClose}
      title="수동 항목 추가"
      disableClose={isSubmitting}
    >
      {submitError && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
          {submitError}
        </div>
      )}

      <form onSubmit={handleSubmit(onFormSubmit)} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">상품</label>
          <ProductPicker
            fixedResults
            productId={productId === '' ? null : Number(productId)}
            productName={productName}
            onSelect={(id, name) => {
              setValue('productId', String(id), { shouldValidate: true, shouldDirty: true });
              setValue('productName', name, { shouldDirty: true });
            }}
            onClear={() => {
              setValue('productId', '', { shouldDirty: true });
              setValue('productName', '', { shouldDirty: true });
            }}
            disabled={isSubmitting}
          />
          {/* Reserved line so a validation message does not resize the popup. */}
          <p className="mt-1 h-4 text-xs text-red-600">{errors.productId?.message}</p>
        </div>

        {soleSellerId === '' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">판매자</label>
            <select
              {...register('sellerId')}
              disabled={isSubmitting}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">선택</option>
              {sellers.map((seller) => (
                <option key={seller.id} value={seller.id}>
                  {seller.sellerName}
                </option>
              ))}
            </select>
            {errors.sellerId && (
              <p className="mt-1 text-xs text-red-600">{errors.sellerId.message}</p>
            )}
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">수량</label>
          <Input
            {...register('quantity')}
            type="number"
          />
          {errors.quantity && (
            <p className="mt-1 text-xs text-red-600">{errors.quantity.message}</p>
          )}
        </div>

        <div className="flex gap-2 justify-end pt-4 border-t border-gray-200">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="px-4 py-2 text-sm border border-gray-300 rounded hover:bg-gray-100 disabled:opacity-50"
          >
            취소
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400"
          >
            {isSubmitting ? '추가 중...' : '추가'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
