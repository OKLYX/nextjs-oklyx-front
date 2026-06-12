'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import type { CreateProductListingOptionWithProductsRequest, CreateProductListingProductRequest } from '@/application/dto/ProductListingDTOs';

const optionSchema = z.object({
  optionName: z.string().min(1, '옵션명을 입력해주세요').max(100),
  sellingPrice: z.coerce.number().min(0.01, '판매가는 0보다 커야 합니다'),
  platformOptionId: z.string().optional(),
});

type OptionFormValues = z.infer<typeof optionSchema>;

const productSchema = z.object({
  productId: z.coerce.number().min(1, '상품을 선택해주세요'),
  quantity: z.coerce.number().min(1, '수량은 최소 1이어야 합니다'),
});

type ProductFormValues = z.infer<typeof productSchema>;

interface ProductListingOptionFormProps {
  listingRequest: any;
  onSubmit: (options: CreateProductListingOptionWithProductsRequest[]) => Promise<void>;
  isLoading?: boolean;
}

export function ProductListingOptionForm({
  listingRequest,
  onSubmit,
  isLoading = false,
}: ProductListingOptionFormProps) {
  const [submitError, setSubmitError] = useState('');
  const [options, setOptions] = useState<CreateProductListingOptionWithProductsRequest[]>([]);
  const [expandedOptionIndex, setExpandedOptionIndex] = useState<number | null>(null);

  const {
    register: registerOption,
    handleSubmit: handleSubmitOption,
    formState: { errors: optionErrors },
    reset: resetOption,
  } = useForm<z.input<typeof optionSchema>, unknown, OptionFormValues>({
    resolver: zodResolver(optionSchema),
    mode: 'onChange',
  });

  const {
    register: registerProduct,
    handleSubmit: handleSubmitProduct,
    formState: { errors: productErrors },
    reset: resetProduct,
    watch: watchProduct,
  } = useForm<z.input<typeof productSchema>, unknown, ProductFormValues>({
    resolver: zodResolver(productSchema),
    mode: 'onChange',
  });

  const productValues = watchProduct();

  const onAddOption = (values: OptionFormValues) => {
    const newOption: CreateProductListingOptionWithProductsRequest = {
      optionName: values.optionName,
      sellingPrice: values.sellingPrice,
      platformOptionId: values.platformOptionId || undefined,
      products: [],
    };

    console.log('옵션 추가됨:', newOption);
    setOptions((prev) => {
      const updated = [...prev, newOption];
      console.log('현재 옵션 목록:', updated);
      return updated;
    });
    resetOption();
  };

  const onAddProduct = (values: ProductFormValues, optionIndex: number) => {
    const newProduct: CreateProductListingProductRequest = {
      productId: values.productId,
      quantity: values.quantity,
    };

    console.log('상품 추가됨:', newProduct, '옵션 인덱스:', optionIndex);
    setOptions((prev) => {
      const updated = [...prev];
      updated[optionIndex].products.push(newProduct);
      console.log('현재 상품 목록 (옵션' + optionIndex + '):', updated[optionIndex].products);
      return updated;
    });
    resetProduct();
  };

  const handleFinalSubmit = async () => {
    console.log('=== 최종 제출 시작 ===');
    console.log('현재 options 상태:', JSON.stringify(options, null, 2));

    if (options.length === 0) {
      setSubmitError('최소 1개의 옵션을 추가해주세요');
      return;
    }

    for (let i = 0; i < options.length; i++) {
      if (options[i].products.length === 0) {
        setSubmitError(`옵션 "${options[i].optionName}"에 최소 1개의 상품을 추가해주세요`);
        return;
      }
    }

    setSubmitError('');
    try {
      console.log('onSubmit 함수 호출, options 전달:', options);
      await onSubmit(options);
    } catch (error) {
      const message = error instanceof Error ? error.message : '등록에 실패했습니다';
      setSubmitError(message);
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto py-8">
      <h2 className="text-2xl font-bold mb-6">옵션 정보 (Step 2/2)</h2>

      {submitError && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">
          {submitError}
        </div>
      )}

      <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded">
        <h3 className="font-semibold text-blue-900 mb-2">선택된 상품 정보</h3>
        <p className="text-sm text-blue-800">
          판매자: {listingRequest.sellerId} | 플랫폼: {listingRequest.platform} | 상품 ID: {listingRequest.platformProductId}
        </p>
      </div>

      {/* 옵션 추가 폼 */}
      <div className="mb-6 p-4 bg-gray-50 border border-gray-200 rounded-lg">
        <h3 className="text-lg font-semibold mb-4">옵션 추가</h3>
        <form onSubmit={handleSubmitOption(onAddOption)} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">옵션명 *</label>
            <input
              {...registerOption('optionName')}
              type="text"
              placeholder="예: Size M"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={isLoading}
            />
            {optionErrors.optionName && <p className="text-xs text-red-600 mt-1">{optionErrors.optionName.message}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">판매가 *</label>
            <input
              {...registerOption('sellingPrice')}
              type="number"
              step="0.01"
              placeholder="29900"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={isLoading}
            />
            {optionErrors.sellingPrice && <p className="text-xs text-red-600 mt-1">{optionErrors.sellingPrice.message}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">플랫폼 옵션 ID (선택)</label>
            <input
              {...registerOption('platformOptionId')}
              type="text"
              placeholder="opt_12345"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={isLoading}
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-gray-300"
          >
            옵션 추가
          </button>
        </form>
      </div>

      {/* 등록된 옵션 목록 */}
      {options.length > 0 && (
        <div className="mb-6">
          <h3 className="text-lg font-semibold mb-4">등록된 옵션 ({options.length}개)</h3>
          <div className="space-y-3">
            {options.map((option, optionIndex) => (
              <div key={optionIndex} className="border border-gray-300 rounded-lg overflow-hidden">
                <div
                  className="p-4 bg-gray-100 cursor-pointer flex justify-between items-center"
                  onClick={() => setExpandedOptionIndex(expandedOptionIndex === optionIndex ? null : optionIndex)}
                >
                  <div>
                    <p className="font-semibold">{option.optionName}</p>
                    <p className="text-sm text-gray-600">
                      판매가: ₩{option.sellingPrice.toLocaleString()} | 상품 {option.products.length}개
                    </p>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setOptions(options.filter((_, i) => i !== optionIndex));
                    }}
                    className="px-3 py-1 text-sm bg-red-500 text-white rounded hover:bg-red-600"
                    disabled={isLoading}
                  >
                    삭제
                  </button>
                </div>

                {expandedOptionIndex === optionIndex && (
                  <div className="p-4 border-t border-gray-200">
                    {/* 상품 목록 */}
                    <div className="mb-4">
                      <p className="font-semibold mb-2">포함된 상품:</p>
                      {option.products.length === 0 ? (
                        <p className="text-sm text-gray-600">상품이 없습니다</p>
                      ) : (
                        <div className="space-y-2">
                          {option.products.map((product, productIndex) => (
                            <div key={productIndex} className="flex justify-between items-center p-2 bg-blue-50 rounded">
                              <span className="text-sm">상품 ID: {product.productId} × {product.quantity}개</span>
                              <button
                                onClick={() => {
                                  setOptions((prev) => {
                                    const updated = [...prev];
                                    updated[optionIndex].products.splice(productIndex, 1);
                                    return updated;
                                  });
                                }}
                                className="px-2 py-1 text-xs bg-red-500 text-white rounded hover:bg-red-600"
                              >
                                제거
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* 상품 추가 폼 */}
                    <form onSubmit={handleSubmitProduct((values) => onAddProduct(values, optionIndex))} className="space-y-3 p-3 bg-white border border-gray-200 rounded">
                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">상품 ID *</label>
                        <input
                          {...registerProduct('productId')}
                          type="number"
                          placeholder="1"
                          className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                          disabled={isLoading}
                        />
                        {productErrors.productId && <p className="text-xs text-red-600 mt-1">{productErrors.productId.message}</p>}
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-gray-700 mb-1">수량 *</label>
                        <input
                          {...registerProduct('quantity')}
                          type="number"
                          min="1"
                          placeholder="1"
                          className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                          disabled={isLoading}
                        />
                        {productErrors.quantity && <p className="text-xs text-red-600 mt-1">{productErrors.quantity.message}</p>}
                      </div>

                      <button
                        type="submit"
                        disabled={isLoading || !productValues.productId || !productValues.quantity}
                        className="w-full px-3 py-2 text-sm bg-green-500 text-white rounded hover:bg-green-600 disabled:bg-gray-300"
                      >
                        상품 추가
                      </button>
                    </form>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 최종 제출 버튼 */}
      <div className="mt-8">
        <button
          onClick={handleFinalSubmit}
          disabled={isLoading || options.length === 0}
          className="w-full px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-300 font-semibold"
        >
          {isLoading ? '등록 중...' : '판매상품 등록'}
        </button>
      </div>
    </div>
  );
}
