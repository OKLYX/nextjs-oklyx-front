'use client';

import { Fragment, useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import type { Seller } from '@/domain/entities/SellerEntity';
import { SellerChannelSection } from './SellerChannelSection';
import { SellerCardSection } from './SellerCardSection';
import { TableCard } from '@/presentation/components/ui/TableCard';
import { DataCard } from '@/presentation/components/DataCard';

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
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());

  const toggleExpanded = (sellerId: number) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(sellerId)) {
        next.delete(sellerId);
      } else {
        next.add(sellerId);
      }
      return next;
    });
  };
  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">{error}</div>
    );
  }

  // Narrow-screen cards (FEATURE_2610_31 D14 · D33 · D37): the app's seller card — fold button on the left, name,
  // 「사업자: …」; the table's ID at the bottom; the channels and payment cards open inside the card.
  const renderCards = () =>
    sellers.map((seller) => {
      const isExpanded = expandedIds.has(seller.id);
      return (
        <DataCard
          key={seller.id}
          onClick={onRowClick ? () => onRowClick(seller.id) : undefined}
          image={
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                toggleExpanded(seller.id);
              }}
              aria-label={isExpanded ? '판매채널 접기' : '판매채널 펼치기'}
              aria-expanded={isExpanded}
              className="text-gray-500 hover:text-gray-900 transition-colors"
            >
              {isExpanded ? <ChevronDown className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
            </button>
          }
          title={<span className="text-base">{seller.sellerName}</span>}
          body={<p className="text-xs text-gray-500">사업자: {seller.businessRegistration}</p>}
          extraFields={[{ label: 'ID', value: seller.id }]}
          expansion={
            isExpanded ? (
              <>
                <SellerChannelSection sellerId={seller.id} sellerName={seller.sellerName} />
                {sellers.length !== 1 && <SellerCardSection sellerId={seller.id} sellerName={seller.sellerName} />}
              </>
            ) : undefined
          }
        />
      );
    });

  return (
    <TableCard
      renderCards={renderCards}
      isLoading={isLoading}
      isEmpty={!hasSearched || sellers.length === 0}
      emptyMessage={hasSearched ? '검색 결과가 없습니다.' : '검색을 수행해주세요.'}
    >
      <table className="w-full">
        <thead className="bg-gray-100 border-b border-gray-200">
          <tr>
            <th className="w-12 px-6 py-3"></th>
            <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">ID</th>
            <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">판매자명</th>
            <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
              사업자등록번호
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {sellers.map((seller) => {
            const isExpanded = expandedIds.has(seller.id);
            return (
              <Fragment key={seller.id}>
                <tr
                  onClick={() => onRowClick?.(seller.id)}
                  className={`transition-colors ${onRowClick ? 'hover:bg-gray-100 cursor-pointer' : 'hover:bg-gray-50'}`}
                >
                  <td className="px-6 py-3">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleExpanded(seller.id);
                      }}
                      aria-label={isExpanded ? '판매채널 접기' : '판매채널 펼치기'}
                      aria-expanded={isExpanded}
                      className="text-gray-500 hover:text-gray-900 transition-colors"
                    >
                      {isExpanded ? (
                        <ChevronDown className="h-5 w-5" />
                      ) : (
                        <ChevronRight className="h-5 w-5" />
                      )}
                    </button>
                  </td>
                  <td className="px-6 py-3 text-sm text-gray-700">{seller.id}</td>
                  <td className="px-6 py-3 text-sm text-gray-700">{seller.sellerName}</td>
                  <td className="px-6 py-3 text-sm text-gray-700">{seller.businessRegistration}</td>
                </tr>
                {isExpanded && (
                  <tr>
                    <td colSpan={4} className="p-0">
                      <SellerChannelSection sellerId={seller.id} sellerName={seller.sellerName} />
                      {/* FEATURE_2610_18 D52 · D53: payment cards only when there is more than one seller. */}
                      {sellers.length !== 1 && (
                        <SellerCardSection sellerId={seller.id} sellerName={seller.sellerName} />
                      )}
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </TableCard>
  );
}
