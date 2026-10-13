'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { AlertCircle } from 'lucide-react';
import {
  createMarketplaceAccountSchema,
  type CreateMarketplaceAccountForm,
} from '@/application/dto/MarketplaceAccountDTOs';
import type { TemplateOption } from '@/domain/entities/MarketplaceAccountEntity';

// Hardcoded for now; will be replaced with a managed platform list later.
const PLATFORM_OPTIONS = [
  { value: 'COUPANG', label: '쿠팡' },
  { value: 'NAVER', label: '네이버 스마트스토어' },
  { value: 'ELEVENST', label: '11번가' },
  { value: 'GMARKET', label: 'G마켓' },
];

interface ChannelRegistrationFormProps {
  isLoading?: boolean;
  onSubmit: (data: CreateMarketplaceAccountForm) => Promise<void>;
  onCancel: () => void;
  thumbTemplates?: TemplateOption[];
  detailTemplates?: TemplateOption[];
  templatesLoading?: boolean;
}

export function ChannelRegistrationForm({
  isLoading = false,
  onSubmit: externalOnSubmit,
  onCancel,
  thumbTemplates = [],
  detailTemplates = [],
  templatesLoading = false,
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
        <select
          {...register('platform')}
          id="platform"
          defaultValue=""
          disabled={isLoading}
          className="w-full px-3 py-2 border rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="" disabled>
            플랫폼을 선택하세요
          </option>
          {PLATFORM_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
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
        <label htmlFor="vendorUserId" className="block text-sm font-medium mb-1">
          WING 로그인 ID
        </label>
        <input
          {...register('vendorUserId')}
          id="vendorUserId"
          type="text"
          placeholder="쿠팡 상품등록 시 사용 (선택)"
          disabled={isLoading}
          className="w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        {formState.errors.vendorUserId && (
          <p className="mt-1 text-sm text-red-600">{formState.errors.vendorUserId.message}</p>
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

      <div>
        <label htmlFor="thumbnailTemplateId" className="block text-sm font-medium mb-1">
          썸네일 템플릿
        </label>
        <select
          {...register('thumbnailTemplateId')}
          id="thumbnailTemplateId"
          disabled={isLoading || templatesLoading}
          className="w-full px-3 py-2 border rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
        >
          <option value="">기본값 사용 (테넌트 기본 템플릿)</option>
          {thumbTemplates.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}{t.isDefault ? ' (기본)' : ''}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label htmlFor="detailTemplateId" className="block text-sm font-medium mb-1">
          상세 템플릿
        </label>
        <select
          {...register('detailTemplateId')}
          id="detailTemplateId"
          disabled={isLoading || templatesLoading}
          className="w-full px-3 py-2 border rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
        >
          <option value="">기본값 사용 (테넌트 기본 템플릿)</option>
          {detailTemplates.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}{t.isDefault ? ' (기본)' : ''}
            </option>
          ))}
        </select>
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
