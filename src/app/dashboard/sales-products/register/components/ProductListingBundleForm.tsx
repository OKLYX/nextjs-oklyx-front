'use client';

import { useState, useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { axiosInstance } from '@/infrastructure/api/axiosInstance';
import type { CreateProductListingProductRequest } from '@/application/dto/ProductListingDTOs';
import type { ProductListingOption } from '@/domain/entities/ProductListingEntity';

const productSchema = z.object({
  productId: z.coerce.number().min(1, '상품을 선택해주세요'),
  quantity: z.coerce.number().min(1, '수량은 1 이상이어야 합니다').int(),
});

type ProductFormValues = z.infer<typeof productSchema>;

interface Product {
  id: number;
  name: string;
  currentStock: number;
}

interface OptionProduct {
  productId: number;
  productName: string;
  quantity: number;
}

interface ProductListingBundleFormProps {
  listingId: number;
  listingData: any;
  options: ProductListingOption[];
  onAddProduct: (request: CreateProductListingProductRequest) => Promise<void>;
  onSubmit: () => Promise<void>;
  isLoading?: boolean;
}

export function ProductListingBundleForm({
  listingId,
  listingData,
  options,
  onAddProduct,
  onSubmit,
  isLoading = false,
}: ProductListingBundleFormProps) {
  const hasRequiredFields = listingData?.categoryId && listingData?.deliveryId && listingData?.packageId;
  const [submitError, setSubmitError] = useState('');
  const [products, setProducts] = useState<Product[]>([]);
  const [productsLoading, setProductsLoading] = useState(true);
  const [isAdding, setIsAdding] = useState<number | null>(null);
  const [bundleData, setBundleData] = useState<Record<number, OptionProduct[]>>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [activeOptionId, setActiveOptionId] = useState<number | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    watch,
  } = useForm<ProductFormValues>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      productId: undefined,
      quantity: 1,
    },
  });

  const selectedProductId = watch('productId');

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const response = await axiosInstance.get('/api/products');
        setProducts(response.data.data || []);
      } catch (error) {
        setSubmitError('상품 목록을 불러오지 못했습니다');
      } finally {
        setProductsLoading(false);
      }
    };

    fetchProducts();
  }, []);

  const filteredProducts = useMemo(() => {
    if (!searchQuery.trim()) return products;
    const query = searchQuery.toLowerCase();
    return products.filter((p) => p.name.toLowerCase().includes(query));
  }, [searchQuery, products]);

  const selectedProduct = useMemo(() => {
    if (!selectedProductId) return null;
    return products.find((p) => p.id === selectedProductId);
  }, [selectedProductId, products]);

  const handleAddProduct = async (optionId: number, values: ProductFormValues) => {
    setSubmitError('');
    setIsAdding(optionId);
    try {
      const request: CreateProductListingProductRequest = {
        productListingOptionId: optionId,
        productId: values.productId,
        quantity: values.quantity,
      };
      await onAddProduct(request);

      const newProduct: OptionProduct = {
        productId: values.productId,
        productName: selectedProduct?.name || `상품 ${values.productId}`,
        quantity: values.quantity,
      };

      setBundleData({
        ...bundleData,
        [optionId]: [...(bundleData[optionId] || []), newProduct],
      });
      reset();
      setSearchQuery('');
      setActiveOptionId(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : '상품 추가에 실패했습니다';
      setSubmitError(message);
    } finally {
      setIsAdding(null);
    }
  };

  const handleRemoveProduct = (optionId: number, productIndex: number) => {
    setBundleData({
      ...bundleData,
      [optionId]: bundleData[optionId].filter((_, i) => i !== productIndex),
    });
  };

  const handleSubmitBundle = async () => {
    const hasProducts = Object.values(bundleData).some((arr) => arr.length > 0);
    if (!hasProducts) {
      setSubmitError('각 옵션에 최소 1개 이상의 상품을 추가해주세요');
      return;
    }
    try {
      await onSubmit();
    } catch (error) {
      const message = error instanceof Error ? error.message : '제출에 실패했습니다';
      setSubmitError(message);
    }
  };

  if (productsLoading) {
    return <div className="text-center py-12">상품 목록을 불러오는 중...</div>;
  }

  return (
    <div className="w-full max-w-4xl mx-auto py-8">
      <h2 className="text-2xl font-bold mb-6">상품 번들 구성 (Step 3/3)</h2>

      {submitError && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">
          {submitError}
        </div>
      )}

      <div className="space-y-6">
        {options.map((option) => (
          <div key={option.id} className="p-4 border border-gray-200 rounded-lg">
            <h3 className="font-medium mb-4">
              옵션 {option.id}: {option.optionName}
              <span className="text-gray-600 ml-2 text-sm">
                (판매가: {option.sellingPrice.toLocaleString()}원)
              </span>
            </h3>

            {bundleData[option.id]?.length > 0 && (
              <div className="mb-4 space-y-2">
                {bundleData[option.id].map((product, index) => (
                  <div key={index} className="flex justify-between items-center p-3 bg-gray-50 rounded">
                    <div>
                      <p className="text-sm font-medium">{product.productName}</p>
                      <p className="text-xs text-gray-600">수량: {product.quantity}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRemoveProduct(option.id, index)}
                      disabled={isLoading || isAdding !== null}
                      className="px-3 py-1 text-sm bg-red-100 text-red-700 rounded hover:bg-red-200 disabled:opacity-50"
                    >
                      삭제
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="p-3 border border-gray-200 rounded bg-white">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSubmit((values) => handleAddProduct(option.id, values))();
                }}
                className="space-y-3"
              >
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    상품 검색 *
                  </label>
                  <input
                    type="text"
                    placeholder="상품명으로 검색..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                    disabled={isLoading || isAdding !== null}
                  />
                  {searchQuery.trim() && filteredProducts.length > 0 && (
                    <div className="mt-2 border border-gray-200 rounded-lg bg-white max-h-64 overflow-y-auto">
                      {filteredProducts.map((product) => (
                        <button
                          key={product.id}
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            setSearchQuery('');
                            const field = document.querySelector(
                              'input[type="hidden"][name*="productId"]'
                            ) as HTMLInputElement | null;
                            if (field) {
                              field.value = product.id.toString();
                            }
                            reset({ productId: product.id, quantity: 1 });
                          }}
                          className="w-full text-left px-4 py-2 hover:bg-blue-50 border-b border-gray-100 last:border-b-0 text-sm"
                        >
                          <p className="font-medium">{product.name}</p>
                          <p className="text-xs text-gray-500">재고: {product.currentStock}</p>
                        </button>
                      ))}
                    </div>
                  )}
                  {searchQuery.trim() && filteredProducts.length === 0 && (
                    <div className="mt-2 p-3 bg-gray-50 text-sm text-gray-600 rounded">
                      검색 결과가 없습니다
                    </div>
                  )}
                </div>

                {selectedProduct && (
                  <div className="p-2 bg-blue-50 border border-blue-200 rounded text-sm">
                    <p className="text-blue-900">
                      선택: <strong>{selectedProduct.name}</strong> (재고: {selectedProduct.currentStock})
                    </p>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    수량 *
                  </label>
                  <input
                    {...register('quantity')}
                    type="number"
                    min="1"
                    placeholder="1"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                    disabled={isLoading || isAdding !== null}
                  />
                  {errors.quantity && (
                    <p className="mt-1 text-xs text-red-600">{errors.quantity.message}</p>
                  )}
                </div>

                <button
                  type="button"
                  disabled={!hasRequiredFields || isLoading || isAdding !== null || !selectedProduct}
                  onClick={(e) => {
                    if (!hasRequiredFields || isLoading || isAdding !== null || !selectedProduct) {
                      e.preventDefault();
                    } else {
                      handleSubmit((values) => handleAddProduct(option.id, values))();
                    }
                  }}
                  className="w-full bg-gray-200 text-gray-800 font-medium py-2 px-4 rounded-lg hover:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm"
                >
                  {isAdding === option.id ? '추가 중...' : '+ 상품 추가'}
                </button>
              </form>
            </div>
          </div>
        ))}

        <button
          type="button"
          onClick={handleSubmitBundle}
          disabled={isLoading}
          className="w-full bg-blue-600 text-white font-medium py-2 px-4 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isLoading ? '처리 중...' : '완료 및 등록'}
        </button>
      </div>
    </div>
  );
}
