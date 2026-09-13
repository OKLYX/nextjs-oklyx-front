'use client';

import { useState, useEffect } from 'react';
import { useForm, useWatch, Controller } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import type { Package } from '@/domain/entities/PackageEntity';
import { BOX_KIND_LABEL, boxKindOf } from '@/domain/entities/PackageEntity';
import type { UpdatePackageRequest } from '@/application/dto/UpdatePackageRequest';
import { DeleteConfirmationDialog } from './DeleteConfirmationDialog';
import { Button } from '@/presentation/components/ui/Button';
import { Modal } from '@/presentation/components/ui/Modal';
import { BoxShape } from '@/presentation/components/BoxShape';
import { sizeIsUnset } from './packageSize';

/**
 * 🔴 비용·기본값 규칙이 **유형에 따라 갈린다**(PLAN 2609_40 D20 · D21).
 * - 구매 상자: 비용 > 0 (0 이면 서버가 400)
 * - 재활용 상자: 비용 0 이 정상이고, **기본 상자로 지정할 수 없다**(서버 400)
 */
const packageSchema = z
  .object({
    boxKind: z.enum(['PURCHASED', 'RECYCLED']),
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
  })
  .refine((v) => v.boxKind === 'RECYCLED' || v.cost > 0, {
    path: ['cost'],
    message: '구매 상자의 비용은 0보다 커야 합니다',
  })
  .refine((v) => !(v.boxKind === 'RECYCLED' && v.isDefault), {
    path: ['isDefault'],
    message: '재활용 상자는 기본 상자로 지정할 수 없습니다',
  });

type PackageFormData = z.infer<typeof packageSchema>;

/**
 * 저장 버튼은 `ui/Modal` 푸터(폼 밖)에 있고 `form={FORM_ID}` 로 이 폼에 연결된다.
 * (팝업 규칙 — 푸터는 Modal 이 소유한다)
 */
const FORM_ID = 'package-details-form';

interface PackageDetailsModalProps {
  isOpen: boolean;
  pkg: Package | null;
  onClose: () => void;
  /** 이미지를 골랐으면 파일도 함께 올라간다(업로드는 전용 엔드포인트) */
  onSubmit: (data: UpdatePackageRequest, imageFile: File | null) => Promise<void>;
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
  // 이미지 선택 — 값이 DOM 컨트롤 비교로는 잡히지 않으므로 Modal 에 isDirty 로 직접 알려준다.
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState('');

  const {
    control,
    handleSubmit,
    reset,
    setValue,
    trigger,
    formState: { errors, isValid },
  } = useForm<PackageFormData>({
    resolver: zodResolver(packageSchema),
    mode: 'onChange',
    defaultValues: {
      boxKind: 'PURCHASED',
      type: '',
      cost: 0,
      widthCm: 0,
      lengthCm: 0,
      heightCm: 0,
      effectiveDate: '',
      isDefault: false,
    },
  });

  useEffect(() => {
    if (pkg && isOpen) {
      reset({
        boxKind: boxKindOf(pkg),
        type: pkg.type,
        cost: pkg.cost,
        widthCm: pkg.widthCm,
        lengthCm: pkg.lengthCm,
        heightCm: pkg.heightCm,
        effectiveDate: pkg.effectiveDate,
        isDefault: pkg.isDefault,
      });
    }
  }, [pkg, isOpen, reset]);

  // watch() 대신 useWatch — watch() 는 React Compiler 메모이제이션을 통째로 끈다.
  const boxKind = useWatch({ control, name: 'boxKind' });
  const isRecycled = boxKind === 'RECYCLED';

  const pickImage = (file: File | null) => {
    setPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return file ? URL.createObjectURL(file) : '';
    });
    setImageFile(file);
  };

  // 닫기 경로(취소 · ✕ · ESC)는 전부 여기를 지난다 — 고른 파일을 남기지 않는다.
  const handleClose = () => {
    pickImage(null);
    setRequestError('');
    onClose();
  };

  const handleFormSubmit = async (data: PackageFormData) => {
    setIsSubmitting(true);
    setRequestError('');
    try {
      const updateData: UpdatePackageRequest = {
        boxKind: data.boxKind,
        type: data.type,
        cost: data.cost,
        widthCm: data.widthCm,
        lengthCm: data.lengthCm,
        heightCm: data.heightCm,
        effectiveDate: data.effectiveDate,
        isDefault: data.isDefault,
      };
      await onSubmit(updateData, imageFile);
      pickImage(null);
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

  const busy = isSubmitting || isLoading || isDeleting;

  return (
    <Modal
      isOpen
      onClose={handleClose}
      title="상자비 수정"
      disableClose={isSubmitting || isLoading}
      isDirty={imageFile !== null}
      footer={
        <>
          <Button
            type="button"
            onClick={handleDeleteClick}
            disabled={busy}
            variant="danger"
          >
            {isDeleting ? '삭제 중...' : '삭제'}
          </Button>
          <button
            type="button"
            onClick={handleClose}
            disabled={busy}
            className="px-4 py-2 text-gray-700 bg-gray-200 rounded-md hover:bg-gray-300 disabled:opacity-50 transition-colors"
          >
            취소
          </button>
          <button
            type="submit"
            form={FORM_ID}
            disabled={!isValid || busy}
            className="px-4 py-2 text-white bg-blue-500 rounded-md hover:bg-blue-600 disabled:opacity-50 transition-colors"
          >
            {isSubmitting || isLoading ? '저장 중...' : '수정'}
          </button>
        </>
      }
    >
      <p className="text-xs text-gray-500">ID: {pkg.id}</p>

      {requestError && (
        <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded text-sm text-red-800">
          {requestError}
        </div>
      )}

      {deleteError && (
        <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded text-sm text-red-800">
          {deleteError}
        </div>
      )}

      {sizeIsUnset(pkg) && (
        <p className="mt-2 text-xs text-amber-700">
          사이즈가 등록되지 않은 상자입니다. 값을 입력해야 저장할 수 있습니다.
        </p>
      )}

      <form id={FORM_ID} onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4 py-4">
        {/* 상자 사진 — 없으면 치수 도형(PLAN 2609_40 D26). 업로드는 저장 시 함께 전송된다 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">상자 사진</label>
          <div className="flex items-center gap-4">
            <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded border border-gray-200 bg-gray-50">
              {previewUrl || pkg.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={previewUrl || (pkg.imageUrl as string)}
                  alt="상자 사진"
                  className="h-full w-full rounded object-contain"
                />
              ) : (
                <BoxShape
                  widthCm={pkg.widthCm}
                  lengthCm={pkg.lengthCm}
                  heightCm={pkg.heightCm}
                  size={56}
                />
              )}
            </div>
            <div className="min-w-0">
              <input
                type="file"
                accept="image/*"
                disabled={busy}
                onChange={(e) => pickImage(e.target.files?.[0] ?? null)}
                className="block w-full text-sm text-gray-700 file:mr-3 file:rounded file:border-0 file:bg-gray-200 file:px-3 file:py-1.5 file:text-sm file:text-gray-700 hover:file:bg-gray-300 disabled:opacity-50"
              />
              <p className="mt-1 text-xs text-gray-500">
                {imageFile
                  ? '저장을 누르면 사진이 올라갑니다.'
                  : '사진이 없으면 치수대로 그린 도형으로 표시됩니다.'}
              </p>
            </div>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">유형</label>
          <Controller
            name="boxKind"
            control={control}
            render={({ field }) => (
              <select
                {...field}
                disabled={busy}
                onChange={(e) => {
                  const next = e.target.value as PackageFormData['boxKind'];
                  field.onChange(next);
                  // 재활용은 비용 0 · 기본 상자 해제가 강제다(서버 400). 유형을 바꾼 즉시 따라간다.
                  if (next === 'RECYCLED') {
                    setValue('cost', 0);
                    setValue('isDefault', false);
                  }
                  void trigger(['cost', 'isDefault']);
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
              >
                <option value="PURCHASED">{BOX_KIND_LABEL.PURCHASED}</option>
                <option value="RECYCLED">{BOX_KIND_LABEL.RECYCLED}</option>
              </select>
            )}
          />
          <p className="mt-1 text-xs text-gray-500">
            재활용 상자는 비용 0 이 정상이고 판매가 계산 목록에 뜨지 않습니다.
          </p>
        </div>

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
                disabled={isSubmitting || isLoading || isRecycled}
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

        <div>
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
                  disabled={isSubmitting || isLoading || isRecycled}
                  className="w-4 h-4 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                />
              )}
            />
            <label
              className={`ml-2 text-sm font-medium ${isRecycled ? 'text-gray-400' : 'text-gray-700'}`}
            >
              기본값
            </label>
          </div>
          {isRecycled && (
            <p className="mt-1 text-xs text-gray-500">
              재활용 상자는 기본 상자로 지정할 수 없습니다.
            </p>
          )}
          {errors.isDefault && (
            <p className="mt-1 text-xs text-red-600">{errors.isDefault.message}</p>
          )}
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
