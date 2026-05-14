'use client';

import { useState, useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import type { CreateCarrierRateRequest } from '@/application/dto/CreateCarrierRateRequest';
import type { UpdateCarrierRateRequest } from '@/application/dto/UpdateCarrierRateRequest';

const carrierRateSchema = z.object({
  carrier: z.string().min(1, '배송사를 입력하세요').max(100, '100자 이내'),
  type: z.string().min(1, '타입을 입력하세요').max(50, '50자 이내'),
  cost: z.string().refine((val) => !Number.isNaN(parseFloat(val)) && parseFloat(val) > 0, '비용은 양수여야 합니다'),
  effectiveDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD 형식'),
  isDefault: z.boolean(),
});

type CarrierRateFormData = z.infer<typeof carrierRateSchema>;

interface CarrierRateFormProps {
  isLoading: boolean;
  onSubmit: (data: CreateCarrierRateRequest | UpdateCarrierRateRequest) => Promise<void>;
  onCancel: () => void;
  initialData?: Partial<CarrierRateFormData>;
  submitButtonLabel?: string;
  submitLoadingLabel?: string;
}

export function CarrierRateForm({
  isLoading,
  onSubmit,
  onCancel,
  initialData,
  submitButtonLabel = '추가',
  submitLoadingLabel = '추가 중...',
}: CarrierRateFormProps) {
  const [requestError, setRequestError] = useState('');

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors, isValid, isValidating, isSubmitting },
  } = useForm<CarrierRateFormData>({
    resolver: zodResolver(carrierRateSchema),
    mode: 'onChange',
    defaultValues: {
      carrier: initialData?.carrier ?? '',
      type: initialData?.type ?? '',
      cost: initialData?.cost ?? '',
      effectiveDate: initialData?.effectiveDate ?? '',
      isDefault: initialData?.isDefault ?? false,
    },
  });

  useEffect(() => {
    if (initialData) {
      reset({
        carrier: initialData.carrier ?? '',
        type: initialData.type ?? '',
        cost: initialData.cost ?? '',
        effectiveDate: initialData.effectiveDate ?? '',
        isDefault: initialData.isDefault ?? false,
      });
    }
  }, [initialData, reset]);

  const onFormSubmit = handleSubmit(async (formData) => {
    setRequestError('');
    try {
      await onSubmit({
        ...formData,
        cost: parseFloat(formData.cost),
      });
      reset();
    } catch {
      const action = submitButtonLabel === '추가' ? '추가' : '수정';
      setRequestError(`택배비를 ${action}할 수 없습니다. 다시 시도해주세요.`);
    }
  });

  const handleCancel = () => {
    reset();
    onCancel();
  };

  return (
    <form onSubmit={onFormSubmit} className="space-y-4">
      {requestError && (
        <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">
          {requestError}
        </div>
      )}

      <div>
        <label htmlFor="carrier" className="block text-sm font-medium mb-1">
          배송사 *
        </label>
        <Controller
          name="carrier"
          control={control}
          render={({ field }) => (
            <>
              <input
                {...field}
                id="carrier"
                type="text"
                maxLength={100}
                disabled={isLoading}
                className="w-full px-3 py-2 border rounded-md"
              />
              {errors.carrier && (
                <p className="mt-1 text-sm text-red-600">{errors.carrier.message}</p>
              )}
            </>
          )}
        />
      </div>

      <div>
        <label htmlFor="type" className="block text-sm font-medium mb-1">
          타입 *
        </label>
        <Controller
          name="type"
          control={control}
          render={({ field }) => (
            <>
              <input
                {...field}
                id="type"
                type="text"
                maxLength={50}
                disabled={isLoading}
                className="w-full px-3 py-2 border rounded-md"
              />
              {errors.type && (
                <p className="mt-1 text-sm text-red-600">{errors.type.message}</p>
              )}
            </>
          )}
        />
      </div>

      <div>
        <label htmlFor="cost" className="block text-sm font-medium mb-1">
          비용 *
        </label>
        <Controller
          name="cost"
          control={control}
          render={({ field }) => (
            <>
              <input
                {...field}
                id="cost"
                type="number"
                step="0.01"
                disabled={isLoading}
                className="w-full px-3 py-2 border rounded-md"
              />
              {errors.cost && (
                <p className="mt-1 text-sm text-red-600">{errors.cost.message}</p>
              )}
            </>
          )}
        />
      </div>

      <div>
        <label htmlFor="effectiveDate" className="block text-sm font-medium mb-1">
          유효일 (YYYY-MM-DD) *
        </label>
        <Controller
          name="effectiveDate"
          control={control}
          render={({ field }) => (
            <>
              <input
                {...field}
                id="effectiveDate"
                type="date"
                value={field.value || ''}
                disabled={isLoading}
                className="w-full px-3 py-2 border rounded-md"
              />
              {errors.effectiveDate && (
                <p className="mt-1 text-sm text-red-600">{errors.effectiveDate.message}</p>
              )}
            </>
          )}
        />
      </div>

      <div className="flex items-center">
        <Controller
          name="isDefault"
          control={control}
          render={({ field: { value, onChange } }) => (
            <label className="flex items-center gap-2">
              <input
                id="isDefault"
                type="checkbox"
                checked={value || false}
                onChange={(e) => onChange(e.target.checked)}
                disabled={isLoading}
                className="w-4 h-4"
              />
              <span className="text-sm font-medium">기본값으로 설정</span>
            </label>
          )}
        />
      </div>

      <div className="flex justify-end gap-3 pt-4 border-t">
        <button
          type="button"
          onClick={handleCancel}
          disabled={isLoading || isSubmitting}
          className="px-4 py-2 text-sm font-medium border rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          취소
        </button>
        <button
          type="submit"
          disabled={isLoading || !isValid || isValidating || isSubmitting}
          className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSubmitting ? submitLoadingLabel : submitButtonLabel}
        </button>
      </div>
    </form>
  );
}
