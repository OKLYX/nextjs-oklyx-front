'use client';

import { useState, useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import type { Package } from '@/domain/entities/PackageEntity';
import type { UpdatePackageRequest } from '@/application/dto/UpdatePackageRequest';
import { DeleteConfirmationDialog } from './DeleteConfirmationDialog';
import { Button } from '@/presentation/components/ui/Button';
import { Modal } from '@/presentation/components/ui/Modal';

const packageSchema = z.object({
  type: z.string().min(1, '패키지 타입을 입력하세요').max(50, '50자 이내'),
  cost: z.number().min(0, '비용은 0 이상이어야 합니다'),
  effectiveDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD 형식'),
  isDefault: z.boolean(),
});

type PackageFormData = z.infer<typeof packageSchema>;

interface PackageDetailsModalProps {
  isOpen: boolean;
  pkg: Package | null;
  onClose: () => void;
  onSubmit: (data: UpdatePackageRequest) => Promise<void>;
  onDelete: () => Promise<void>;
  isLoading: boolean;
  isDeleting: boolean;
}

export function PackageDetailsModal({
  isOpen,
  pkg,
  onClose,
  onSubmit,
  onDelete,
  isLoading,
  isDeleting,
}: PackageDetailsModalProps) {
  const [requestError, setRequestError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors, isValid },
  } = useForm<PackageFormData>({
    resolver: zodResolver(packageSchema),
    mode: 'onChange',
    defaultValues: {
      type: '',
      cost: 0,
      effectiveDate: '',
      isDefault: false,
    },
  });

  useEffect(() => {
    if (pkg && isOpen) {
      reset({
        type: pkg.type,
        cost: pkg.cost,
        effectiveDate: pkg.effectiveDate,
        isDefault: pkg.isDefault,
      });
    }
  }, [pkg, isOpen, reset]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen && !isSubmitting && !isLoading) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isOpen, isSubmitting, isLoading, onClose]);

  const handleFormSubmit = async (data: PackageFormData) => {
    setIsSubmitting(true);
    setRequestError('');
    try {
      const updateData: UpdatePackageRequest = {
        type: data.type,
        cost: data.cost,
        effectiveDate: data.effectiveDate,
        isDefault: data.isDefault,
      };
      await onSubmit(updateData);
    } catch (err) {
      const error = err as { response?: { status: number }; message?: string };
      const errorMessage = error?.response?.status === 400
        ? '입력값을 확인해주세요.'
        : error?.response?.status === 403
        ? '권한이 없습니다.'
        : error?.response?.status === 404
        ? '상자비 정보를 찾을 수 없습니다.'
        : error?.response?.status === 500
        ? '서버 오류가 발생했습니다.'
        : error?.message === 'Network Error'
        ? '네트워크 연결을 확인해주세요.'
        : '상자비 수정에 실패했습니다.';
      setRequestError(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteClick = () => {
    setDeleteError('');
    setIsDeleteDialogOpen(true);
  };

  const handleConfirmDelete = async () => {
    try {
      setDeleteError('');
      await onDelete();
      setIsDeleteDialogOpen(false);
    } catch (err) {
      const error = err as { response?: { data?: { message?: string } }; message?: string };
      const errorMessage = error?.response?.data?.message || '상자비 삭제에 실패했습니다.';
      setDeleteError(errorMessage);
      setIsDeleteDialogOpen(false);
    }
  };

  if (!isOpen || !pkg) {
    return null;
  }

  return (
    <Modal
      isOpen
      onClose={onClose}
      title="상자비 수정"
      disableClose={isSubmitting || isLoading}
    >
      <p className="text-xs text-gray-500 mt-1">ID: {pkg.id}</p>

      {requestError && (
        <div className="mx-6 mt-4 p-3 bg-red-50 border border-red-200 rounded text-sm text-red-800">
          {requestError}
        </div>
      )}

      {deleteError && (
        <div className="mx-6 mt-4 p-3 bg-red-50 border border-red-200 rounded text-sm text-red-800">
          {deleteError}
        </div>
      )}

      <form onSubmit={handleSubmit(handleFormSubmit)} className="p-6 space-y-4">
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
            <p className="mt-1 text-xs text-red-600">{errors.effectiveDate.message}</p>
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
              onClose();
            }}
            disabled={isSubmitting || isLoading || isDeleting}
            className="flex-1 px-4 py-2 text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300 disabled:opacity-50 transition-colors"
          >
            취소
          </button>
          <button
            type="submit"
            disabled={!isValid || isSubmitting || isLoading || isDeleting}
            className="flex-1 px-4 py-2 text-white bg-blue-500 rounded-md hover:bg-blue-600 disabled:opacity-50 transition-colors"
          >
            {isSubmitting || isLoading ? '저장 중...' : '수정'}
          </button>
          <Button
            type="button"
            onClick={handleDeleteClick}
            disabled={isSubmitting || isLoading || isDeleting}
            variant="danger"
          >
            {isDeleting ? '삭제 중...' : '삭제'}
          </Button>
        </div>
      </form>

      <DeleteConfirmationDialog
        isOpen={isDeleteDialogOpen}
        packageName={pkg?.type}
        isLoading={isDeleting}
        onConfirm={handleConfirmDelete}
        onCancel={() => setIsDeleteDialogOpen(false)}
      />
    </Modal>
  );
}
