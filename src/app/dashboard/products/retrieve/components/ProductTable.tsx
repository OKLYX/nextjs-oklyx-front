'use client';

import { useRouter } from 'next/navigation';
import { ROUTES } from '@/config/routes';
import type { Product } from '@/domain/entities/Product';

interface ProductTableProps {
  products: Product[];
  isLoading: boolean;
  error: string | null;
  currentPage: number;
  pageSize: number;
}

export function ProductTable({ products, isLoading, error, currentPage, pageSize }: ProductTableProps) {
  const router = useRouter();

  const formatPrice = (price: number): string => {
    return new Intl.NumberFormat('ko-KR', {
      style: 'currency',
      currency: 'KRW',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(price);
  };

  const formatDate = (dateString: string): string => {
    return dateString.substring(0, 10);
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <p className="text-gray-600">상품을 불러오는 중...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
        <p className="text-red-700">오류: {error}</p>
      </div>
    );
  }

  if (products.length === 0) {
    return (
      <div className="flex justify-center items-center h-64">
        <p className="text-gray-600">상품이 없습니다.</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto border border-gray-300 rounded-lg bg-white">
      <table className="w-full">
        <thead className="bg-gray-100 border-b border-gray-300">
          <tr>
            <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">번호</th>
            <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">상품명</th>
            <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">브랜드</th>
            <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">가격</th>
            <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">구매처</th>
            <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">상태</th>
            <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">등록일</th>
          </tr>
        </thead>
        <tbody>
          {products.map((product, index) => (
            <tr
              key={product.id}
              onClick={() => router.push(ROUTES.PRODUCT_DETAIL(product.id))}
              className="border-b border-gray-300 hover:bg-gray-50 cursor-pointer transition-colors"
            >
              <td className="px-4 py-3 text-sm text-gray-900">{currentPage * pageSize + index + 1}</td>
              <td className="px-4 py-3 text-sm text-gray-900">{product.productName}</td>
              <td className="px-4 py-3 text-sm text-gray-900">{product.brand}</td>
              <td className="px-4 py-3 text-sm text-gray-900">{formatPrice(product.price)}</td>
              <td className="px-4 py-3 text-sm text-gray-900">{product.store}</td>
              <td className="px-4 py-3 text-sm">
                <span
                  className={`px-2 py-1 rounded-full text-xs font-medium ${
                    product.active
                      ? 'bg-green-100 text-green-800'
                      : 'bg-gray-100 text-gray-800'
                  }`}
                >
                  {product.active ? '활성' : '비활성'}
                </span>
              </td>
              <td className="px-4 py-3 text-sm text-gray-900">{formatDate(product.createdDate)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
