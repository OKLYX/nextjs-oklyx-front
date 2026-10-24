'use client';

import { getCustomerName } from '@/domain/entities/OrderEntity';
import type { OrderItem } from '@/domain/entities/OrderEntity';
import { TableCard } from '@/presentation/components/ui/TableCard';
import { InternalStageBadge } from './InternalStageBadge';
import { ElevenstReservedBadge } from './ElevenstReservedBadge';
import { getProductThumbUrl } from '@/infrastructure/utils/imageUrl';
import { DataCard } from '@/presentation/components/DataCard';
import { ZoomableThumb } from '@/presentation/components/ZoomableThumb';
import { Button } from '@/presentation/components/ui/Button';

interface OrderTableProps {
  orders: OrderItem[];
  isLoading: boolean;
  error: string;
  hasSearched: boolean;
  sortKey: keyof OrderItem | null;
  sortDir: 'asc' | 'desc';
  onSort: (key: keyof OrderItem) => void;
  onRowClick: (order: OrderItem) => void;
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  /**
   * 내부 단계 주문 줄의 [송장 수정](FEATURE_2609_75 / D18). 미전달 = 버튼 없음(주문내역).
   * 출고관리에서 ADMIN 일 때만 넘긴다.
   */
  onEditInvoice?: (order: OrderItem) => void;
  /**
   * 선택 열을 그릴지. 미전달 = 주문내역과 완전히 같은 표(열 추가 없음).
   * 출고관리 발주처리에서만 넘긴다(PLAN 2609_17 D7).
   */
  selection?: {
    selectedIds: Set<number>;
    /** 그 행이 선택 가능한지(비대상 행은 disabled 체크박스). */
    isSelectable: (order: OrderItem) => boolean;
    onToggle: (id: number) => void;
    /** 현재 페이지의 선택 가능 행 전체 토글. */
    onTogglePage: () => void;
    /** 현재 페이지의 선택 가능 행이 모두 선택됨 = 헤더 체크박스 checked */
    isPageAllSelected: boolean;
  };
}

interface Column {
  key: keyof OrderItem;
  label: string;
  align: 'left' | 'right' | 'center';
}

const COLUMNS: Column[] = [
  { key: 'externalOrderId', label: '주문번호', align: 'left' },
  { key: 'receiverName', label: '고객명', align: 'left' },
  { key: 'itemName', label: '상품명', align: 'left' },
  { key: 'orderCount', label: '주문수량', align: 'right' },
  { key: 'cancelCount', label: '취소', align: 'right' },
  { key: 'paidAt', label: '결제일', align: 'left' },
];

// Format ISO LocalDateTime to ko-KR readable string; '-' for null
function formatDate(value: string | null): string {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('ko-KR');
}

function alignClass(align: Column['align']): string {
  if (align === 'right') return 'text-right';
  if (align === 'center') return 'text-center';
  return 'text-left';
}

export function OrderTable({
  orders,
  isLoading,
  error,
  hasSearched,
  sortKey,
  sortDir,
  onSort,
  onRowClick,
  currentPage,
  totalPages,
  onPageChange,
  selection,
  onEditInvoice,
}: OrderTableProps) {
  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">{error}</div>
    );
  }

  // Narrow-screen cards (FEATURE_2610_31 D13 · D14 · D31 · D34): the app's order card — the row checkbox
  // (「출고관리」 acknowledgement), the photo (tap = zoom), bold order number with the stage · reserved badges and [송장 수정], 「고객 …」,
  // the product, 「주문수량 N · 취소 N」 and 「결제일 …」. A tap opens the order like a row tap. 「전체 선택」 and the
  // sort select with the direction button sit above the cards.
  const renderCards = () =>
    orders.map((order) => {
      const src =
        order.thumbnailProductId != null
          ? getProductThumbUrl(order.thumbnailImageUrl, order.thumbnailProductId)
          : null;
      return (
        <DataCard
          key={order.id}
          onClick={() => onRowClick(order)}
          selection={
            selection
              ? {
                  checked: selection.selectedIds.has(order.id),
                  onChange: () => selection.onToggle(order.id),
                  label: `${order.externalOrderId} 선택`,
                  disabled: !selection.isSelectable(order),
                }
              : undefined
          }
          image={
            <ZoomableThumb
              src={src}
              alt={order.itemName ?? ''}
              imgClassName="h-14 w-14 rounded-md bg-gray-200 object-cover"
              placeholder={
                <div className="flex h-14 w-14 items-center justify-center rounded-md bg-gray-200 text-xs text-gray-500">
                  없음
                </div>
              }
            />
          }
          title={order.externalOrderId}
          badges={
            <>
              <InternalStageBadge stage={order.internalStage} />
              <ElevenstReservedBadge reservedSale={order.reservedSale} />
              {onEditInvoice && order.internalStage != null && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onEditInvoice(order);
                  }}
                  className="rounded px-3 py-1 text-xs text-gray-900 hover:bg-gray-100"
                >
                  송장 수정
                </button>
              )}
            </>
          }
          body={
            <div className="space-y-1.5">
              <p className="truncate text-[13px] text-gray-500">고객 {getCustomerName(order)}</p>
              <p className="text-[13px] text-gray-900">{order.itemName ?? '-'}</p>
              <p className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-gray-500">
                <span>주문수량 {order.orderCount}</span>
                <span>취소 {order.cancelCount}</span>
              </p>
              <p className="text-xs text-gray-500">결제일 {formatDate(order.paidAt)}</p>
            </div>
          }
        />
      );
    });

  return (
    <TableCard
      isLoading={isLoading}
      isEmpty={!hasSearched || orders.length === 0}
      emptyMessage={hasSearched ? '조회 결과가 없습니다.' : '조회를 수행해주세요.'}
      renderCards={renderCards}
      cardsToolbar={
        <>
          {selection && (
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={selection.isPageAllSelected}
                disabled={!orders.some(selection.isSelectable)}
                onChange={selection.onTogglePage}
                className="h-4 w-4 cursor-pointer disabled:cursor-not-allowed"
              />
              전체 선택
            </label>
          )}
          <div className="flex items-center gap-2 max-md:flex-wrap">
            <select
              aria-label="정렬"
              value={sortKey ?? ''}
              onChange={(e) => onSort(e.target.value as keyof OrderItem)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
            >
              {/* The first state is 「정렬 안 함」 and cannot be picked again — the headers cannot turn sorting off
                  either (FEATURE_2610_31 D31). */}
              <option value="" disabled>
                정렬 안 함
              </option>
              {COLUMNS.map((col) => (
                <option key={col.key} value={col.key}>
                  {col.label}
                </option>
              ))}
            </select>
            {sortKey != null && (
              <Button type="button" variant="secondary" size="sm" onClick={() => onSort(sortKey)}>
                {sortDir === 'asc' ? '▲' : '▼'}
              </Button>
            )}
          </div>
        </>
      }
    >
      <table className="w-full">
        <thead className="bg-gray-100 border-b border-gray-200">
          <tr>
            {selection && (
              <th className="w-10 px-3 py-3">
                <input
                  type="checkbox"
                  checked={selection.isPageAllSelected}
                  disabled={!orders.some(selection.isSelectable)}
                  onChange={selection.onTogglePage}
                  aria-label="현재 페이지 전체 선택"
                  className="h-4 w-4 cursor-pointer disabled:cursor-not-allowed"
                />
              </th>
            )}
            {COLUMNS.map((col) => (
              <th
                key={col.key}
                onClick={() => onSort(col.key)}
                className={`px-6 py-3 text-sm font-semibold text-gray-900 cursor-pointer select-none hover:bg-gray-200 transition-colors ${alignClass(col.align)}`}
              >
                {col.label}
                {sortKey === col.key && (
                  <span className="ml-1">{sortDir === 'asc' ? '▲' : '▼'}</span>
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {orders.map((order) => (
            <tr
              key={order.id}
              onClick={() => onRowClick(order)}
              className="hover:bg-gray-50 transition-colors cursor-pointer"
            >
              {/* stopPropagation 은 <td> 에 건다 — 체크박스 주변 여백을 눌러도 행 클릭(상세 모달)이 새지 않게. */}
              {selection && (
                <td className="px-3 py-3" onClick={(e) => e.stopPropagation()}>
                  <input
                    type="checkbox"
                    checked={selection.selectedIds.has(order.id)}
                    disabled={!selection.isSelectable(order)}
                    onChange={() => selection.onToggle(order.id)}
                    aria-label={`${order.externalOrderId} 선택`}
                    className="h-4 w-4 cursor-pointer disabled:cursor-not-allowed"
                  />
                </td>
              )}
              <td className="px-6 py-3 text-sm text-gray-700">
                {order.externalOrderId}
                <InternalStageBadge stage={order.internalStage} />
                <ElevenstReservedBadge reservedSale={order.reservedSale} />
                {onEditInvoice && order.internalStage != null && (
                  <button
                    type="button"
                    // 행 클릭(주문 상세)이 새지 않게 막는다 — 체크박스 칸과 같은 이유.
                    onClick={(e) => { e.stopPropagation(); onEditInvoice(order); }}
                    className="ml-2 text-xs text-blue-600 hover:underline"
                  >
                    송장 수정
                  </button>
                )}
              </td>
              <td className="px-6 py-3 text-sm text-gray-700">{getCustomerName(order)}</td>
              <td className="px-6 py-3 text-sm text-gray-700">
                <div className="flex items-center gap-2">
                  <OrderThumbnail order={order} />
                  <span>{order.itemName || '-'}</span>
                </div>
              </td>
              <td className="px-6 py-3 text-sm text-right text-gray-700">{order.orderCount}</td>
              <td className="px-6 py-3 text-sm text-right text-gray-700">{order.cancelCount}</td>
              <td className="px-6 py-3 text-sm text-gray-700">{formatDate(order.paidAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {totalPages > 1 && (
        <div className="px-6 py-4 flex items-center justify-center gap-4 border-t border-gray-200 max-md:flex-wrap">
          <button
            onClick={() => onPageChange(Math.max(0, currentPage - 1))}
            disabled={currentPage === 0}
            className="px-3 py-1 border border-gray-300 rounded hover:bg-gray-50 disabled:text-gray-400 disabled:cursor-not-allowed transition-colors text-sm"
          >
            ← 이전
          </button>
          <span className="text-sm text-gray-600 max-md:min-w-0 max-md:truncate">
            {currentPage + 1} / {totalPages}
          </span>
          <button
            onClick={() => onPageChange(Math.min(totalPages - 1, currentPage + 1))}
            disabled={currentPage === totalPages - 1}
            className="px-3 py-1 border border-gray-300 rounded hover:bg-gray-50 disabled:text-gray-400 disabled:cursor-not-allowed transition-colors text-sm"
          >
            다음 →
          </button>
        </div>
      )}
    </TableCard>
  );
}

/**
 * Row thumbnail — the first component product's representative image (server-picked). Missing image or an
 * unexpanded line draws the same 「없음」 box as the product picker so row heights stay equal.
 */
function OrderThumbnail({ order }: { order: OrderItem }) {
  const src =
    order.thumbnailProductId != null
      ? getProductThumbUrl(order.thumbnailImageUrl, order.thumbnailProductId)
      : null;
  return src ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={order.itemName ?? ''}
      loading="lazy"
      className="w-10 h-10 shrink-0 rounded border border-gray-200 object-cover bg-gray-50"
    />
  ) : (
    <div className="w-10 h-10 shrink-0 rounded border border-gray-200 bg-gray-50 flex items-center justify-center text-gray-300 text-xs">
      없음
    </div>
  );
}
