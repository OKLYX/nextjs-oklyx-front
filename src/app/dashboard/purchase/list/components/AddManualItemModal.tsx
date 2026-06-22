'use client';

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import type { AddManualItemRequest } from '@/application/dto/PurchaseListDTOs';

const isIntStr = (v: string) => v.trim() !== '' && Number.isInteger(Number(v));

const schema = z.object({
  productId: z
    .string()
    .refine(isIntStr, '정수만 입력 가능합니다.')
    .refine((v) => Number(v) > 0, '상품 ID를 입력하세요.'),
  quantity: z
    .string()
    .refine(isIntStr, '정수만 입력 가능합니다.')
    .refine((v) => Number(v) >= 1, '수량은 1 이상이어야 합니다.'),
});
type FormData = z.infer<typeof schema>;

interface AddManualItemModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (request: AddManualItemRequest) => Promise<void>;
}

export function AddManualItemModal({ isOpen, onClose, onSubmit }: AddManualItemModalProps) {
  const [submitError, setSubmitError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { productId: '', quantity: '1' },
  });

  useEffect(() => {
    if (!isOpen) return;
    const initForm = async () => {
      reset({ productId: '', quantity: '1' });
      setSubmitError('');
    };
    initForm();
  }, [isOpen, reset]);

  if (!isOpen) return null;

  const onFormSubmit = async (data: FormData) => {
    setSubmitError('');
    setIsSubmitting(true);
    try {
      await onSubmit({ productId: Number(data.productId), quantity: Number(data.quantity) });
    } catch {
      setSubmitError('수동 항목 추가에 실패했습니다. 상품 ID를 확인하세요.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-lg shadow-lg max-w-md w-full mx-4">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold">수동 항목 추가</h2>
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="text-gray-500 hover:text-gray-700 disabled:opacity-50"
          >
            ✕
          </button>
        </div>

        <div className="p-4">
          {submitError && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
              {submitError}
            </div>
          )}

          <form onSubmit={handleSubmit(onFormSubmit)} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">구성품(Product) ID</label>
              <input
                {...register('productId')}
                type="number"
                placeholder="예: 100"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {errors.productId && (
                <p className="mt-1 text-xs text-red-600">{errors.productId.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">수량</label>
              <input
                {...register('quantity')}
                type="number"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
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
        </div>
      </div>
    </div>
  );
}
