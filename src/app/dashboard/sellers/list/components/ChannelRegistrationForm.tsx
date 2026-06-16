'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { AlertCircle } from 'lucide-react';
import {
  createMarketplaceAccountSchema,
  type CreateMarketplaceAccountForm,
} from '@/application/dto/MarketplaceAccountDTOs';

interface ChannelRegistrationFormProps {
  isLoading?: boolean;
  onSubmit: (data: CreateMarketplaceAccountForm) => Promise<void>;
  onCancel: () => void;
}

export function ChannelRegistrationForm({
  isLoading = false,
  onSubmit: externalOnSubmit,
  onCancel,
}: ChannelRegistrationFormProps) {
  const [error, setError] = useState<string | null>(null);

  const { register, handleSubmit, formState } = useForm<CreateMarketplaceAccountForm>({
    resolver: zodResolver(createMarketplaceAccountSchema),
    mode: 'onBlur',
  });

  const onSubmit = async (data: CreateMarketplaceAccountForm) => {
    try {
      setError(null);
      await externalOnSubmit(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : '판매채널 등록에 실패했습니다';
      setError(message);
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
        <label htmlFor="platform" className="block text-sm font-medium mb-1">
          플랫폼 <span className="text-red-600">*</span>
        </label>
        <input
          {...register('platform')}
          id="platform"
          type="text"
          placeholder="예: COUPANG"
          disabled={isLoading}
          className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        {formState.errors.platform && (
          <p className="mt-1 text-sm text-red-600">{formState.errors.platform.message}</p>
        )}
      </div>

      <div>
        <label htmlFor="accountAlias" className="block text-sm font-medium mb-1">
          계정 별칭
        </label>
        <input
          {...register('accountAlias')}
          id="accountAlias"
          type="text"
          placeholder="예: 쿠팡 본점"
          disabled={isLoading}
          className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        {formState.errors.accountAlias && (
          <p className="mt-1 text-sm text-red-600">{formState.errors.accountAlias.message}</p>
        )}
      </div>

      <div>
        <label htmlFor="vendorId" className="block text-sm font-medium mb-1">
          판매자(벤더) ID <span className="text-red-600">*</span>
        </label>
        <input
          {...register('vendorId')}
          id="vendorId"
          type="text"
          placeholder="예: A00012345"
          disabled={isLoading}
          className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        {formState.errors.vendorId && (
          <p className="mt-1 text-sm text-red-600">{formState.errors.vendorId.message}</p>
        )}
      </div>

      <div>
        <label htmlFor="accessKey" className="block text-sm font-medium mb-1">
          Access Key <span className="text-red-600">*</span>
        </label>
        <input
          {...register('accessKey')}
          id="accessKey"
          type="text"
          placeholder="Access Key를 입력하세요"
          disabled={isLoading}
          className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        {formState.errors.accessKey && (
          <p className="mt-1 text-sm text-red-600">{formState.errors.accessKey.message}</p>
        )}
      </div>

      <div>
        <label htmlFor="secretKey" className="block text-sm font-medium mb-1">
          Secret Key <span className="text-red-600">*</span>
        </label>
        <input
          {...register('secretKey')}
          id="secretKey"
          type="password"
          placeholder="Secret Key를 입력하세요"
          disabled={isLoading}
          className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        {formState.errors.secretKey && (
          <p className="mt-1 text-sm text-red-600">{formState.errors.secretKey.message}</p>
        )}
      </div>

      <div className="flex gap-2 pt-2">
        <button
          type="button"
          onClick={onCancel}
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
