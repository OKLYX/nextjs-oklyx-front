'use client';

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import type { Carrier } from '@/domain/entities/CarrierEntity';
import type { UpdateCarrierRequest } from '@/application/dto/CarrierDTOs';
import { Input } from '@/presentation/components/ui/Input';
import { Button } from '@/presentation/components/ui/Button';
import { Modal } from '@/presentation/components/ui/Modal';

/** 저장 버튼이 푸터(폼 밖)에 있어 `form` 속성으로 제출을 연결한다. */
const FORM_ID = 'edit-carrier-form';

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
    <Modal
      isOpen
      onClose={handleClose}
      title="택배사 수정"
      disableClose={isSubmitting}
      footer={
        <>
          <Button variant="secondary" onClick={handleClose} disabled={isSubmitting}>
            취소
          </Button>
          <Button type="submit" form={FORM_ID} isLoading={isSubmitting} loadingText="저장 중...">
            저장
          </Button>
        </>
      }
    >
      {submitError && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
          {submitError}
        </div>
      )}

      <form id={FORM_ID} onSubmit={handleSubmit(onFormSubmit)} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">택배사명</label>
              <Input
                {...register('name')}
                type="text"
                placeholder="예: CJ대한통운"
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
      </form>
    </Modal>
  );
}
