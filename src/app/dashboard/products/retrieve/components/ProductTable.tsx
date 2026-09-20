'use client';

import { useRouter } from 'next/navigation';
import { ROUTES } from '@/config/routes';
import { DataCard } from '@/presentation/components/DataCard';
import { ViewModeToggle } from '@/presentation/components/ViewModeToggle';
import { useIsMobile } from '@/presentation/hooks/useIsMobile';
import { useListViewStore } from '@/infrastructure/stores/listViewStore';
import { getProductThumbUrl } from '@/infrastructure/utils/imageUrl';
import { detailHrefWithReturn } from '@/infrastructure/utils/listReturn';
import { formatKrw } from '@/infrastructure/utils/money';
import type { Product } from '@/domain/entities/Product';

interface ProductTableProps {
  products: Product[];
  isLoading: boolean;
  error: string | null;
  currentPage: number;
  pageSize: number;
  /** 목록의 조회 조건(URL 쿼리스트링). 상세에 실어 보내 [← 목록] 이 같은 페이지로 돌아오게 한다. */
  listQuery?: string;
}

export function ProductTable({
  products,
  isLoading,
  error,
  currentPage,
  pageSize,
  listQuery = '',
}: ProductTableProps) {
  const router = useRouter();
  const openDetail = (id: number) =>
    router.push(detailHrefWithReturn(ROUTES.PRODUCT_DETAIL(id), listQuery));
  const isMobile = useIsMobile();
  const viewMode = useListViewStore((state) => state.viewMode);
  // Card view is a narrow-screen affordance only; md+ always shows the table.
  const showCards = isMobile && viewMode === 'card';

  const formatDate = (dateString: string): string => {
    return dateString.substring(0, 10);
  };

  // Older products were registered without a barcode; keep the column aligned.
  const barcode = (product: Product): string => product.barcodeId || '-';

  // Representative image as a thumbnail; a product without one keeps the row
  // height stable with a placeholder box (same shape as the purchase list).
  const thumbnail = (product: Product) => {
    const src = getProductThumbUrl(product.imageUrl, product.id);
    return src ? (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={product.productName}
        className="w-10 h-10 rounded border border-gray-200 object-cover bg-gray-50"
      />
    ) : (
      <div className="w-10 h-10 rounded border border-gray-200 bg-gray-50 flex items-center justify-center text-gray-300 text-xs">
        없음
      </div>
    );
  };

  const statusChip = (active: boolean) => (
    <span
      className={`px-2 py-1 rounded-full text-xs font-medium ${
        active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
      }`}
    >
      {active ? '활성' : '비활성'}
    </span>
  );

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
    <div className="space-y-3">
      {/* Narrow-screen only: let the user switch table (h-scroll) ↔ cards. */}
      <div className="flex justify-end md:hidden">
        <ViewModeToggle />
      </div>

      {/* Table: always on md+. Below md it stays unless the user picks card view.
          whitespace-nowrap keeps text on one line so columns shrink only to
          content width, then scroll (no vertical character wrapping). */}
      <div
        className={`${
          showCards ? 'hidden md:block' : 'block'
        } list-table-scroll border border-gray-300 rounded-lg bg-white`}
      >
        <table className="w-full">
          <thead className="bg-gray-100 border-b border-gray-200">
            <tr>
              <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">번호</th>
              <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">이미지</th>
              <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">상품명</th>
              <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900">바코드</th>
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
                onClick={() => openDetail(product.id)}
                className="border-b border-gray-300 hover:bg-gray-50 cursor-pointer transition-colors"
              >
                <td className="px-4 py-3 text-sm text-gray-900">{currentPage * pageSize + index + 1}</td>
                <td className="px-4 py-3">{thumbnail(product)}</td>
                <td className="px-4 py-3 text-sm text-gray-900">{product.productName}</td>
                <td className="px-4 py-3 text-sm text-gray-900">{barcode(product)}</td>
                <td className="px-4 py-3 text-sm text-gray-900">{product.brand}</td>
                <td className="px-4 py-3 text-sm text-gray-900">{formatKrw(product.price)}</td>
                <td className="px-4 py-3 text-sm text-gray-900">{product.store}</td>
                <td className="px-4 py-3 text-sm">{statusChip(product.active)}</td>
                <td className="px-4 py-3 text-sm text-gray-900">{formatDate(product.createdDate)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Below md + card mode: one DataCard per row, same tap → detail. */}
      {showCards && (
        <div className="md:hidden space-y-3">
          {products.map((product) => (
            <DataCard
              key={product.id}
              onClick={() => openDetail(product.id)}
              fields={[
                { label: '이미지', value: thumbnail(product) },
                { label: '상품명', value: product.productName },
                { label: '바코드', value: barcode(product) },
                { label: '브랜드', value: product.brand },
                { label: '가격', value: formatKrw(product.price) },
                { label: '구매처', value: product.store },
                { label: '상태', value: statusChip(product.active) },
                { label: '등록일', value: formatDate(product.createdDate) },
              ]}
            />
          ))}
        </div>
      )}
    </div>
  );
}
