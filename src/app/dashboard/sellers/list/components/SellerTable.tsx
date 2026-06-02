'use client';

import type { Seller } from '@/domain/entities/SellerEntity';

interface SellerTableProps {
  sellers: Seller[];
  isLoading: boolean;
  error: string;
  hasSearched: boolean;
  onRowClick?: (sellerId: number) => void;
}

export function SellerTable({
  sellers,
  isLoading,
  error,
  hasSearched,
  onRowClick,
}: SellerTableProps) {
  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-100 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">ID</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">판매자명</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">사업자등록번호</th>
              </tr>
            </thead>
            <tbody>
              {[...Array(5)].map((_, i) => (
                <tr key={i} className="border-b border-gray-200">
                  {[...Array(3)].map((_, j) => (
                    <td key={j} className="px-6 py-3">
                      <div className="h-4 bg-gray-200 rounded animate-pulse"></div>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
        {error}
      </div>
    );
  }

  if (!hasSearched) {
    return (
      <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">
        검색을 수행해주세요.
      </div>
    );
  }

  if (sellers.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">
        검색 결과가 없습니다.
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-100 border-b border-gray-200">
            <tr>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">ID</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">판매자명</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">사업자등록번호</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {sellers.map((seller) => (
              <tr
                key={seller.id}
                onClick={() => onRowClick?.(seller.id)}
                className={`transition-colors ${onRowClick ? 'hover:bg-gray-100 cursor-pointer' : 'hover:bg-gray-50'}`}
              >
                <td className="px-6 py-3 text-sm text-gray-700">{seller.id}</td>
                <td className="px-6 py-3 text-sm text-gray-700">{seller.sellerName}</td>
                <td className="px-6 py-3 text-sm text-gray-700">{seller.businessRegistration}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
