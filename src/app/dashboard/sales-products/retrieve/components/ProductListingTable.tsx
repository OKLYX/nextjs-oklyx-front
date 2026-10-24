'use client';

import { Fragment } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ROUTES } from '@/config/routes';
import type { ProductListing } from '@/domain/entities/ProductListingEntity';
import { TableCard } from '@/presentation/components/ui/TableCard';
import { DataCard, DataCardSwitch } from '@/presentation/components/DataCard';
import { platformName } from '@/config/platforms';

// Narrow-screen option grid (FEATURE_2610_31 D14) — the app's option rows: 「옵션명」 3 · 「판매가」 2 · 「마진」 2 · 「마진율」 2.
const OPTION_GRID = 'grid grid-cols-[3fr_2fr_2fr_2fr] gap-2 text-xs';

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

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">{error}</div>
    );
  }

  // The options of one listing — under the table row and inside the narrow-screen card. Narrow-screen cards
  // (FEATURE_2610_31 D14 · D25): the app's option rows — a header line, then one floating card per option.
  const optionsList = (listing: ProductListing) =>
    listing.options && listing.options.length > 0 ? (
      <DataCardSwitch
        placement="nested"
        className="list-table-scroll"
        renderCards={() => [
          <div key="header" className={`${OPTION_GRID} px-3 font-semibold text-gray-900`}>
            <span>옵션명</span>
            <span className="text-right">판매가</span>
            <span className="text-right">마진</span>
            <span className="text-right">마진율</span>
          </div>,
          ...(listing.options ?? []).map((option) => (
            <DataCard
              key={option.id}
              body={
                <div className={`${OPTION_GRID} text-gray-500`}>
                  <span className="break-words">{option.optionName}</span>
                  <span className="text-right">{option.sellingPrice.toLocaleString('ko-KR')}</span>
                  <span className="text-right">
                    {option.margin !== undefined ? option.margin.toLocaleString('ko-KR') : '-'}
                  </span>
                  <span className="text-right">
                    {option.marginRate !== undefined ? `${(option.marginRate * 100).toFixed(2)}%` : '-'}
                  </span>
                </div>
              }
            />
          )),
        ]}
      >
        <table className="w-full text-sm">
          <thead className="bg-gray-100 border-b border-gray-200">
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
                  {option.margin !== undefined ? option.margin.toLocaleString('ko-KR') : '-'}
                </td>
                <td className="px-3 py-2 text-right text-gray-700">
                  {option.marginRate !== undefined ? `${(option.marginRate * 100).toFixed(2)}%` : '-'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </DataCardSwitch>
    ) : (
      <div className="text-gray-500">등록된 옵션이 없습니다.</div>
    );

  // Narrow-screen cards (FEATURE_2610_31 D14 · D33 · D37): the app's listing card — bold name, platform badge with
  // 「상품 ID」, the 「카테고리」 · 「배송사」 · 「패키지」 line, the fold button on the right; the table's 「ID」 · 「마스터」 at the bottom.
  // The options open inside the card (floating option cards under a header line). A tap opens the detail.
  const renderCards = () =>
    listings.map((listing) => (
      <DataCard
        key={listing.id}
        onClick={() => handleRowNavigate(listing.id)}
        title={<span className="line-clamp-1">{listing.name}</span>}
        trailing={
          <button
            onClick={(e) => {
              e.stopPropagation();
              onRowClick(listing.id);
            }}
            className="inline-flex items-center justify-center w-8 h-8 text-gray-600 hover:bg-gray-200 rounded transition-colors"
          >
            {expandedListingId === listing.id ? '▲' : '▼'}
          </button>
        }
        body={
          <div className="space-y-1 text-xs text-gray-500">
            <div className="flex items-center gap-2">
              <span className="shrink-0 rounded bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-700">
                {platformName(listing.platform)}
              </span>
              <span className="truncate">상품 ID: {listing.platformProductId}</span>
            </div>
            <p className="line-clamp-2">
              카테고리: {listing.categoryName || '-'}  ·  배송사: {listing.carrierName || '-'}  ·  패키지:{' '}
              {listing.packageType || '-'}
            </p>
          </div>
        }
        extraFields={[
          { label: 'ID', value: listing.id },
          {
            label: '마스터',
            value: listing.masterProductId ? (
              <Link
                href={ROUTES.MASTER_PRODUCT_DETAIL(listing.masterProductId)}
                onClick={(e) => {
                  e.stopPropagation();
                  onSaveState?.();
                }}
                className="inline-flex items-center rounded bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700 hover:bg-gray-200"
              >
                연결됨
              </Link>
            ) : (
              <span className="text-gray-500">미연결</span>
            ),
          },
        ]}
        expansion={expandedListingId === listing.id ? optionsList(listing) : undefined}
      />
    ));

  return (
    <TableCard
      renderCards={renderCards}
      isLoading={isLoading}
      isEmpty={!hasSearched || listings.length === 0}
      emptyMessage={hasSearched ? '조회 결과가 없습니다.' : '검색을 수행해주세요.'}
    >
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
            <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">마스터</th>
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
                {/* 행 이동은 각 td onClick 이 담당한다 — 이 td 에는 onClick 을 붙이지 않는다. */}
                {/* 2609_71/D9: 셀 → 마스터 승격 경로는 사라졌다. 떼어낸 셀은 「쿠팡 ID 로 마스터 만들기」가 담당한다. */}
                <td className="px-6 py-3 text-sm text-gray-700">
                  {listing.masterProductId ? (
                    <Link
                      href={ROUTES.MASTER_PRODUCT_DETAIL(listing.masterProductId)}
                      onClick={onSaveState}
                      className="inline-flex items-center rounded bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700 hover:bg-gray-200"
                    >
                      연결됨
                    </Link>
                  ) : (
                    <span className="text-gray-500">미연결</span>
                  )}
                </td>
              </tr>
              {expandedListingId === listing.id && (
                <tr className="bg-gray-50">
                  <td colSpan={9} className="px-6 py-4">
                    {optionsList(listing)}
                  </td>
                </tr>
              )}
            </Fragment>
          ))}
        </tbody>
      </table>
    </TableCard>
  );
}
