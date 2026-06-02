'use client';

import type { Seller } from '@/domain/entities/SellerEntity';

interface SellerTableProps {
  sellers: Seller[];
  isLoading: boolean;
  error: string;
  hasSearched: boolean;
  onView: (seller: Seller) => void;
  onEdit: (seller: Seller) => void;
  onDelete: (id: number) => void;
}

export function SellerTable({
  sellers,
  isLoading,
  error,
  hasSearched,
  onView,
  onEdit,
  onDelete,
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
                <th className="px-6 py-3 text-center text-sm font-semibold text-gray-900">액션</th>
              </tr>
            </thead>
            <tbody>
              {[...Array(5)].map((_, i) => (
                <tr key={i} className="border-b border-gray-200">
                  {[...Array(4)].map((_, j) => (
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
              <th className="px-6 py-3 text-center text-sm font-semibold text-gray-900">액션</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {sellers.map((seller) => (
              <tr key={seller.id} className="hover:bg-gray-50 transition-colors">
                <td className="px-6 py-3 text-sm text-gray-700">{seller.id}</td>
                <td className="px-6 py-3 text-sm text-gray-700">{seller.sellerName}</td>
                <td className="px-6 py-3 text-sm text-gray-700">{seller.businessRegistration}</td>
                <td className="px-6 py-3 text-center space-x-2">
                  <button
                    onClick={() => onView(seller)}
                    className="px-3 py-1 text-xs bg-blue-50 text-blue-600 rounded hover:bg-blue-100 transition-colors"
                  >
                    조회
                  </button>
                  <button
                    onClick={() => onEdit(seller)}
                    className="px-3 py-1 text-xs bg-green-50 text-green-600 rounded hover:bg-green-100 transition-colors"
                  >
                    수정
                  </button>
                  <button
                    onClick={() => onDelete(seller.id)}
                    className="px-3 py-1 text-xs bg-red-50 text-red-600 rounded hover:bg-red-100 transition-colors"
                  >
                    삭제
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
