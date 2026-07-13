'use client';

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import type { Carrier } from '@/domain/entities/CarrierEntity';
import type { UpdateCarrierRequest } from '@/application/dto/CarrierDTOs';

const schema = z.object({
  name: z.string().min(1, '택배사명은 필수입니다.').max(100),
  isActive: z.boolean(),
});

type FormData = z.infer<typeof schema>;

interface EditCarrierModalProps {
  carrier: Carrier | null;
  onClose: () => void;
  onSubmit: (id: number, data: UpdateCarrierRequest) => Promise<void>;
  isSubmitting: boolean;
}

export function EditCarrierModal({
  carrier,
  onClose,
  onSubmit,
  isSubmitting,
}: EditCarrierModalProps) {
  const [submitError, setSubmitError] = useState('');

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { name: '', isActive: true },
  });

  useEffect(() => {
    if (carrier) {
      reset({ name: carrier.name, isActive: carrier.isActive });
    }
  }, [carrier, reset]);

  if (!carrier) return null;

  const handleClose = () => {
    setSubmitError('');
    onClose();
  };

  const onFormSubmit = async (data: FormData) => {
    setSubmitError('');
    try {
      await onSubmit(carrier.id, data);
    } catch {
      setSubmitError('수정에 실패했습니다. 다시 시도해주세요.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-lg shadow-lg max-w-md w-full mx-4">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold">택배사 수정</h2>
          <button
            onClick={handleClose}
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
              <label className="block text-sm font-medium text-gray-700 mb-1">택배사명</label>
              <input
                {...register('name')}
                type="text"
                placeholder="예: CJ대한통운"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {errors.name && (
                <p className="mt-1 text-xs text-red-600">{errors.name.message}</p>
              )}
            </div>

            <div className="flex items-center gap-2">
              <input
                {...register('isActive')}
                id="edit-carrier-active"
                type="checkbox"
                className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <label htmlFor="edit-carrier-active" className="text-sm text-gray-700">
                활성 상태
              </label>
            </div>

            <div className="flex gap-2 justify-end pt-4 border-t border-gray-200">
              <button
                type="button"
                onClick={handleClose}
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
