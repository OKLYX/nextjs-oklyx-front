'use client';

import { useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import type { CreatePackageRequest } from '@/application/dto/CreatePackageRequest';

const packageInputSchema = z.object({
  type: z.string().min(1, '패키지 타입을 입력하세요').max(50, '50자 이내'),
  cost: z.number().min(0, '비용은 0 이상이어야 합니다'),
  widthCm: z
    .number()
    .min(0.1, '0.1cm 이상 입력하세요')
    .max(999.9, '999.9cm 이하로 입력하세요')
    .refine((v) => Number(v.toFixed(1)) === v, '소수점 첫째 자리까지 입력하세요'),
  lengthCm: z
    .number()
    .min(0.1, '0.1cm 이상 입력하세요')
    .max(999.9, '999.9cm 이하로 입력하세요')
    .refine((v) => Number(v.toFixed(1)) === v, '소수점 첫째 자리까지 입력하세요'),
  heightCm: z
    .number()
    .min(0.1, '0.1cm 이상 입력하세요')
    .max(999.9, '999.9cm 이하로 입력하세요')
    .refine((v) => Number(v.toFixed(1)) === v, '소수점 첫째 자리까지 입력하세요'),
  effectiveDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD 형식'),
  isDefault: z.boolean(),
});

type PackageInputFormData = z.infer<typeof packageInputSchema>;

interface PackageInputFormProps {
  onSubmit: (data: CreatePackageRequest) => Promise<void>;
  onCancel: () => void;
  isLoading: boolean;
}

export function PackageInputForm({
  onSubmit,
  onCancel,
  isLoading,
}: PackageInputFormProps) {
  const [requestError, setRequestError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors, isValid },
  } = useForm<PackageInputFormData>({
    resolver: zodResolver(packageInputSchema),
    mode: 'onChange',
    defaultValues: {
      type: '',
      cost: 0,
      widthCm: 0,
      lengthCm: 0,
      heightCm: 0,
      effectiveDate: '',
      isDefault: false,
    },
  });

  const handleFormSubmit = async (data: PackageInputFormData) => {
    setIsSubmitting(true);
    setRequestError('');
    try {
      const createData: CreatePackageRequest = {
        type: data.type,
        cost: data.cost,
        widthCm: data.widthCm,
        lengthCm: data.lengthCm,
        heightCm: data.heightCm,
        effectiveDate: data.effectiveDate,
        isDefault: data.isDefault,
      };
      await onSubmit(createData);
      reset();
    } catch (err) {
      const error = err as { response?: { status: number }; message?: string };
      const errorMessage =
        error?.response?.status === 400
          ? '입력값을 확인해주세요.'
          : error?.response?.status === 403
            ? '권한이 없습니다.'
            : error?.response?.status === 500
              ? '서버 오류가 발생했습니다.'
              : error?.message === 'Network Error'
                ? '네트워크 연결을 확인해주세요.'
                : '상자비 추가에 실패했습니다.';
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
          패키지 타입
        </label>
        <Controller
          name="type"
          control={control}
          render={({ field }) => (
            <input
              {...field}
              type="text"
              disabled={isSubmitting || isLoading}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
              placeholder="패키지 타입 입력 (예: A-36, B-120)"
            />
          )}
        />
        {errors.type && (
          <p className="mt-1 text-xs text-red-600">{errors.type.message}</p>
        )}
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            가로 (cm)
          </label>
          <Controller
            name="widthCm"
            control={control}
            render={({ field }) => (
              <input
                {...field}
                value={field.value === 0 ? '' : field.value}
                type="number"
                step="0.1"
                min="0.1"
                max="999.9"
                onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                disabled={isSubmitting || isLoading}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
              />
            )}
          />
          {errors.widthCm && (
            <p className="mt-1 text-xs text-red-600">{errors.widthCm.message}</p>
          )}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            세로 (cm)
          </label>
          <Controller
            name="lengthCm"
            control={control}
            render={({ field }) => (
              <input
                {...field}
                value={field.value === 0 ? '' : field.value}
                type="number"
                step="0.1"
                min="0.1"
                max="999.9"
                onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                disabled={isSubmitting || isLoading}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
              />
            )}
          />
          {errors.lengthCm && (
            <p className="mt-1 text-xs text-red-600">{errors.lengthCm.message}</p>
          )}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            높이 (cm)
          </label>
          <Controller
            name="heightCm"
            control={control}
            render={({ field }) => (
              <input
                {...field}
                value={field.value === 0 ? '' : field.value}
                type="number"
                step="0.1"
                min="0.1"
                max="999.9"
                onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                disabled={isSubmitting || isLoading}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
              />
            )}
          />
          {errors.heightCm && (
            <p className="mt-1 text-xs text-red-600">{errors.heightCm.message}</p>
          )}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          비용 (원)
        </label>
        <Controller
          name="cost"
          control={control}
          render={({ field }) => (
            <input
              {...field}
              type="number"
              disabled={isSubmitting || isLoading}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
              placeholder="비용 입력"
              step="0.01"
              min="0"
              onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
            />
          )}
        />
        {errors.cost && (
          <p className="mt-1 text-xs text-red-600">{errors.cost.message}</p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          유효일
        </label>
        <Controller
          name="effectiveDate"
          control={control}
          render={({ field }) => (
            <input
              {...field}
              type="date"
              disabled={isSubmitting || isLoading}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
            />
          )}
        />
        {errors.effectiveDate && (
          <p className="mt-1 text-xs text-red-600">
            {errors.effectiveDate.message}
          </p>
        )}
      </div>

      <div className="flex items-center">
        <Controller
          name="isDefault"
          control={control}
          render={({ field }) => (
            <input
              type="checkbox"
              checked={field.value}
              onChange={field.onChange}
              onBlur={field.onBlur}
              disabled={isSubmitting || isLoading}
              className="w-4 h-4 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
            />
          )}
        />
        <label className="ml-2 text-sm font-medium text-gray-700">기본값</label>
      </div>

      <div className="flex gap-3 pt-4 border-t">
        <button
          type="button"
          onClick={() => {
            reset();
            onCancel();
          }}
          disabled={isSubmitting || isLoading}
          className="flex-1 px-4 py-2 text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300 disabled:opacity-50 transition-colors"
        >
          취소
        </button>
        <button
          type="submit"
          disabled={!isValid || isSubmitting || isLoading}
          className="flex-1 px-4 py-2 text-white bg-blue-500 rounded-md hover:bg-blue-600 disabled:opacity-50 transition-colors"
        >
          {isSubmitting || isLoading ? '추가 중...' : '추가'}
        </button>
      </div>
    </form>
  );
}
