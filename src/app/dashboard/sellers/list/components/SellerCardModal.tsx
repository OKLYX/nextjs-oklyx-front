'use client';

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import type { SellerCard } from '@/domain/entities/SellerCardEntity';
import { extractErrorMessage } from '@/infrastructure/utils/errorMessage';
import { Button } from '@/presentation/components/ui/Button';
import { Input } from '@/presentation/components/ui/Input';
import { Modal } from '@/presentation/components/ui/Modal';

/**
 * Register or edit one payment card of a seller (FEATURE_2610_18 D52 · D91 · D92).
 *
 * `card` null = register, a card = edit (alias and masked number only — the owner seller stays).
 * The server rejects 13 or more digits in a row with 「가려진 번호만 넣으세요」; that text shows in the popup.
 */
const FORM_ID = 'seller-card-form';

const schema = z.object({
  alias: z.string().trim().min(1, '별칭을 입력하세요.').max(50, '별칭은 50자 이하로 입력하세요.'),
  maskedNumber: z.string().trim().min(1, '가려진 번호를 입력하세요.').max(30, '가려진 번호는 30자 이하로 입력하세요.'),
});
type FormData = z.infer<typeof schema>;

interface SellerCardModalProps {
  isOpen: boolean;
  sellerName: string;
  card: SellerCard | null;
  onClose: () => void;
  onSubmit: (data: FormData) => Promise<void>;
}

export function SellerCardModal({ isOpen, sellerName, card, onClose, onSubmit }: SellerCardModalProps) {
  const [submitError, setSubmitError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormData>({ resolver: zodResolver(schema), defaultValues: { alias: '', maskedNumber: '' } });

  useEffect(() => {
    if (!isOpen) return;
    void (async () => {
      reset({ alias: card?.alias ?? '', maskedNumber: card?.maskedNumber ?? '' });
      setSubmitError('');
    })();
  }, [isOpen, card, reset]);

  if (!isOpen) return null;

  const submit = async (data: FormData) => {
    setSubmitError('');
    setIsSubmitting(true);
    try {
      await onSubmit(data);
    } catch (err) {
      setSubmitError(extractErrorMessage(err, '카드를 저장하지 못했습니다.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={card ? `카드 수정 — ${sellerName}` : `카드 추가 — ${sellerName}`}
      disableClose={isSubmitting}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={isSubmitting}>
            취소
          </Button>
          <Button type="submit" form={FORM_ID} isLoading={isSubmitting} loadingText="저장 중...">
            저장
          </Button>
        </>
      }
    >
      <form id={FORM_ID} onSubmit={handleSubmit(submit)} className="space-y-4">
        {submitError && (
          <div className="p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">{submitError}</div>
        )}
        <Input label="별칭" error={errors.alias?.message} disabled={isSubmitting} {...register('alias')} />
        <Input
          label="가려진 번호"
          error={errors.maskedNumber?.message}
          hint="영수증에 찍힌 그대로 넣으세요. 예: 1234-56**-****-3456"
          disabled={isSubmitting}
          {...register('maskedNumber')}
        />
      </form>
    </Modal>
  );
}
