'use client';

import { useState } from 'react';
import { ChevronDown, ChevronRight, Package } from 'lucide-react';
import {
  getCustomerName,
  getOrderStatusLabel,
  isOrderCancelled,
  orderLineMasterLabel,
  orderLineQuantityLabel,
  salesChannelLabel,
} from '@/domain/entities/OrderEntity';
import type { OrderGroup, OrderItem, OrderSortKey } from '@/domain/entities/OrderEntity';
import { unexpandedReasonLabel } from '@/domain/entities/StockEntity';
import { TableCard } from '@/presentation/components/ui/TableCard';
import { InternalStageBadge } from './InternalStageBadge';
import { ElevenstReservedBadge } from './ElevenstReservedBadge';
import { resolveThumbUrl } from '@/infrastructure/utils/thumbUrl';
import { formatKstWallClock } from '@/infrastructure/utils/kstWallClock';
import { DataCard } from '@/presentation/components/DataCard';
import { ZoomableThumb } from '@/presentation/components/ZoomableThumb';
import { Button } from '@/presentation/components/ui/Button';
import { NameText } from '@/presentation/components/NameText';

interface OrderTableProps {
  orders: OrderGroup[];
  isLoading: boolean;
  error: string;
  hasSearched: boolean;
  sortKey: OrderSortKey | null;
  sortDir: 'asc' | 'desc';
  onSort: (key: OrderSortKey) => void;
  onRowClick: (order: OrderItem) => void;
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  /**
   * One [송장 수정] next to the order number, shown when any line of the order has an internal stage.
   * Not passed = no button (「주문내역」); only 「출고관리」 passes it, for ADMIN only (FEATURE_2611_30 / D16).
   */
  onEditInvoice?: (order: OrderGroup) => void;
  /**
   * 선택 열을 그릴지. 미전달 = 주문내역과 완전히 같은 표(열 추가 없음).
   * 출고관리 발주처리에서만 넘긴다(PLAN 2609_17 D7).
   */
  selection?: {
    selectedIds: Set<number>;
    /** Whether the order can be picked = it has at least one pickable line (otherwise a disabled checkbox, D16). */
    isSelectable: (order: OrderGroup) => boolean;
    onToggle: (order: OrderGroup) => void;
    /** Toggles every pickable order of the current page. */
    onTogglePage: () => void;
    /** Every line of the current page's pickable orders is picked = the header checkbox is checked (D16). */
    isPageAllSelected: boolean;
  };
}

interface Column {
  key: OrderSortKey | null;
  label: string;
  align: 'left' | 'right' | 'center';
  /** Tailwind width class of the column (the table uses `table-fixed`); `undefined` = takes the remaining width. */
  width?: string;
  /** Tailwind horizontal padding of the header and body cells — narrow columns use `px-3`. */
  padX: string;
}

const COLUMNS: Column[] = [
  { key: null, label: '사진', align: 'left', width: 'w-24', padX: 'px-3' },
  // Fits a 14-digit order number on one line; longer numbers wrap inside the cell.
  { key: 'externalOrderId', label: '주문번호', align: 'left', width: 'w-36', padX: 'px-3' },
  { key: 'seller', label: '판매자/판매처', align: 'left', width: 'w-44', padX: 'px-6' },
  // A typical 3–4 character name; a longer one is cut with an ellipsis.
  { key: 'customer', label: '고객', align: 'left', width: 'w-24', padX: 'px-3' },
  { key: null, label: '주문 상품', align: 'left', padX: 'px-6' },
  { key: 'paidAt', label: '결제일', align: 'left', width: 'w-48', padX: 'px-6' },
];

const SORT_OPTIONS: { key: OrderSortKey; label: string }[] = COLUMNS.flatMap((col) => (col.key == null ? [] : [{ key: col.key, label: col.label }]));

const NO_COLLAPSED_KEYS: ReadonlySet<string> = new Set();

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
  const [collapsedState, setCollapsedState] = useState<{ rows: OrderGroup[]; keys: ReadonlySet<string> }>({
    rows: orders,
    keys: NO_COLLAPSED_KEYS,
  });
  // Collapsed orders are kept only while the same list is shown — a new list opens everything again (R7 · D26).
  const collapsedKeys = collapsedState.rows === orders ? collapsedState.keys : NO_COLLAPSED_KEYS;
  const toggleCollapsed = (key: string) => {
    const next = new Set(collapsedKeys);
    if (next.has(key)) {
      next.delete(key);
    } else {
      next.add(key);
    }
    setCollapsedState({ rows: orders, keys: next });
  };

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">{error}</div>
    );
  }

  // Narrow-screen cards (FEATURE_2611_32 / D19 · D9 · D21): one card = one order — the checkbox (22, D11), the photo 64
  // (tap = zoom), row ① channel tag (+ 「취소」 · [송장 수정]) · seller ··· order number, row ② option lines with their
  // components below (left rule), row ③ customer ··· paid time. A card tap opens the detail at the first option line.
  // 「전체 선택」 and the sort select with the direction button sit above the cards.
  const renderCards = () =>
    orders.map((order) => {
      const first = order.lines[0];
      const src =
        first.masterCoverImageUrl != null ? resolveThumbUrl(first.masterCoverImageUrl) : null;
      return (
        <DataCard
          key={order.key}
          roomy
          onClick={() => onRowClick(first)}
          selected={selection != null && order.lines.every((line) => selection.selectedIds.has(line.id))}
          selectedTone="amber"
          selection={
            selection
              ? {
                  checked: order.lines.every((line) => selection.selectedIds.has(line.id)),
                  onChange: () => selection.onToggle(order),
                  label: `${first.externalOrderId} 선택`,
                  disabled: !selection.isSelectable(order),
                  large: true,
                }
              : undefined
          }
          image={
            <ZoomableThumb
              src={src}
              alt={first.itemName ?? ''}
              imgClassName="h-16 w-16 rounded-lg border border-gray-200 bg-gray-100 object-cover"
              placeholder={
                <div className="flex h-16 w-16 items-center justify-center rounded-lg border border-gray-200 bg-gray-100 text-gray-500">
                  <Package size={26} aria-hidden />
                </div>
              }
            />
          }
          body={
            <div className="space-y-1">
              <div className="flex min-w-0 items-center gap-1.5">
                <span className="min-w-0 max-w-[50%] truncate rounded px-1.5 py-0.5 text-[11px] font-medium bg-indigo-50 text-indigo-800">
                  {salesChannelLabel(first.platform, first.accountAlias)}
                </span>
                {isOrderCancelled(order) && <OrderCancelledTag />}
                {onEditInvoice && order.lines.some((line) => line.internalStage != null) && (
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
                <span className="min-w-0 flex-1 truncate text-xs text-gray-500">{first.sellerName ?? '-'}</span>
                <span className="shrink-0 text-xs text-gray-500 tabular-nums">{first.externalOrderId}</span>
              </div>
              <OrderProductsCell
                order={order}
                inTable={false}
                collapsed={collapsedKeys.has(order.key)}
                onToggleCollapsed={() => toggleCollapsed(order.key)}
                onOpenLine={onRowClick}
              />
              <div className="flex min-w-0 items-center gap-2">
                <div className="min-w-0 flex-1">
                  <NameText kind="customer" name={getCustomerName(first)} className="text-[13px] text-gray-500" />
                </div>
                <span className="shrink-0 text-xs text-gray-500 tabular-nums">
                  {first.paidAt ? formatKstWallClock(first.paidAt) : '-'}
                </span>
              </div>
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
                className="h-[22px] w-[22px] cursor-pointer accent-brand disabled:cursor-not-allowed"
              />
              전체 선택
            </label>
          )}
          <div className="flex items-center gap-2 max-md:flex-wrap">
            <select
              aria-label="정렬"
              value={sortKey ?? ''}
              onChange={(e) => onSort(e.target.value as OrderSortKey)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
            >
              {/* The first state is 「정렬 안 함」 and cannot be picked again — the headers cannot turn sorting off
                  either (FEATURE_2610_31 D31). */}
              <option value="" disabled>
                정렬 안 함
              </option>
              {SORT_OPTIONS.map((col) => (
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
      {/* Fixed layout: long product or customer names fold inside their column instead of widening it.
          The raised scroll floor keeps the 「주문 상품」 column (the only one without a fixed width) from shrinking to nothing —
          below it the wrapper scrolls sideways. */}
      <table className="w-full table-fixed [--list-table-min-w:64rem]">
        <colgroup>
          {selection && <col className="w-10" />}
          {COLUMNS.map((col) => (
            <col key={col.label} className={col.width} />
          ))}
        </colgroup>
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
            {COLUMNS.map((col) => {
              const key = col.key;
              return key != null ? (
                <th
                  key={col.label}
                  onClick={() => onSort(key)}
                  className={`${col.padX} py-3 text-sm font-semibold text-gray-900 cursor-pointer select-none hover:bg-gray-200 transition-colors ${alignClass(col.align)}`}
                >
                  {col.label}
                  {sortKey === key && (
                    <span className="ml-1">{sortDir === 'asc' ? '▲' : '▼'}</span>
                  )}
                </th>
              ) : (
                <th key={col.label} className={`${col.padX} py-3 text-sm font-semibold text-gray-900 ${alignClass(col.align)}`}>
                  {col.label}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {orders.map((order) => (
            <tr
              key={order.key}
              onClick={() => onRowClick(order.lines[0])}
              className="align-top hover:bg-gray-50 transition-colors cursor-pointer"
            >
              {/* stopPropagation sits on the <td> so a click around the checkbox does not leak into the row click (detail modal). */}
              {selection && (
                <td className="px-3 py-3" onClick={(e) => e.stopPropagation()}>
                  <input
                    type="checkbox"
                    checked={order.lines.every((line) => selection.selectedIds.has(line.id))}
                    disabled={!selection.isSelectable(order)}
                    onChange={() => selection.onToggle(order)}
                    aria-label={`${order.lines[0].externalOrderId} 선택`}
                    className="h-4 w-4 cursor-pointer disabled:cursor-not-allowed"
                  />
                </td>
              )}
              <td className={`${COLUMNS[0].padX} py-3`}>
                <OrderThumbnail order={order.lines[0]} />
              </td>
              <td className={`${COLUMNS[1].padX} py-3 text-sm text-gray-700 whitespace-normal break-all`}>
                {order.lines[0].externalOrderId}
                {isOrderCancelled(order) && <OrderCancelledBadge />}
                {onEditInvoice && order.lines.some((line) => line.internalStage != null) && (
                  <button
                    type="button"
                    // Stops the row click (order detail) — same reason as the checkbox cell.
                    onClick={(e) => { e.stopPropagation(); onEditInvoice(order); }}
                    className="ml-2 text-xs text-blue-600 hover:underline"
                  >
                    송장 수정
                  </button>
                )}
              </td>
              <td className="px-6 py-3 text-sm text-gray-700">
                <div className="truncate">{order.lines[0].sellerName ?? '-'}</div>
                <div className="truncate text-xs text-gray-500">{salesChannelLabel(order.lines[0].platform, order.lines[0].accountAlias)}</div>
              </td>
              <td className={`${COLUMNS[3].padX} py-3 text-sm text-gray-700`}>
                <NameText kind="customer" name={getCustomerName(order.lines[0])} inTable />
              </td>
              <td className="px-6 py-3 text-sm text-gray-700">
                <OrderProductsCell
                  order={order}
                  inTable
                  collapsed={collapsedKeys.has(order.key)}
                  onToggleCollapsed={() => toggleCollapsed(order.key)}
                  onOpenLine={onRowClick}
                />
              </td>
              <td className="px-6 py-3 text-sm text-gray-700">{formatDate(order.lines[0].paidAt)}</td>
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
 * Photo cell = the master cover photo of the order's first option line (FEATURE_2611_31 / D1 · D6);
 * without one — no cover or a broken line — the 「없음」 box (D2 · D3).
 */
function OrderThumbnail({ order }: { order: OrderItem }) {
  const src = order.masterCoverImageUrl != null ? resolveThumbUrl(order.masterCoverImageUrl) : null;
  return src ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={order.itemName ?? ''}
      loading="lazy"
      // max-w-none: the base `img { max-width: 100% }` must not squeeze the photo narrower than its height.
      className="w-16 h-16 min-w-16 max-w-none shrink-0 rounded border border-gray-200 object-cover bg-gray-50"
    />
  ) : (
    <div className="w-16 h-16 min-w-16 shrink-0 rounded border border-gray-200 bg-gray-50 flex items-center justify-center text-gray-300 text-xs">
      없음
    </div>
  );
}

/** 「취소」 badge next to the order number — every line of the order is fully canceled (FEATURE_2611_30 / D6 · R9). */
function OrderCancelledBadge() {
  return (
    <span className="ml-2 inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap bg-red-50 text-red-700">
      {getOrderStatusLabel('CANCELLED')}
    </span>
  );
}

/** 「취소」 tag of the narrow-screen card (FEATURE_2611_32 / D9 ①) — the wide table keeps `OrderCancelledBadge`. */
function OrderCancelledTag() {
  return (
    <span className="shrink-0 rounded px-1.5 py-0.5 text-[11px] font-semibold whitespace-nowrap bg-cancel-soft text-cancel">
      {getOrderStatusLabel('CANCELLED')}
    </span>
  );
}

/**
 * 「주문 상품」 cell (FEATURE_2611_30 / D5 · D18 · D21 · D23 ~ D25 · D27 · D28 · D32): one block per option line —
 * 「{master product} · {master option}」 (a broken line = the channel product name in gray + the reason text), the quantity
 * tail and the stage · reserved badges. One chevron per order (shown only when some line has components) toggles every
 * line at once: folded = 「(구성상품 N개)」 after the quantity, open = the component products listed one per row under the
 * line. Tapping an option text opens the detail at that line.
 */
function OrderProductsCell({
  order,
  inTable,
  collapsed,
  onToggleCollapsed,
  onOpenLine,
}: {
  order: OrderGroup;
  inTable: boolean;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  onOpenLine: (line: OrderItem) => void;
}) {
  return (
    <div className="flex items-start gap-2">
      {order.lines.some((line) => line.components.length > 0) && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onToggleCollapsed();
          }}
          aria-label={collapsed ? '구성상품 펼치기' : '구성상품 접기'}
          aria-expanded={!collapsed}
          className="mt-0.5 shrink-0 text-gray-500 hover:text-gray-900 transition-colors"
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>
      )}
      <div className="min-w-0 flex-1 space-y-1.5">
        {order.lines.map((line) => {
          const masterLabel = orderLineMasterLabel(line);
          const componentCount = line.components.length;
          return (
            <div key={line.id} className="min-w-0">
              <div className="flex min-w-0 flex-wrap items-center gap-x-1 gap-y-0.5">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenLine(line);
                  }}
                  className="min-w-0 text-left hover:underline"
                >
                  <NameText
                    kind="product"
                    name={masterLabel ?? line.itemName}
                    inTable={inTable}
                    className={
                      inTable
                        ? masterLabel == null
                          ? 'text-gray-400'
                          : undefined
                        : masterLabel == null
                          ? 'text-[15px] font-medium text-gray-400'
                          : 'text-[15px] font-medium text-gray-900'
                    }
                  />
                </button>
                <span
                  className={
                    inTable ? 'shrink-0 whitespace-nowrap' : 'shrink-0 whitespace-nowrap text-[13px] text-gray-900'
                  }
                >
                  {orderLineQuantityLabel(line)}
                </span>
                {inTable && collapsed && componentCount > 0 && (
                  <span className="shrink-0 whitespace-nowrap text-gray-500">(구성상품 {componentCount}개)</span>
                )}
                {masterLabel == null && line.unexpandedReason != null && (
                  <span className="shrink-0 text-xs text-gray-500">{unexpandedReasonLabel(line.unexpandedReason)}</span>
                )}
                <InternalStageBadge stage={line.internalStage} />
                <ElevenstReservedBadge reservedSale={line.reservedSale} />
              </div>
              {inTable ? (
                !collapsed &&
                componentCount > 0 && (
                  <ul className="mt-1 space-y-0.5 border-l border-gray-200 pl-3 text-gray-600">
                    {line.components.map((component, index) => (
                      <li key={index} className="flex items-start gap-1">
                        <NameText kind="product" name={component.productName} inTable={inTable} />
                        <span className="shrink-0 whitespace-nowrap">× {component.quantity}</span>
                      </li>
                    ))}
                  </ul>
                )
              ) : componentCount === 0 ? (
                <p className="mt-0.5 text-[13px] text-gray-600">-</p>
              ) : collapsed ? (
                <p className="mt-0.5 text-[13px] text-gray-600">구성상품 {componentCount}개</p>
              ) : (
                <ul className="mt-0.5 space-y-0.5 border-l-2 border-gray-200 pl-2">
                  {line.components.map((component, index) => (
                    <li key={index} className="flex min-w-0 items-start gap-1 text-[13px]">
                      <NameText kind="product" name={component.productName} inTable={false} className="text-gray-600" />
                      <span className="shrink-0 whitespace-nowrap font-bold text-gray-900">× {component.quantity}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
