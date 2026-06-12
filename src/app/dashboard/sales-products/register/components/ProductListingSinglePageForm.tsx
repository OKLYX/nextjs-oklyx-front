'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { axiosInstance } from '@/infrastructure/api/axiosInstance';
import { ProductListingRepositoryImpl } from '@/infrastructure/repositories/ProductListingRepositoryImpl';
import { ProductListingUseCase } from '@/application/usecases/ProductListingUseCase';
import { getImageUrl } from '@/infrastructure/utils/imageUrl';
import type { CreateProductListingRequest, CreateProductListingOptionRequest, CreateProductListingProductRequest } from '@/application/dto/ProductListingDTOs';
import type { ProductListing, ProductListingOption } from '@/domain/entities/ProductListingEntity';
import type { Product } from '@/domain/entities/Product';

const PLATFORMS = ['COUPANG', 'GMARKET', 'AUCTION', 'SMARTSTORE'];

interface CarrierRate {
  id: number;
  carrier: string;
  cost: number;
}

interface Package {
  id: number;
  type: string;
  cost: number;
}

interface Seller {
  id: number;
  sellerName: string;
  businessRegistration: string;
}

interface Category {
  id: number;
  name: string;
  platform: string;
  platformCategoryId: string;
  parentId: number | null;
}

interface CommissionRateData {
  id: number;
  platform: string;
  rate: number;
  categoryId: number | null;
}

interface OptionWithProducts {
  option: ProductListingOption;
  products: Array<{ productId: number; productName: string; quantity: number }>;
}

export function ProductListingSinglePageForm() {
  const router = useRouter();
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [carrierRates, setCarrierRates] = useState<CarrierRate[]>([]);
  const [packages, setPackages] = useState<Package[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [allCommissionRates, setAllCommissionRates] = useState<CommissionRateData[]>([]);
  const [sellers, setSellers] = useState<Seller[]>([]);
  const [commissionRate, setCommissionRate] = useState<number>(0);
  const [loadingData, setLoadingData] = useState(true);

  // Section 0: 판매자 선택
  const [selectedSellerId, setSelectedSellerId] = useState<number | null>(null);

  // Section 1: 플랫폼
  const [selectedPlatform, setSelectedPlatform] = useState('');
  const [productListingName, setProductListingName] = useState('');

  // Section 2: 상품 (여러 개) 및 카테고리
  const [platformProductId, setPlatformProductId] = useState('');
  const [selectedProducts, setSelectedProducts] = useState<Product[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
  const [productModalSearchQuery, setProductModalSearchQuery] = useState('');
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);

  // Section 3: 배송사, carrier rate, 패키지
  const [selectedCarrier, setSelectedCarrier] = useState('');
  const [selectedCarrierRateId, setSelectedCarrierRateId] = useState<number | null>(null);
  const [selectedPackageId, setSelectedPackageId] = useState<number | null>(null);

  // Section 4: 옵션 데이터
  const [optionsData, setOptionsData] = useState<OptionWithProducts[]>([]);
  const [selectedOptionId, setSelectedOptionId] = useState<number | null>(null);
  const [newOptionName, setNewOptionName] = useState('');
  const [newOptionPrice, setNewOptionPrice] = useState('');
  const [newOptionMarginRate, setNewOptionMarginRate] = useState('');
  const [newOptionPlatformId, setNewOptionPlatformId] = useState('');
  const [productQuantities, setProductQuantities] = useState<Record<string, number>>({});
  const [isOptionFormOpen, setIsOptionFormOpen] = useState(false);
  const [editingOptionId, setEditingOptionId] = useState<number | null>(null);

  // Real-time product search
  const [searchProducts, setSearchProducts] = useState<Product[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const lastAutoAddedRef = useRef<string>('');

  const useCase = useMemo(() => {
    const repository = new ProductListingRepositoryImpl();
    return new ProductListingUseCase(repository);
  }, []);

  // 선택된 배송사의 carrier rates만 필터링
  const filteredCarrierRates = useMemo(() => {
    if (!selectedCarrier) return [];
    return carrierRates.filter((cr) => cr.carrier === selectedCarrier);
  }, [selectedCarrier, carrierRates]);

  // 배송사 목록 (중복 제거)
  const uniqueCarriers = useMemo(() => {
    return Array.from(new Set(carrierRates.map((cr) => cr.carrier)));
  }, [carrierRates]);

  // 선택된 플랫폼의 카테고리만 필터링
  const filteredCategories = useMemo(() => {
    if (!selectedPlatform) return [];
    return categories.filter((cat) => cat.platform === selectedPlatform);
  }, [selectedPlatform, categories]);

  // 선택한 카테고리에 따른 수수료 계산
  useEffect(() => {
    if (selectedPlatform && selectedCategory) {
      const rate = allCommissionRates.find(
        (cr) => cr.platform === selectedPlatform && cr.categoryId === selectedCategory
      );
      if (rate) {
        setCommissionRate(rate.rate);
      } else {
        const defaultRate = allCommissionRates.find(
          (cr) => cr.platform === selectedPlatform && cr.categoryId === null
        );
        setCommissionRate(defaultRate?.rate || 0.05);
      }
    } else if (selectedPlatform) {
      const defaultRate = allCommissionRates.find(
        (cr) => cr.platform === selectedPlatform && cr.categoryId === null
      );
      setCommissionRate(defaultRate?.rate || 0.05);
    }
  }, [selectedPlatform, selectedCategory, allCommissionRates]);

  const filteredProductsForModal = useMemo(() => {
    const selectedIds = new Set(selectedProducts.map((p) => p.id));
    return searchProducts.filter((p) => !selectedIds.has(p.id));
  }, [searchProducts, selectedProducts]);

  const handleProductSearch = async (query: string) => {
    setProductModalSearchQuery(query);

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    if (!query.trim()) {
      setSearchProducts([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    searchTimeoutRef.current = setTimeout(async () => {
      try {
        const response = await axiosInstance.get('/api/products', {
          params: {
            search: query.trim(),
            page: 0,
            size: 50,
          },
        });
        setSearchProducts((response.data.data?.content || []) as Product[]);
      } catch (err) {
        setSearchProducts([]);
      } finally {
        setIsSearching(false);
      }
    }, 300);
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [carrierRateRes, packagesRes, productsRes, commissionRes, categoryRes, sellersRes] = await Promise.all([
          axiosInstance.get('/api/admin/carrier-rate'),
          axiosInstance.get('/api/admin/package'),
          axiosInstance.get('/api/products'),
          axiosInstance.get('/api/admin/commission-rate'),
          axiosInstance.get('/api/admin/category'),
          axiosInstance.get('/api/admin/seller'),
        ]);

        const carrierRateData = carrierRateRes.data.data || [];
        const packagesData = packagesRes.data.data || [];
        const productsData = (productsRes.data.data?.content || []) as Product[];
        const commissionData = commissionRes.data.data || [];
        const categoryData = categoryRes.data.data || [];
        const sellersData = sellersRes.data.data || [];

        setCarrierRates(carrierRateData);
        setPackages(packagesData);
        setProducts(productsData);
        setCategories(categoryData);
        setAllCommissionRates(commissionData);
        setSellers(sellersData);

        if (commissionData.length > 0) {
          setCommissionRate(commissionData[0].rate || 0.05);
        }
      } catch (err) {
        setError('데이터를 불러오지 못했습니다');
      } finally {
        setLoadingData(false);
      }
    };

    fetchData();

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, []);

  const handleSelectProduct = (product: Product) => {
    if (selectedProducts.some((p) => p.id === product.id)) {
      setError('이미 선택된 상품입니다');
      return;
    }
    setSelectedProducts([...selectedProducts, product]);
    setIsProductModalOpen(false);
    setProductModalSearchQuery('');
    setError('');
  };

  const calculateMargin = (sellingPrice: number, optionProducts: Array<{ productId: number; quantity: number }>): number => {
    if (!selectedCarrierRateId || !selectedPackageId) return 0;

    const selectedCarrierRate = carrierRates.find((cr) => cr.id === selectedCarrierRateId);
    const selectedPkg = packages.find((p) => p.id === selectedPackageId);

    const carrierRateCost = selectedCarrierRate?.cost || 0;
    const packageCost = selectedPkg?.cost || 0;

    let totalProductCost = 0;
    for (const optProduct of optionProducts) {
      const product = selectedProducts.find((p) => p.id === optProduct.productId);
      if (product?.price) {
        totalProductCost += product.price * optProduct.quantity;
      }
    }

    const commission = sellingPrice * commissionRate;
    const commissionFee = commission * 1.1;
    const totalCost = totalProductCost + carrierRateCost + packageCost;
    const margin = sellingPrice - commissionFee - totalCost;

    return Math.round(margin);
  };

  const clearOptionForm = () => {
    setNewOptionName('');
    setNewOptionPrice('');
    setNewOptionMarginRate('');
    setNewOptionPlatformId('');
    setProductQuantities({});
    setEditingOptionId(null);
  };

  const handleAddOption = () => {
    if (!newOptionName.trim() || !newOptionPrice) {
      setError('옵션명과 판매가를 입력해주세요');
      return;
    }

    if (selectedProducts.length === 0) {
      setError('최소 1개 이상의 상품을 선택해주세요');
      return;
    }

    // 선택된 모든 상품 포함 (수량 적용)
    const selectedProdQuantities: Array<{ productId: number; productName: string; quantity: number }> = [];
    selectedProducts.forEach((product) => {
      const key = `add-option-${product.id}`;
      const quantity = productQuantities[key] || 1;
      selectedProdQuantities.push({
        productId: product.id,
        productName: product.productName,
        quantity: quantity,
      });
    });

    if (editingOptionId) {
      // 기존 옵션 수정
      setOptionsData(
        optionsData.map((item) => {
          if (item.option.id === editingOptionId) {
            return {
              option: {
                ...item.option,
                optionName: newOptionName,
                sellingPrice: parseFloat(newOptionPrice),
                platformOptionId: newOptionPlatformId || undefined,
              },
              products: selectedProdQuantities,
            };
          }
          return item;
        })
      );
      setSuccessMessage(`옵션 "${newOptionName}"이 수정되었습니다`);
    } else {
      // 새 옵션 추가
      const tempId = Date.now() + Math.random();
      const newOption: ProductListingOption = {
        id: tempId,
        optionName: newOptionName,
        sellingPrice: parseFloat(newOptionPrice),
        platformOptionId: newOptionPlatformId || undefined,
        productListingId: 0,
      };

      setOptionsData([...optionsData, { option: newOption, products: selectedProdQuantities }]);
      setSuccessMessage(`옵션 "${newOptionName}"이 추가되었습니다`);
    }

    clearOptionForm();
    setIsOptionFormOpen(false);
    setError('');
  };

  const handleEditOption = (option: ProductListingOption, products: Array<{ productId: number; productName: string; quantity: number }>) => {
    setEditingOptionId(option.id);
    setNewOptionName(option.optionName);
    setNewOptionPrice(String(option.sellingPrice));
    setNewOptionPlatformId(option.platformOptionId || '');

    const quantities: Record<number, number> = {};
    products.forEach((p) => {
      quantities[p.productId] = p.quantity;
    });
    setProductQuantities(quantities);
  };

  const handleCancelEdit = () => {
    clearOptionForm();
    setIsOptionFormOpen(false);
  };

  const calculateMarginPreview = (sellingPrice: number): number => {
    if (sellingPrice == null || !selectedCarrierRateId || !selectedPackageId) return 0;

    // 옵션 추가 폼에서 선택된 상품들
    const selectedProdQuantities: Array<{ productId: number; quantity: number }> = [];
    selectedProducts.forEach((product) => {
      const key = `add-option-${product.id}`;
      const quantity = productQuantities[key] || 1; // 기본값 1
      selectedProdQuantities.push({
        productId: product.id,
        quantity: quantity,
      });
    });

    if (selectedProdQuantities.length === 0) return 0;

    const selectedCarrierRate = carrierRates.find((cr) => cr.id === selectedCarrierRateId);
    const selectedPkg = packages.find((p) => p.id === selectedPackageId);

    const carrierRateCost = selectedCarrierRate?.cost || 0;
    const packageCost = selectedPkg?.cost || 0;

    let totalProductCost = 0;
    for (const optProduct of selectedProdQuantities) {
      const product = selectedProducts.find((p) => p.id === optProduct.productId);
      if (product?.price) {
        totalProductCost += product.price * optProduct.quantity;
      }
    }

    const commission = sellingPrice * commissionRate;
    const commissionFee = commission * 1.1;
    const totalCost = totalProductCost + carrierRateCost + packageCost;
    const margin = sellingPrice - commissionFee - totalCost;

    return Math.round(margin);
  };

  const calculateSellingPriceFromMarginRate = (marginRate: number): number => {
    if (!selectedCarrierRateId || !selectedPackageId) return 0;

    const selectedProdQuantities: Array<{ productId: number; quantity: number }> = [];
    selectedProducts.forEach((product) => {
      const key = `add-option-${product.id}`;
      const quantity = productQuantities[key] || 1;
      selectedProdQuantities.push({
        productId: product.id,
        quantity: quantity,
      });
    });

    if (selectedProdQuantities.length === 0) return 0;

    const selectedCarrierRate = carrierRates.find((cr) => cr.id === selectedCarrierRateId);
    const selectedPkg = packages.find((p) => p.id === selectedPackageId);

    const carrierRateCost = selectedCarrierRate?.cost || 0;
    const packageCost = selectedPkg?.cost || 0;

    let totalProductCost = 0;
    for (const optProduct of selectedProdQuantities) {
      const product = selectedProducts.find((p) => p.id === optProduct.productId);
      if (product?.price) {
        totalProductCost += product.price * optProduct.quantity;
      }
    }

    const totalCost = totalProductCost + carrierRateCost + packageCost;

    // 판매가 = 비용 / (1 - 마진율/100 - 수수료율 * 1.1)
    const denominator = 1 - marginRate / 100 - commissionRate * 1.1;

    if (denominator <= 0) {
      return 0; // 불가능한 마진율
    }

    const sellingPrice = totalCost / denominator;
    return Math.round(sellingPrice);
  };

  const removeOption = (optionId: number) => {
    setOptionsData(optionsData.filter((item) => item.option.id !== optionId));
  };

  const removeProductFromOption = (optionId: number, productIndex: number) => {
    setOptionsData(
      optionsData.map((item) => {
        if (item.option.id === optionId) {
          return {
            ...item,
            products: item.products.filter((_, i) => i !== productIndex),
          };
        }
        return item;
      })
    );
  };

  const addProductToOption = (optionId: number, productId: number, quantity: number) => {
    if (!productId || quantity < 1) return;

    setOptionsData(
      optionsData.map((item) => {
        if (item.option.id === optionId) {
          const product = selectedProducts.find((p) => p.id === productId);
          return {
            ...item,
            products: [
              ...item.products,
              {
                productId,
                productName: product?.productName || `상품 ${productId}`,
                quantity,
              },
            ],
          };
        }
        return item;
      })
    );
    setSelectedOptionId(null);
  };

  const handleFinalSubmit = async () => {
    if (!selectedSellerId || !selectedPlatform || !productListingName.trim() || selectedProducts.length === 0 || !platformProductId || !selectedCategory || !selectedCarrierRateId || !selectedPackageId || optionsData.length === 0) {
      setError('모든 섹션을 완료해주세요');
      return;
    }

    const allOptionsHaveProducts = optionsData.every((item) => item.products.length > 0);
    if (!allOptionsHaveProducts) {
      setError('모든 옵션에 최소 1개 이상의 상품을 추가해주세요');
      return;
    }

    setIsSubmitting(true);
    setError('');
    try {
      // options을 CreateProductListingOptionWithProductsRequest[] 형태로 변환
      const options = optionsData.map((optionData) => ({
        optionName: optionData.option.optionName,
        sellingPrice: optionData.option.sellingPrice,
        platformOptionId: optionData.option.platformOptionId || undefined,
        products: optionData.products.map((product) => ({
          productId: product.productId,
          quantity: product.quantity,
        })),
      }));

      console.log('최종 요청 - ProductListing + Options:', {
        platform: selectedPlatform,
        platformProductId: platformProductId,
        name: productListingName,
        sellerId: selectedSellerId,
        categoryId: selectedCategory,
        deliveryId: selectedCarrierRateId,
        packageId: selectedPackageId,
        options,
      });

      // 한 번의 API 호출로 ProductListing + Options + Products 모두 생성
      const listingRequest: CreateProductListingRequest = {
        platform: selectedPlatform,
        platformProductId: platformProductId,
        name: productListingName,
        sellerId: selectedSellerId,
        categoryId: selectedCategory,
        deliveryId: selectedCarrierRateId,
        packageId: selectedPackageId,
        options,
      };

      await useCase.create(listingRequest);

      setSuccessMessage('판매상품이 생성되었습니다!');
      router.push('/dashboard/sales-products/retrieve');
    } catch (err) {
      const message = err instanceof Error ? err.message : '생성에 실패했습니다';
      setError(message);
      setIsSubmitting(false);
    }
  };

  if (loadingData) {
    return <div className="text-center py-12">데이터를 불러오는 중...</div>;
  }

  const isAllComplete = selectedSellerId && selectedPlatform && productListingName.trim() && platformProductId && selectedProducts.length > 0 && selectedCategory && selectedCarrierRateId && selectedPackageId && optionsData.length > 0 && optionsData.every((opt) => opt.products.length > 0);

  return (
    <div className="w-full max-w-4xl mx-auto py-8">
      <h1 className="text-3xl font-bold mb-8">판매상품 등록</h1>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          {error}
          <button onClick={() => setError('')} className="ml-2 underline text-red-600 hover:text-red-700">
            닫기
          </button>
        </div>
      )}

      {successMessage && (
        <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">
          {successMessage}
          <button onClick={() => setSuccessMessage('')} className="ml-2 underline text-green-600 hover:text-green-700">
            닫기
          </button>
        </div>
      )}

      {/* Section 0: 판매자 선택 */}
      <div className="mb-8 p-6 border border-gray-200 rounded-lg">
        <div className="flex items-center gap-3 mb-6 pb-3 border-b">
          <div className={`flex items-center justify-center w-8 h-8 rounded-full font-bold text-white ${selectedSellerId ? 'bg-green-600' : 'bg-gray-400'}`}>
            {selectedSellerId ? '✓' : '0'}
          </div>
          <h2 className="text-lg font-bold">판매자 선택</h2>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">판매자 *</label>
          <select
            value={selectedSellerId || ''}
            onChange={(e) => setSelectedSellerId(parseInt(e.target.value) || null)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">판매자 선택...</option>
            {sellers.map((seller) => (
              <option key={seller.id} value={seller.id}>
                {seller.sellerName} ({seller.businessRegistration})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Section 1: 플랫폼 선택 */}
      <div className="mb-8 p-6 border border-gray-200 rounded-lg">
        <div className="flex items-center gap-3 mb-6 pb-3 border-b">
          <div className={`flex items-center justify-center w-8 h-8 rounded-full font-bold text-white ${selectedPlatform ? 'bg-green-600' : 'bg-gray-400'}`}>
            {selectedPlatform ? '✓' : '1'}
          </div>
          <h2 className="text-lg font-bold">플랫폼 선택</h2>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">플랫폼 *</label>
          <select
            value={selectedPlatform}
            onChange={(e) => {
              setSelectedPlatform(e.target.value);
              setSelectedCategory(null);
            }}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">플랫폼 선택...</option>
            {PLATFORMS.map((plat) => (
              <option key={plat} value={plat}>
                {plat}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Section 1-1: 판매상품 이름 */}
      <div className="mb-8 p-6 border border-gray-200 rounded-lg">
        <div className="flex items-center gap-3 mb-6 pb-3 border-b">
          <div className={`flex items-center justify-center w-8 h-8 rounded-full font-bold text-white ${productListingName.trim() ? 'bg-green-600' : 'bg-gray-400'}`}>
            {productListingName.trim() ? '✓' : '1-1'}
          </div>
          <h2 className="text-lg font-bold">판매상품 이름</h2>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">판매상품 이름 *</label>
          <input
            type="text"
            value={productListingName}
            onChange={(e) => setProductListingName(e.target.value)}
            placeholder="판매상품의 이름을 입력해주세요 (예: 프리미엄 상품 세트)"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
          />
        </div>
      </div>

      {/* Section 2: 상품 선택 (여러 개) */}
      <div className="mb-8 p-6 border border-gray-200 rounded-lg">
        <div className="flex items-center gap-3 mb-6 pb-3 border-b">
          <div className={`flex items-center justify-center w-8 h-8 rounded-full font-bold text-white ${selectedProducts.length > 0 ? 'bg-green-600' : 'bg-gray-400'}`}>
            {selectedProducts.length > 0 ? '✓' : '2'}
          </div>
          <h2 className="text-lg font-bold">구성 상품 선택</h2>
        </div>

        {selectedProducts.length > 0 && (
          <div className="space-y-3 mb-4">
            {selectedProducts.map((product) => (
              <div key={product.id} className="p-3 bg-blue-50 border border-blue-300 rounded-lg flex gap-3">
                <div className="flex-shrink-0 w-16 h-16 bg-gray-100 rounded overflow-hidden flex items-center justify-center">
                  {product.imageUrl && getImageUrl(product.imageUrl, product.id) ? (
                    <img
                      src={getImageUrl(product.imageUrl, product.id) || undefined}
                      alt={product.productName}
                      className="w-full h-full object-cover"
                      onError={(e) => ((e.target as HTMLImageElement).style.display = 'none')}
                    />
                  ) : (
                    <p className="text-gray-400 text-xs text-center px-2">No Image</p>
                  )}
                </div>
                <div className="flex-1">
                  <p className="text-xs text-gray-600">ID: {product.id}</p>
                  <p className="font-semibold text-gray-900">{product.productName}</p>
                  {product.price && <p className="text-sm text-blue-600 font-semibold">₩{Math.round(product.price).toLocaleString()}</p>}
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedProducts(selectedProducts.filter((p) => p.id !== product.id))}
                  className="px-3 py-1 text-xs bg-red-100 text-red-700 rounded hover:bg-red-200"
                >
                  제거
                </button>
              </div>
            ))}
          </div>
        )}

        <button
          type="button"
          onClick={() => setIsProductModalOpen(true)}
          className="w-full px-4 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700"
        >
          {selectedProducts.length > 0 ? '상품 추가' : '상품 검색 및 선택'}
        </button>

        {/* 쿠팡 상품 ID */}
        <div className="mt-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">쿠팡 상품 ID *</label>
          <input
            type="text"
            value={platformProductId}
            onChange={(e) => setPlatformProductId(e.target.value)}
            placeholder="쿠팡의 상품 ID를 입력해주세요"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
          />
        </div>

        {/* 카테고리 선택 */}
        <div className="mt-6 pt-6 border-t">
          <label className="block text-sm font-medium text-gray-700 mb-1">카테고리 *</label>
          <select
            value={selectedCategory || ''}
            onChange={(e) => setSelectedCategory(parseInt(e.target.value) || null)}
            disabled={!selectedPlatform}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
          >
            <option value="">카테고리 선택...</option>
            {filteredCategories.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.name}
              </option>
            ))}
          </select>
          {!selectedPlatform && <p className="text-xs text-gray-500 mt-1">플랫폼을 먼저 선택해주세요.</p>}
        </div>
      </div>

      {/* Section 3: 배송사, 택배비, 패키지 선택 */}
      <div className="mb-8 p-6 border border-gray-200 rounded-lg">
        <div className="flex items-center gap-3 mb-6 pb-3 border-b">
          <div className={`flex items-center justify-center w-8 h-8 rounded-full font-bold text-white ${selectedCarrierRateId && selectedPackageId ? 'bg-green-600' : 'bg-gray-400'}`}>
            {selectedCarrierRateId && selectedPackageId ? '✓' : '3'}
          </div>
          <h2 className="text-lg font-bold">배송사, 택배비 및 패키지</h2>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">배송사 *</label>
            <select
              value={selectedCarrier}
              onChange={(e) => {
                setSelectedCarrier(e.target.value);
                setSelectedCarrierRateId(null);
              }}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">배송사 선택...</option>
              {uniqueCarriers.map((carrier) => (
                <option key={carrier} value={carrier}>
                  {carrier}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">택배비 *</label>
            <select
              value={selectedCarrierRateId || ''}
              onChange={(e) => setSelectedCarrierRateId(parseInt(e.target.value) || null)}
              disabled={!selectedCarrier}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
            >
              <option value="">택배비 선택...</option>
              {filteredCarrierRates.map((cr) => (
                <option key={cr.id} value={cr.id}>
                  ₩{cr.cost.toLocaleString()}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">패키지 *</label>
            <select
              value={selectedPackageId || ''}
              onChange={(e) => setSelectedPackageId(parseInt(e.target.value) || null)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">패키지 선택...</option>
              {packages.map((pkg) => (
                <option key={pkg.id} value={pkg.id}>
                  {pkg.type} - ₩{pkg.cost.toLocaleString()}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Section 4: 옵션 관리 및 상품 번들 구성 */}
      <div className="mb-8 p-6 border border-gray-200 rounded-lg">
        <div className="flex items-center gap-3 mb-6 pb-3 border-b">
          <div className={`flex items-center justify-center w-8 h-8 rounded-full font-bold text-white ${optionsData.length > 0 && optionsData.every((opt) => opt.products.length > 0) ? 'bg-green-600' : 'bg-gray-400'}`}>
            {optionsData.length > 0 && optionsData.every((opt) => opt.products.length > 0) ? '✓' : '4'}
          </div>
          <h2 className="text-lg font-bold">옵션 관리 및 상품 번들 구성</h2>
        </div>

        {optionsData.length > 0 && (
          <div className="mb-6 space-y-4">
            {optionsData.map((item) =>
              editingOptionId === item.option.id ? (
                <div key={item.option.id} className="space-y-3 p-4 border border-dashed border-gray-300 rounded-lg bg-gray-50">
                  <h3 className="font-medium text-sm">옵션 수정</h3>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">옵션명 *</label>
                    <input
                      type="text"
                      value={newOptionName}
                      onChange={(e) => setNewOptionName(e.target.value)}
                      placeholder="Blue M"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">물품 수량 *</label>
                    <div className="space-y-2 p-2 border border-gray-300 rounded bg-white max-h-48 overflow-y-auto">
                      {selectedProducts.length > 0 ? (
                        selectedProducts.map((product) => (
                          <div key={product.id} className="flex items-center gap-2">
                            <div className="flex-1">
                              <p className="text-sm text-gray-900">{product.productName}</p>
                              {product.price && <p className="text-xs text-gray-500">₩{Math.round(product.price).toLocaleString()}</p>}
                            </div>
                            <label className="flex items-center gap-2 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={productQuantities[product.id] !== undefined}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setProductQuantities({
                                      ...productQuantities,
                                      [product.id]: productQuantities[product.id] || 1,
                                    });
                                  } else {
                                    const newQuantities = { ...productQuantities };
                                    delete newQuantities[product.id];
                                    setProductQuantities(newQuantities);
                                  }
                                }}
                                className="rounded"
                              />
                            </label>
                            <input
                              type="number"
                              min="1"
                              value={productQuantities[product.id] || 1}
                              onChange={(e) => {
                                setProductQuantities({
                                  ...productQuantities,
                                  [product.id]: parseInt(e.target.value) || 1,
                                });
                              }}
                              className="w-16 px-2 py-1 border border-gray-300 rounded text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                          </div>
                        ))
                      ) : (
                        <p className="text-sm text-gray-600">선택된 상품이 없습니다</p>
                      )}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">판매가 *</label>
                    <input
                      type="number"
                      value={newOptionPrice}
                      onChange={(e) => setNewOptionPrice(e.target.value)}
                      onBlur={() => {
                        if (newOptionPrice) {
                          const num = parseFloat(newOptionPrice) || 0;
                          const roundedToTen = Math.floor(num / 10) * 10;
                          setNewOptionPrice(String(roundedToTen));
                        }
                      }}
                      placeholder="29900"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                    />
                  </div>

                  {(() => {
                    const sellingPrice = newOptionPrice ? parseFloat(newOptionPrice) : 0;
                    const margin = calculateMarginPreview(sellingPrice);
                    const marginColor = margin > 0 ? 'text-green-600' : 'text-red-600';
                    return (
                      <div className="p-2 bg-blue-50 rounded text-xs space-y-1">
                        <div className="flex justify-between">
                          <span className="text-gray-700">판매가:</span>
                          <span>₩{Math.round(sellingPrice).toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-700">수수료 (+ 10%):</span>
                          <span>₩{Math.round(sellingPrice * commissionRate * 1.1).toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between border-t pt-1 mt-1">
                          <span className="font-semibold text-gray-900">마진:</span>
                          <span className={`font-bold ${marginColor}`}>₩{Math.round(margin).toLocaleString()}</span>
                        </div>
                      </div>
                    );
                  })()}

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">플랫폼 옵션 ID</label>
                    <input
                      type="text"
                      value={newOptionPlatformId}
                      onChange={(e) => setNewOptionPlatformId(e.target.value)}
                      placeholder="option_abc123"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                    />
                  </div>

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={handleAddOption}
                      className="flex-1 bg-green-600 text-white font-medium py-2 px-4 rounded-lg hover:bg-green-700 text-sm"
                    >
                      저장
                    </button>
                    <button
                      type="button"
                      onClick={handleCancelEdit}
                      className="flex-1 bg-gray-300 text-gray-800 font-medium py-2 px-4 rounded-lg hover:bg-gray-400 text-sm"
                    >
                      취소
                    </button>
                  </div>
                </div>
              ) : (
                <div key={item.option.id} className="p-4 bg-gray-50 rounded border border-gray-200">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <p className="font-medium">{item.option.optionName}</p>
                      <p className="text-sm text-gray-600">판매가: {item.option.sellingPrice.toLocaleString()}원</p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => handleEditOption(item.option, item.products)}
                        className="px-3 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                      >
                        수정
                      </button>
                      <button
                        type="button"
                        onClick={() => removeOption(item.option.id)}
                        className="px-3 py-1 text-xs bg-red-100 text-red-700 rounded hover:bg-red-200"
                      >
                        삭제
                      </button>
                    </div>
                  </div>

                  {item.products.length > 0 && (
                    <div className="mb-3 p-3 bg-white rounded border border-gray-200 space-y-2">
                      {item.products.map((product, idx) => (
                        <div key={idx} className="flex justify-between items-center text-sm">
                          <div>
                            <p className="font-medium">{product.productName}</p>
                            <p className="text-gray-600">수량: {product.quantity}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {(() => {
                    const margin = calculateMargin(item.option.sellingPrice, item.products);
                    const marginColor = margin > 0 ? 'text-green-600' : 'text-red-600';
                    return (
                      <div className="p-2 bg-blue-50 rounded text-xs space-y-1 mb-3">
                        <div className="flex justify-between">
                          <span className="text-gray-700">판매가:</span>
                          <span>₩{Math.round(item.option.sellingPrice).toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-700">수수료 (+ 10%):</span>
                          <span>₩{Math.round(item.option.sellingPrice * commissionRate * 1.1).toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-700">상품 비용:</span>
                          <span>
                            ₩
                            {item.products
                              .reduce((sum, p) => {
                                const product = selectedProducts.find((sp) => sp.id === p.productId);
                                return sum + (product?.price ? product.price * p.quantity : 0);
                              }, 0)
                              .toLocaleString()}
                          </span>
                        </div>
                        <div className="flex justify-between border-t pt-1 mt-1">
                          <span className="font-semibold text-gray-900">마진:</span>
                          <span className={`font-bold ${marginColor}`}>₩{Math.round(margin).toLocaleString()}</span>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )
            )}
          </div>
        )}

        {editingOptionId === null && (
          !isOptionFormOpen ? (
            <button
              type="button"
              onClick={() => {
                clearOptionForm();
                setIsOptionFormOpen(true);
              }}
              disabled={!selectedSellerId || !selectedPlatform || selectedProducts.length === 0 || !selectedCategory || !selectedCarrierRateId || !selectedPackageId}
              className={`w-full px-4 py-2 font-medium rounded-lg transition-colors ${
                !selectedSellerId || !selectedPlatform || selectedProducts.length === 0 || !selectedCategory || !selectedCarrierRateId || !selectedPackageId
                  ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  : 'bg-blue-600 text-white hover:bg-blue-700'
              }`}
            >
              + 옵션 추가
            </button>
          ) : (
            <div className="space-y-3 p-4 border border-dashed border-gray-300 rounded-lg bg-gray-50">
              <h3 className="font-medium text-sm">새 옵션 추가</h3>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">옵션명 *</label>
            <input
              type="text"
              value={newOptionName}
              onChange={(e) => setNewOptionName(e.target.value)}
              placeholder="Blue M"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">물품 수량 *</label>
            <div className="space-y-2 p-2 border border-gray-300 rounded bg-white max-h-48 overflow-y-auto">
              {selectedProducts.length > 0 ? (
                selectedProducts.map((product) => (
                  <div key={product.id} className="flex items-center gap-2">
                    <div className="flex-1">
                      <p className="text-sm text-gray-900">{product.productName}</p>
                      {product.price && <p className="text-xs text-gray-500">₩{Math.round(product.price).toLocaleString()}</p>}
                    </div>
                    <input
                      type="number"
                      min="1"
                      defaultValue="1"
                      placeholder="수량"
                      onChange={(e) => {
                        setProductQuantities({
                          ...productQuantities,
                          [`add-option-${product.id}`]: parseInt(e.target.value) || 1,
                        });
                      }}
                      className="w-16 px-2 py-1 border border-gray-300 rounded text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                ))
              ) : (
                <p className="text-xs text-gray-500 py-2">선택된 상품이 없습니다</p>
              )}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">판매가 *</label>
            <input
              type="number"
              value={newOptionPrice}
              onChange={(e) => {
                const value = e.target.value;
                setNewOptionPrice(value);
              }}
              onBlur={() => {
                if (newOptionPrice) {
                  const num = parseFloat(newOptionPrice) || 0;
                  const roundedToTen = Math.floor(num / 10) * 10;
                  setNewOptionPrice(String(roundedToTen));
                }
              }}
              placeholder="29900"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            />

            {selectedProducts.length > 0 && (() => {
              const selectedProdQuantities: Array<{ productId: number; quantity: number }> = [];
              selectedProducts.forEach((product) => {
                const key = `add-option-${product.id}`;
                const quantity = productQuantities[key] || 1; // 기본값 1
                selectedProdQuantities.push({
                  productId: product.id,
                  quantity: quantity,
                });
              });

              const sellingPrice = parseFloat(newOptionPrice) || 0;
              const margin = calculateMarginPreview(sellingPrice);
              const marginRate = sellingPrice > 0 ? Math.round((margin / sellingPrice) * 100 * 100) / 100 : 0;
              const marginColor = margin > 0 ? 'text-green-600' : 'text-red-600';
              const selectedCarrierRate = carrierRates.find((cr) => cr.id === selectedCarrierRateId);
              const selectedPkg = packages.find((p) => p.id === selectedPackageId);
              const totalProductCost = selectedProdQuantities.reduce((sum, p) => {
                const product = selectedProducts.find((sp) => sp.id === p.productId);
                return sum + (product?.price ? product.price * p.quantity : 0);
              }, 0);
              const commissionFee = sellingPrice * commissionRate * 1.1;

              return (
                <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs space-y-1">
                  <p className="font-semibold text-gray-900 mb-2">마진 계산</p>
                  <div className="flex justify-between text-gray-700">
                    <span>판매가:</span>
                    <span className="font-medium">₩{Math.round(sellingPrice).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-gray-700">
                    <span>- 수수료 (+ 10%):</span>
                    <span>₩{Math.round(commissionFee).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-gray-700">
                    <span>- 상품 비용:</span>
                    <span>₩{totalProductCost.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-gray-700">
                    <span>- 배송료:</span>
                    <span>₩{(selectedCarrierRate?.cost || 0).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-gray-700">
                    <span>- 패키지:</span>
                    <span>₩{(selectedPkg?.cost || 0).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between border-t border-blue-300 pt-2 mt-2">
                    <span className="font-semibold text-gray-900">= 마진:</span>
                    <span className={`font-bold text-lg ${marginColor}`}>₩{Math.round(margin).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between pt-2">
                    <span className="text-gray-700">마진율:</span>
                    <span className="font-semibold text-gray-900">{marginRate}%</span>
                  </div>
                </div>
              );
            })()}

            {/* 마진율로 판매가 설정 */}
            <div className="mt-4 p-3 bg-purple-50 border border-purple-200 rounded-lg">
              <label className="block text-sm font-medium text-gray-700 mb-2">마진율로 판매가 설정</label>
              <div className="flex gap-2">
                <input
                  type="number"
                  value={newOptionMarginRate}
                  onChange={(e) => setNewOptionMarginRate(e.target.value)}
                  placeholder="목표 마진율 (%)"
                  min="0"
                  max="100"
                  step="0.01"
                  className="flex-1 px-4 py-2 border border-purple-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 text-sm"
                />
                <button
                  type="button"
                  onClick={() => {
                    const rate = parseFloat(newOptionMarginRate);
                    if (!isNaN(rate) && rate >= 0 && rate < 100) {
                      const newPrice = calculateSellingPriceFromMarginRate(rate);
                      const roundedPrice = Math.ceil(newPrice / 10) * 10;
                      setNewOptionPrice(String(roundedPrice));
                      setNewOptionMarginRate('');
                    }
                  }}
                  className="px-4 py-2 bg-purple-600 text-white font-medium rounded-lg hover:bg-purple-700 text-sm"
                >
                  적용
                </button>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">플랫폼 옵션 ID</label>
            <input
              type="text"
              value={newOptionPlatformId}
              onChange={(e) => setNewOptionPlatformId(e.target.value)}
              placeholder="option_abc123"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            />
          </div>

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={handleAddOption}
              className="flex-1 bg-green-600 text-white font-medium py-2 px-4 rounded-lg hover:bg-green-700"
            >
              옵션 설정 완료
            </button>
            <button
              type="button"
              onClick={handleCancelEdit}
              className="flex-1 bg-gray-300 text-gray-800 font-medium py-2 px-4 rounded-lg hover:bg-gray-400"
            >
              취소
            </button>
          </div>
            </div>
          )
        )}
      </div>

      {/* Final Submit Button */}
      <div className="sticky bottom-0 bg-white border-t border-gray-200 p-4 -mx-8 px-8">
        <button
          onClick={handleFinalSubmit}
          disabled={!isAllComplete || isSubmitting}
          className={`w-full font-bold py-3 px-4 rounded-lg transition-colors ${
            isAllComplete ? 'bg-green-600 text-white hover:bg-green-700' : 'bg-gray-300 text-gray-500 cursor-not-allowed'
          }`}
        >
          {isSubmitting ? '등록 중...' : '완료 및 등록'}
        </button>
      </div>

      {/* Product Search Modal */}
      {isProductModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-lg shadow-lg max-w-2xl w-full mx-4 h-[85vh] flex flex-col">
            <div className="sticky top-0 bg-white border-b px-6 py-4 flex justify-between items-center">
              <h2 className="text-lg font-semibold text-gray-900">상품 검색</h2>
              <button
                onClick={() => {
                  setIsProductModalOpen(false);
                  setProductModalSearchQuery('');
                  setSearchProducts([]);
                }}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>

            <div className="px-6 py-4 border-b border-gray-200 flex-shrink-0">
              <input
                type="text"
                placeholder="상품명으로 검색..."
                value={productModalSearchQuery}
                onChange={(e) => handleProductSearch(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                autoFocus
              />
              {isSearching && <p className="text-xs text-gray-500 mt-2">검색 중...</p>}
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              {isSearching ? (
                <div className="flex items-center justify-center py-8">
                  <div className="text-gray-600">검색 중...</div>
                </div>
              ) : filteredProductsForModal.length > 0 ? (
                <div className="space-y-3">
                  {filteredProductsForModal.map((product) => {
                    const imageUrl = getImageUrl(product.imageUrl, product.id);
                    return (
                      <button
                        key={product.id}
                        type="button"
                        onClick={() => handleSelectProduct(product)}
                        className="w-full text-left p-3 border border-gray-200 rounded-lg transition-colors hover:bg-blue-50 hover:border-blue-300 flex gap-3"
                      >
                        <div className="flex-shrink-0 w-20 h-20 bg-gray-100 rounded overflow-hidden flex items-center justify-center">
                          {imageUrl ? (
                            <img
                              src={imageUrl}
                              alt={product.productName}
                              className="w-full h-full object-cover"
                              onError={(e) => ((e.target as HTMLImageElement).style.display = 'none')}
                            />
                          ) : (
                            <p className="text-gray-400 text-xs text-center px-2">No Image</p>
                          )}
                        </div>
                        <div className="flex-1 min-w-0 flex flex-col justify-between">
                          <div>
                            <p className="text-xs text-gray-500">ID: {product.id}</p>
                            <p className="font-medium text-gray-900 mt-1 break-words">{product.productName}</p>
                          </div>
                          {product.price && <p className="text-sm text-blue-600 font-semibold">₩{Math.round(product.price).toLocaleString()}</p>}
                        </div>
                      </button>
                    );
                  })}
                </div>
              ) : productModalSearchQuery.trim() ? (
                <p className="text-sm text-gray-600 text-center py-8">검색 결과가 없습니다</p>
              ) : (
                <p className="text-sm text-gray-600 text-center py-8">상품을 검색해주세요</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
