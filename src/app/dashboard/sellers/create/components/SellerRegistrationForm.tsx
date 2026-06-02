'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { AlertCircle } from 'lucide-react';
import { createSellerSchema, type CreateSellerRequest } from '@/application/dto/SellerDTOs';
import { SellerUseCase } from '@/application/usecases/SellerUseCase';
import { SellerRepositoryImpl } from '@/infrastructure/repositories/SellerRepositoryImpl';

interface SellerRegistrationFormProps {
  isLoading?: boolean;
  onSubmit?: (data: CreateSellerRequest) => Promise<void>;
  onCancel?: () => void;
}

export function SellerRegistrationForm({
  isLoading: externalIsLoading = false,
  onSubmit: externalOnSubmit,
  onCancel: externalOnCancel,
}: SellerRegistrationFormProps = {}) {
  const router = useRouter();
  const [internalIsLoading, setInternalIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isLoading = externalIsLoading || internalIsLoading;

  const useCase = useMemo(() => {
    const repository = new SellerRepositoryImpl();
    return new SellerUseCase(repository);
  }, []);

  const form = useForm<CreateSellerRequest>({
    resolver: zodResolver(createSellerSchema),
    mode: 'onBlur',
  });

  const { register, handleSubmit, formState } = form;

  const onSubmit = async (data: CreateSellerRequest) => {
    try {
      setInternalIsLoading(true);
      setError(null);

      if (externalOnSubmit) {
        await externalOnSubmit(data);
      } else {
        await useCase.create(data);
        router.push('/dashboard/sellers');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : '판매자 등록에 실패했습니다';
      setError(message);
    } finally {
      setInternalIsLoading(false);
    }
  };

  const handleCancel = () => {
    if (externalOnCancel) {
      externalOnCancel();
    } else {
      router.back();
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {error && (
        <div className="rounded-md bg-red-50 p-3 text-sm text-red-700 flex items-start gap-2">
          <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
          <div>{error}</div>
        </div>
      )}

      <div>
        <label htmlFor="sellerName" className="block text-sm font-medium mb-1">
          판매자명 <span className="text-red-600">*</span>
        </label>
        <input
          {...register('sellerName')}
          id="sellerName"
          type="text"
          placeholder="판매자명을 입력하세요"
          disabled={isLoading}
          className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        {formState.errors.sellerName && (
          <p className="mt-1 text-sm text-red-600">{formState.errors.sellerName.message}</p>
        )}
      </div>

      <div>
        <label htmlFor="businessRegistration" className="block text-sm font-medium mb-1">
          사업자등록번호 <span className="text-red-600">*</span>
        </label>
        <input
          {...register('businessRegistration')}
          id="businessRegistration"
          type="text"
          placeholder="사업자등록번호를 입력하세요"
          disabled={isLoading}
          className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        {formState.errors.businessRegistration && (
          <p className="mt-1 text-sm text-red-600">{formState.errors.businessRegistration.message}</p>
        )}
      </div>

      <div className="flex gap-2 pt-2">
        <button
          type="button"
          onClick={handleCancel}
          disabled={isLoading}
          className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          취소
        </button>
        <button
          type="submit"
          disabled={isLoading || !formState.isValid}
          className="flex-1 px-3 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
        >
          {isLoading ? (
            <>
              <div className="h-3 w-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
              등록 중...
            </>
          ) : (
            '등록'
          )}
        </button>
      </div>
    </form>
  );
}
