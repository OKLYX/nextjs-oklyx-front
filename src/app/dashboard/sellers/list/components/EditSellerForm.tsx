'use client';

import { useState, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { AlertCircle } from 'lucide-react';
import { createSellerSchema, type CreateSellerRequest } from '@/application/dto/SellerDTOs';
import { SellerUseCase } from '@/application/usecases/SellerUseCase';
import { SellerRepositoryImpl } from '@/infrastructure/repositories/SellerRepositoryImpl';
import type { Seller } from '@/domain/entities/SellerEntity';
import type { OptionCheckSuffixConfig } from '@/domain/entities/OptionCheckSuffix';
import { OptionCheckSuffixControl } from '@/presentation/components/OptionCheckSuffixControl';

interface EditSellerFormProps {
  seller: Seller | null;
  isLoading?: boolean;
  onSubmit?: (data: CreateSellerRequest) => Promise<void>;
  onCancel?: () => void;
}

export function EditSellerForm({
  seller,
  isLoading: externalIsLoading = false,
  onSubmit: externalOnSubmit,
  onCancel: externalOnCancel,
}: EditSellerFormProps) {
  const [internalIsLoading, setInternalIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // "옵션확인" 접미사 판매자 기본값 — RHF 밖 독립 state·독립 저장.
  const [suffixConfig, setSuffixConfig] = useState<OptionCheckSuffixConfig>({
    optionCheckSuffixEnabled: seller?.optionCheckSuffixEnabled ?? null,
    optionCheckSuffix: seller?.optionCheckSuffix ?? null,
  });
  const [isSavingSuffix, setIsSavingSuffix] = useState(false);
  const [suffixError, setSuffixError] = useState<string | null>(null);
  const [suffixSaved, setSuffixSaved] = useState(false);

  const isLoading = externalIsLoading || internalIsLoading;

  const useCase = useMemo(() => {
    const repository = new SellerRepositoryImpl();
    return new SellerUseCase(repository);
  }, []);

  const form = useForm<CreateSellerRequest>({
    resolver: zodResolver(createSellerSchema),
    mode: 'onBlur',
    defaultValues: seller ? {
      sellerName: seller.sellerName,
      businessRegistration: seller.businessRegistration,
    } : undefined,
  });

  const { register, handleSubmit, formState } = form;

  const onSubmitForm = async (data: CreateSellerRequest) => {
    if (!seller) return;

    try {
      setInternalIsLoading(true);
      setError(null);

      if (externalOnSubmit) {
        await externalOnSubmit(data);
      } else {
        await useCase.update(seller.id, data);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : '판매자 수정에 실패했습니다';
      setError(message);
    } finally {
      setInternalIsLoading(false);
    }
  };

  const handleCancel = () => {
    if (externalOnCancel) {
      externalOnCancel();
    }
  };

  const handleSaveSuffix = async () => {
    if (!seller) return;

    try {
      setIsSavingSuffix(true);
      setSuffixError(null);
      setSuffixSaved(false);
      await useCase.updateRegistrationNameSuffix(seller.id, {
        enabled: suffixConfig.optionCheckSuffixEnabled,
        suffix: suffixConfig.optionCheckSuffix,
      });
      setSuffixSaved(true);
      // Transient confirmation — auto-dismiss (project has no toast system).
      setTimeout(() => setSuffixSaved(false), 2500);
    } catch (err) {
      const message = err instanceof Error ? err.message : '추가 문구 저장에 실패했습니다';
      setSuffixError(message);
    } finally {
      setIsSavingSuffix(false);
    }
  };

  return (
    <div className="space-y-6">
    <form onSubmit={handleSubmit(onSubmitForm)} className="space-y-4">
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
              저장 중...
            </>
          ) : (
            '저장'
          )}
        </button>
      </div>
    </form>

    {seller && (
      <div className="border-t pt-4 space-y-3">
        <div>
          <h3 className="text-sm font-semibold">등록상품명 추가 문구</h3>
          <p className="text-xs text-gray-500">
            옵션 2개 이상 등록상품명에 붙는 추가 문구의 판매자 기본값입니다.
          </p>
        </div>

        <OptionCheckSuffixControl
          value={suffixConfig}
          onChange={(next) => {
            setSuffixConfig(next);
            setSuffixSaved(false);
          }}
          inheritedHint="입력하지 않으면 등록상품명에 추가 문구가 붙지 않습니다."
          disabled={isSavingSuffix}
        />

        {suffixError && (
          <div className="rounded-md bg-red-50 p-3 text-sm text-red-700 flex items-start gap-2">
            <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
            <div>{suffixError}</div>
          </div>
        )}
        {suffixSaved && !suffixError && (
          <p className="text-sm text-green-700">추가 문구를 저장했습니다.</p>
        )}

        <button
          type="button"
          onClick={handleSaveSuffix}
          disabled={isSavingSuffix}
          className="px-3 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
        >
          {isSavingSuffix ? (
            <>
              <div className="h-3 w-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
              저장 중...
            </>
          ) : (
            '추가 문구 저장'
          )}
        </button>
      </div>
    )}
    </div>
  );
}
