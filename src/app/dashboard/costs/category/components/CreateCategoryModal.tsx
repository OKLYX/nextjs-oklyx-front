'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import type { Category } from '@/domain/entities/CategoryEntity';
import type { CreateCategoryRequest } from '@/application/dto/CreateCategoryRequest';

const schema = z.object({
  name: z.string().min(1, '카테고리명은 필수입니다.').max(100),
  platform: z.string().min(1, '플랫폼은 필수입니다.'),
  platformCategoryId: z.string().min(1, '플랫폼 카테고리 ID는 필수입니다.').max(50),
  parentId: z.number().nullable(),
});

type FormData = {
  name: string;
  platform: string;
  platformCategoryId: string;
  parentId: number | null;
};

interface CreateCategoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: CreateCategoryRequest) => Promise<void>;
  isSubmitting: boolean;
  categories: Category[];
}

export function CreateCategoryModal({
  isOpen,
  onClose,
  onSubmit,
  isSubmitting,
  categories,
}: CreateCategoryModalProps) {
  const [submitError, setSubmitError] = useState('');

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { parentId: null },
  });

  if (!isOpen) return null;

  const onFormSubmit = async (data: FormData) => {
    setSubmitError('');
    try {
      const submitData = {
        ...data,
        parentId: data.parentId || null,
      };
      await onSubmit(submitData);
    } catch (err) {
      const message = err instanceof Error ? err.message : '저장에 실패했습니다.';
      setSubmitError(message);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-lg shadow-lg max-w-md w-full mx-4">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold">카테고리 추가</h2>
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
              <label className="block text-sm font-medium text-gray-700 mb-1">
                카테고리명
              </label>
              <input
                {...register('name')}
                type="text"
                placeholder="카테고리명 입력"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {errors.name && (
                <p className="mt-1 text-xs text-red-600">{errors.name.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                플랫폼
              </label>
              <select
                {...register('platform')}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">선택하세요</option>
                <option value="COUPANG">쿠팡</option>
                <option value="GMARKET">지마켓</option>
                <option value="AUCTION">옥션</option>
                <option value="SMARTSTORE">스마트스토어</option>
              </select>
              {errors.platform && (
                <p className="mt-1 text-xs text-red-600">{errors.platform.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                플랫폼 카테고리 ID
              </label>
              <input
                {...register('platformCategoryId')}
                type="text"
                placeholder="예: cat_001"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {errors.platformCategoryId && (
                <p className="mt-1 text-xs text-red-600">{errors.platformCategoryId.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                부모 카테고리
              </label>
              <select
                {...register('parentId')}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">선택 안함 (최상위)</option>
                {categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
              {errors.parentId && (
                <p className="mt-1 text-xs text-red-600">{errors.parentId.message}</p>
              )}
            </div>

            <div className="flex gap-2 justify-end pt-4 border-t border-gray-200">
              <button
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
                {isSubmitting ? '저장 중...' : '저장'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
