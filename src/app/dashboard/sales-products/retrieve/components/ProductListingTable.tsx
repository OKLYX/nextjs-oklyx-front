'use client';

import { Fragment } from 'react';
import { useRouter } from 'next/navigation';
import { ROUTES } from '@/config/routes';
import type { ProductListing } from '@/domain/entities/ProductListingEntity';

interface ProductListingTableProps {
  listings: ProductListing[];
  isLoading: boolean;
  error: string;
  hasSearched: boolean;
  expandedListingId: number | null;
  onRowClick: (id: number) => void;
  onSaveState?: () => void;
}

export function ProductListingTable({
  listings,
  isLoading,
  error,
  hasSearched,
  expandedListingId,
  onRowClick,
  onSaveState,
}: ProductListingTableProps) {
  const router = useRouter();

  const handleRowNavigate = (id: number) => {
    // 상태 저장 후 이동
    onSaveState?.();
    router.push(ROUTES.SALES_PRODUCTS_RETRIEVE_DETAILS(id));
  };

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-100 border-b border-gray-200">
              <tr>
                <th className="px-3 py-3 text-center text-sm font-semibold text-gray-900 w-10"></th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">ID</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">플랫폼</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">상품 ID</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">상품명</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">카테고리</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">배송사</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">패키지</th>
              </tr>
            </thead>
            <tbody>
              {[...Array(5)].map((_, i) => (
                <tr key={i} className="border-b border-gray-200">
                  {[...Array(8)].map((_, j) => (
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

  if (listings.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">
        조회 결과가 없습니다.
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-100 border-b border-gray-200">
            <tr>
              <th className="px-3 py-3 text-center text-sm font-semibold text-gray-900 w-10"></th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">ID</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">플랫폼</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">상품 ID</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">상품명</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">카테고리</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">배송사</th>
              <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">패키지</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {listings.map((listing) => (
              <Fragment key={listing.id}>
                <tr className="hover:bg-gray-50 transition-colors">
                  <td className="px-3 py-3 text-center">
                    <button
                      onClick={() => onRowClick(listing.id)}
                      className="inline-flex items-center justify-center w-8 h-8 text-gray-600 hover:bg-gray-200 rounded transition-colors"
                    >
                      {expandedListingId === listing.id ? '▲' : '▼'}
                    </button>
                  </td>
                  <td
                    onClick={() => handleRowNavigate(listing.id)}
                    className="px-6 py-3 text-sm text-gray-700 cursor-pointer"
                  >
                    {listing.id}
                  </td>
                  <td
                    onClick={() => handleRowNavigate(listing.id)}
                    className="px-6 py-3 text-sm text-gray-700 cursor-pointer"
                  >
                    {listing.platform}
                  </td>
                  <td
                    onClick={() => handleRowNavigate(listing.id)}
                    className="px-6 py-3 text-sm text-gray-700 cursor-pointer"
                  >
                    {listing.platformProductId}
                  </td>
                  <td
                    onClick={() => handleRowNavigate(listing.id)}
                    className="px-6 py-3 text-sm text-gray-700 cursor-pointer"
                  >
                    {listing.name}
                  </td>
                  <td
                    onClick={() => handleRowNavigate(listing.id)}
                    className="px-6 py-3 text-sm text-gray-700 cursor-pointer"
                  >
                    {listing.categoryName || '-'}
                  </td>
                  <td
                    onClick={() => handleRowNavigate(listing.id)}
                    className="px-6 py-3 text-sm text-gray-700 cursor-pointer"
                  >
                    {listing.carrierName || '-'}
                  </td>
                  <td
                    onClick={() => handleRowNavigate(listing.id)}
                    className="px-6 py-3 text-sm text-gray-700 cursor-pointer"
                  >
                    {listing.packageType || '-'}
                  </td>
                </tr>
                {expandedListingId === listing.id && (
                  <tr className="bg-gray-50">
                    <td colSpan={8} className="px-6 py-4">
                      {listing.options && listing.options.length > 0 ? (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                              <thead className="bg-gray-200">
                                <tr>
                                  <th className="px-3 py-2 text-left text-gray-800">옵션명</th>
                                  <th className="px-3 py-2 text-right text-gray-800">판매가</th>
                                  <th className="px-3 py-2 text-right text-gray-800">마진</th>
                                  <th className="px-3 py-2 text-right text-gray-800">마진율</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-gray-300">
                                {listing.options.map((option) => (
                                  <tr key={option.id} className="hover:bg-gray-100">
                                    <td className="px-3 py-2 text-gray-700">{option.optionName}</td>
                                    <td className="px-3 py-2 text-right text-gray-700">
                                      {option.sellingPrice.toLocaleString('ko-KR')}
                                    </td>
                                    <td className="px-3 py-2 text-right text-gray-700">
                                      {option.margin !== undefined
                                        ? option.margin.toLocaleString('ko-KR')
                                        : '-'}
                                    </td>
                                    <td className="px-3 py-2 text-right text-gray-700">
                                      {option.marginRate !== undefined
                                        ? `${(option.marginRate * 100).toFixed(2)}%`
                                        : '-'}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                      ) : (
                        <div className="text-gray-500">등록된 옵션이 없습니다.</div>
                      )}
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
