'use client';

import { useState, useEffect, useMemo } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  createCommissionRateSchema,
  updateCommissionRateSchema,
  CreateCommissionRateFormData,
  UpdateCommissionRateFormData
} from '@/application/schemas/CommissionRateSchema';
import { CategoryUseCase } from '@/application/usecases/CategoryUseCase';
import { CategoryRepositoryImpl } from '@/infrastructure/repositories/CategoryRepositoryImpl';
import type { Category } from '@/domain/entities/CategoryEntity';
import type { CommissionRate } from '@/domain/entities/CommissionRateEntity';

interface CommissionRateFormProps {
  initialData?: CommissionRate;
  onSubmit: (data: CreateCommissionRateFormData | UpdateCommissionRateFormData) => Promise<void>;
  onCancel: () => void;
  isLoading: boolean;
  submitButtonLabel?: string;
  submitLoadingLabel?: string;
  isDeletingRate?: boolean;
  onOpenDeleteConfirm?: () => void;
}

export function CommissionRateForm({
  initialData,
  onSubmit,
  onCancel,
  isLoading,
  submitButtonLabel = '추가',
  submitLoadingLabel = '추가 중...',
  isDeletingRate = false,
  onOpenDeleteConfirm,
}: CommissionRateFormProps) {
  const [requestError, setRequestError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [allCategories, setAllCategories] = useState<Category[]>([]);
  const [platforms, setPlatforms] = useState<string[]>([]);
  const [isLoadingCategories, setIsLoadingCategories] = useState(false);

  const categoryUseCase = useMemo(() => {
    return new CategoryUseCase(new CategoryRepositoryImpl());
  }, []);

  const isEditMode = !!initialData;
  const schema = isEditMode ? updateCommissionRateSchema : createCommissionRateSchema;

  const {
    control,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isValid },
  } = useForm<CreateCommissionRateFormData | UpdateCommissionRateFormData>({
    resolver: zodResolver(schema),
    mode: 'onChange',
    defaultValues: {
      platform: initialData?.platform ?? '',
      categoryId: initialData?.categoryId ?? 0,
      rate: initialData?.rate ?? 0,
    },
  });

  const selectedPlatform = watch('platform');

  useEffect(() => {
    const loadPlatformsAndCategories = async () => {
      setIsLoadingCategories(true);
      try {
        const categories = await categoryUseCase.getCategories();
        setAllCategories(categories);

        const uniquePlatforms = Array.from(new Set(categories.map(cat => cat.platform))).sort();
        setPlatforms(uniquePlatforms);
      } catch (error) {
        setAllCategories([]);
        setPlatforms([]);
      } finally {
        setIsLoadingCategories(false);
      }
    };

    loadPlatformsAndCategories();
  }, [categoryUseCase]);

  const filteredCategories = selectedPlatform
    ? allCategories.filter(cat => cat.platform === selectedPlatform)
    : [];

  const handleFormSubmit = async (data: CreateCommissionRateFormData | UpdateCommissionRateFormData) => {
    setIsSubmitting(true);
    setRequestError('');
    try {
      await onSubmit(data);
      if (!isEditMode) {
        reset();
      }
    } catch (err) {
      const error = err as { response?: { status: number }; message?: string };
      const errorMessage =
        error?.response?.status === 409
          ? `플랫폼 "${data.platform}"은(는) 이미 존재합니다.`
          : error?.response?.status === 401
            ? '인증이 만료되었습니다. 다시 로그인해주세요.'
            : error?.response?.status === 403
              ? '관리자 권한이 없습니다.'
              : error?.response?.status === 400
                ? '요청 데이터가 유효하지 않습니다.'
                : error?.message === 'Network Error'
                  ? '네트워크 연결을 확인해주세요.'
                  : isEditMode
                    ? '수수료 수정에 실패했습니다. 다시 시도해주세요.'
                    : '수수료 생성에 실패했습니다. 다시 시도해주세요.';
      setRequestError(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4">
      {requestError && (
        <div className="p-3 bg-red-50 border border-red-200 rounded text-sm text-red-800">
          {requestError}
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          플랫폼
        </label>
        <Controller
          name="platform"
          control={control}
          render={({ field }) => (
            <select
              {...field}
              disabled={isSubmitting || isLoading || isLoadingCategories}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
            >
              <option value="">플랫폼 선택</option>
              {platforms.map(platform => (
                <option key={platform} value={platform}>
                  {platform}
                </option>
              ))}
            </select>
          )}
        />
        {isLoadingCategories && !selectedPlatform && (
          <p className="mt-1 text-xs text-gray-500">플랫폼을 불러오는 중...</p>
        )}
        {errors.platform && (
          <p className="mt-1 text-xs text-red-600">{errors.platform.message}</p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          카테고리
        </label>
        <Controller
          name="categoryId"
          control={control}
          render={({ field }) => (
            <select
              {...field}
              disabled={isSubmitting || isLoading || !selectedPlatform}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
              onChange={(e) => field.onChange(parseInt(e.target.value, 10) || 0)}
            >
              <option value={0}>카테고리 선택</option>
              {filteredCategories.map(cat => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
          )}
        />
        {!selectedPlatform && (
          <p className="mt-1 text-xs text-gray-500">플랫폼을 먼저 선택해주세요</p>
        )}
        {selectedPlatform && filteredCategories.length === 0 && (
          <p className="mt-1 text-xs text-gray-500">해당 플랫폼의 카테고리가 없습니다</p>
        )}
        {errors.categoryId && (
          <p className="mt-1 text-xs text-red-600">{errors.categoryId.message}</p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          수수료율 (소수점)
        </label>
        <Controller
          name="rate"
          control={control}
          render={({ field }) => (
            <input
              {...field}
              type="number"
              step="any"
              min="0"
              max="1"
              disabled={isSubmitting || isLoading}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
              placeholder="예: 0.05 (5%), 0.1 (10%), 0.15 (15%)"
              onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
            />
          )}
        />
        {errors.rate && (
          <p className="mt-1 text-xs text-red-600">{errors.rate.message}</p>
        )}
      </div>

      <div className="flex gap-3 pt-4 border-t">
        <button
          type="button"
          onClick={() => {
            if (!isEditMode) {
              reset();
            }
            onCancel();
          }}
          disabled={isSubmitting || isLoading || isDeletingRate}
          className="flex-1 px-4 py-2 text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300 disabled:opacity-50 transition-colors"
        >
          취소
        </button>
        <button
          type="submit"
          disabled={!isValid || isSubmitting || isLoading || isDeletingRate}
          className="flex-1 px-4 py-2 text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 transition-colors font-medium"
        >
          {isSubmitting || isLoading ? submitLoadingLabel : submitButtonLabel}
        </button>
        {isEditMode && onOpenDeleteConfirm && (
          <button
            type="button"
            onClick={onOpenDeleteConfirm}
            disabled={isSubmitting || isLoading || isDeletingRate}
            className="px-4 py-2 text-white bg-red-600 rounded-md hover:bg-red-700 disabled:opacity-50 transition-colors font-medium"
          >
            {isDeletingRate ? '삭제 중...' : '삭제'}
          </button>
        )}
      </div>
    </form>
  );
}
