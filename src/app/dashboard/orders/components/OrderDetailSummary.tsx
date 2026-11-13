'use client';

import type { ReactNode } from 'react';
import { Button } from '@/presentation/components/ui/Button';
import { getProductThumbUrl } from '@/infrastructure/utils/imageUrl';
import { ROUTES } from '@/config/routes';
import { CopyIdButton } from '@/app/dashboard/master-products/[id]/components/CopyIdButton';
import type { OrderDetail, OrderDetailParcel, OrderItem, OrderLineMaster } from '@/domain/entities/OrderEntity';
import {
  PARCEL_STATUS_LABELS, getOrderStatusLabel, orderNetAmount, parcelChipLabel, salesChannelLabel,
} from '@/domain/entities/OrderEntity';
import { unexpandedReasonLabel } from '@/domain/entities/StockEntity';

interface OrderDetailSummaryProps {
  detail: OrderDetail;
  /** The clicked line — source of the payment, quantity, item ID and box ID groups; null = packing entry (R17) */
  line: OrderItem | null;
  /** Quantity group values (cancel results already applied by the opener); null = packing entry */
  quantities: { order: number; cancel: number; hold: number; purchasable: number } | null;
  /** true = the order is fully canceled — picks the 「no invoice」 text (R16) */
  fullyCanceled: boolean;
  /** Line to paint (the clicked list row), `null` = none (D33) */
  highlightLineId: number | null;
  /** Parcel id of the open chip, `null` = none open */
  openParcelId: number | null;
  onSelectParcel: (parcelId: number) => void;
  /** [상자 변경] of a packed parcel — omitted = no button (D24 · D27) */
  onChangeBox?: (parcel: OrderDetailParcel) => void;
}

const CHIP_BASE = 'px-4 py-2 text-sm font-medium rounded-full border transition-colors';
const CHIP_ACTIVE = 'bg-blue-600 text-white border-blue-600';
const CHIP_IDLE = 'bg-white text-gray-700 border-gray-300 hover:bg-gray-100';
const LINK_CLASS = 'font-medium text-blue-600 hover:underline';

// Format ISO LocalDateTime to ko-KR readable string; '-' for null
export function formatDate(value: string | null): string {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('ko-KR');
}

// Order-time amount snapshot (PLAN 2609_26 D9·D10).
// ⚠️ null is unknown, not 0 — older orders only carry what was backfilled.
// Drawing it as 0 would look like a free order, so it is rendered as '—'.
export function formatAmount(value: number | null): string {
  if (value == null) return '—';
  return `${value.toLocaleString('ko-KR')}원`;
}

/** 40×40 product photo; no photo = grey empty box. */
function Thumb({ src, alt }: { src: string | null; alt: string }) {
  if (src === null) return <div className="w-10 h-10 shrink-0 rounded bg-gray-200" />;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={alt} loading="lazy" className="w-10 h-10 shrink-0 rounded object-cover bg-gray-200" />
  );
}

/**
 * Where one order line comes from (FEATURE_2611_15 / D1 · D3 · D5 · D8 · D19 · D20) — the master product and option,
 * then every component product with its quantity; a broken link shows its reason only.
 */
function LineMaster({ lineMaster, admin }: { lineMaster: OrderLineMaster; admin: boolean }) {
  if (lineMaster.unexpandedReason !== null) {
    return <p className="mt-1 text-xs text-gray-500">{unexpandedReasonLabel(lineMaster.unexpandedReason)}</p>;
  }
  const masterName = lineMaster.masterProductName ?? '-';
  return (
    <div className="mt-2 space-y-2 text-xs text-gray-500">
      <p>
        판매상품 마스터{' '}
        {admin && lineMaster.masterProductId != null ? (
          <a
            href={ROUTES.MASTER_PRODUCT_DETAIL(lineMaster.masterProductId)}
            target="_blank"
            rel="noopener noreferrer"
            className={LINK_CLASS}
          >
            {masterName}
          </a>
        ) : (
          <span className="text-gray-900">{masterName}</span>
        )}
        {' · '}
        {lineMaster.masterOptionName ?? '-'}
      </p>
      <p className="font-medium text-gray-700">구성상품</p>
      <ul className="space-y-2">
        {lineMaster.products.map((product) => (
          <li key={product.productId} className="flex items-center gap-3">
            <Thumb src={getProductThumbUrl(product.imageUrl, product.productId)} alt={product.productName} />
            <a
              href={ROUTES.PRODUCT_DETAIL(product.productId)}
              target="_blank"
              rel="noopener noreferrer"
              className={`break-words ${LINK_CLASS}`}
            >
              {product.productName}
            </a>
            <span className="shrink-0">× {product.quantity}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex justify-between gap-2 py-2">
      <dt className="text-sm font-medium text-gray-500">{label}</dt>
      <dd className="text-sm text-gray-900 text-right">{children}</dd>
    </div>
  );
}

/**
 * Body of the shared order detail (FEATURE_2611_07 / D13 · D23 · D26 · D33 · D36 · FEATURE_2611_29 / D2 · D8 · R15 ~ R17) —
 * two columns on wide screens: left = 「상품 {N}건」 · 「결제 금액」 · 「수량 현황」, right = 「주문 정보」 · 「주문자 · 수취인」 ·
 * 「송장」 (one chip per parcel, the open chip's content below it); one column below 768px with the customer group above
 * the order info group and no 「판매처」 row. The packing entry (`line` null) has no payment or quantity group.
 * Each product line also shows its master product · master option and component products × quantity, or the broken
 * link's reason (FEATURE_2611_15) — the master name is a new-tab link only when the server says `detail.admin`, every
 * component product name is a new-tab link for everyone.
 *
 * **File**: src/app/dashboard/orders/components/OrderDetailSummary.tsx
 *
 * Presentational only — the opener loads the `OrderDetail` and owns the open chip.
 * ❌ Used only inside `OrderDetailsModal` (both modes) — never as a second order detail elsewhere (D4 · D21).
 */
export function OrderDetailSummary({
  detail,
  line,
  quantities,
  fullyCanceled,
  highlightLineId,
  openParcelId,
  onSelectParcel,
  onChangeBox,
}: OrderDetailSummaryProps) {
  const openParcel = detail.parcels.find((parcel) => parcel.parcelId === openParcelId) ?? null;
  const ordererName = detail.ordererName?.trim() ?? '';
  const receiverName = detail.receiverName?.trim() ?? '';
  const sameCustomer = ordererName !== '' && ordererName === receiverName;
  const netAmount = line == null ? null : orderNetAmount(line.lineAmount, line.discountAmount);

  return (
    <div className="grid gap-4 md:grid-cols-[1.35fr_1fr]">
      <div className="flex min-w-0 flex-col gap-4">
        <section>
          <h4 className="text-sm font-semibold text-gray-900">상품 {detail.lines.length}건</h4>
          <ul className="mt-3 space-y-2">
            {detail.lines.map((item) => (
              <li
                key={item.id}
                className={`flex items-center gap-3 rounded-lg border border-gray-200 p-3 text-sm ${
                  item.id === highlightLineId ? 'bg-blue-50' : ''
                }`}
              >
                <Thumb
                  src={item.thumbnailProductId != null
                    ? getProductThumbUrl(item.thumbnailImageUrl, item.thumbnailProductId)
                    : null}
                  alt={item.itemName ?? ''}
                />
                <div className="min-w-0 flex-1">
                  <p className="text-gray-900 break-words">{item.itemName ?? '-'}</p>
                  <p className="mt-1 text-xs text-gray-500">수량 {item.orderCount}</p>
                  {detail.lineMasters
                    ?.filter((lineMaster) => lineMaster.orderLineId === item.id)
                    .map((lineMaster) => (
                      <LineMaster key={lineMaster.orderLineId} lineMaster={lineMaster} admin={detail.admin === true} />
                    ))}
                </div>
                <span className="shrink-0 px-2 py-0.5 text-xs rounded-full bg-gray-100 text-gray-700">
                  {getOrderStatusLabel(item.status)}
                </span>
              </li>
            ))}
          </ul>
        </section>

        {line && quantities && (
          <section>
            <h4 className="text-sm font-semibold text-gray-900">결제 금액</h4>
            <dl className="mt-3 divide-y divide-gray-200">
              <Row label="단가 × 수량">
                {line.unitPrice == null ? '—' : `${formatAmount(line.unitPrice)} × ${quantities.order}`}
              </Row>
              <Row label="할인">
                {line.discountAmount == null
                  ? '—'
                  : line.discountAmount === 0 ? '없음' : formatAmount(line.discountAmount)}
              </Row>
              {line.platformDiscountAmount != null && line.platformDiscountAmount > 0 && (
                <Row label="플랫폼 부담 할인">{formatAmount(line.platformDiscountAmount)}</Row>
              )}
              <Row label="주문금액">
                <span className="font-semibold">
                  {formatAmount(netAmount)}
                  {line.discountAmount != null && line.discountAmount > 0 && netAmount != null ? ' · 할인 적용' : ''}
                </span>
              </Row>
            </dl>
          </section>
        )}

        {quantities && (
          <section>
            <h4 className="text-sm font-semibold text-gray-900">수량 현황</h4>
            <div className="mt-3 grid grid-cols-4 gap-2">
              <div className="rounded-lg bg-gray-50 p-3 text-center">
                <p className="text-xs text-gray-500">주문</p>
                <p className="text-lg font-semibold text-gray-900">{quantities.order}</p>
              </div>
              <div className="rounded-lg bg-gray-50 p-3 text-center">
                <p className="text-xs text-gray-500">취소</p>
                <p className="text-lg font-semibold text-gray-900">{quantities.cancel}</p>
              </div>
              <div className="rounded-lg bg-gray-50 p-3 text-center">
                <p className="text-xs text-gray-500">보류</p>
                <p className="text-lg font-semibold text-gray-900">{quantities.hold}</p>
              </div>
              <div className="rounded-lg bg-green-50 p-3 text-center">
                <p className="text-xs text-green-800">구매가능</p>
                <p className="text-lg font-semibold text-green-800">{quantities.purchasable}</p>
              </div>
            </div>
          </section>
        )}
      </div>

      <div className="flex min-w-0 flex-col gap-4">
        <section className="max-md:order-2">
          <h4 className="text-sm font-semibold text-gray-900">주문 정보</h4>
          <dl className="mt-3 divide-y divide-gray-200">
            <div className="max-md:hidden">
              <Row label="판매처">{salesChannelLabel(detail.platform, detail.accountAlias)}</Row>
            </div>
            <Row label="판매자">{detail.sellerName ?? '-'}</Row>
            {line && (
              <Row label="아이템 ID">
                {line.externalItemId != null && line.externalItemId !== '' ? (
                  <span className="inline-flex items-center gap-2">
                    {line.externalItemId}
                    <CopyIdButton value={line.externalItemId} />
                  </span>
                ) : '-'}
              </Row>
            )}
            {line && (
              <Row label="박스 ID">
                {line.externalBoxId != null && line.externalBoxId !== '' ? (
                  <span className="inline-flex items-center gap-2">
                    {line.externalBoxId}
                    <CopyIdButton value={line.externalBoxId} />
                  </span>
                ) : '-'}
              </Row>
            )}
            <Row label="결제일">{formatDate(detail.paidAt)}</Row>
          </dl>
        </section>

        <section className="max-md:order-1">
          <h4 className="text-sm font-semibold text-gray-900">주문자 · 수취인</h4>
          {sameCustomer ? (
            <>
              <p className="mt-3 text-sm text-gray-900">{ordererName}</p>
              <p className="mt-1 text-xs text-gray-500">수취인 = 주문자와 동일</p>
            </>
          ) : (
            <dl className="mt-3 divide-y divide-gray-200">
              <Row label="주문자">{ordererName || '-'}</Row>
              <Row label="수취인">{receiverName || '-'}</Row>
            </dl>
          )}
        </section>

        <section className="max-md:order-3">
          <h4 className="text-sm font-semibold text-gray-900">송장</h4>
          {detail.parcels.length === 0 ? (
            <p className="mt-3 text-sm text-gray-500">
              {fullyCanceled ? '취소된 주문이라 송장이 없습니다.' : '아직 송장이 없습니다.'}
            </p>
          ) : (
            <>
              <div className="mt-3 flex flex-wrap gap-2">
                {detail.parcels.map((parcel) => (
                  <button
                    key={parcel.parcelId}
                    type="button"
                    onClick={() => onSelectParcel(parcel.parcelId)}
                    className={`${CHIP_BASE} ${parcel.parcelId === openParcelId ? CHIP_ACTIVE : CHIP_IDLE}`}
                  >
                    {parcelChipLabel(parcel)}
                  </button>
                ))}
              </div>

              {openParcel && (
                <dl className="mt-3 divide-y divide-gray-200">
                  <Row label="택배사">{openParcel.carrierName ?? '-'}</Row>
                  <Row label="송장번호">{openParcel.invoiceNumber}</Row>
                  <Row label="상태">{PARCEL_STATUS_LABELS[openParcel.status]}</Row>
                  <Row label="처리 시각">{formatDate(openParcel.packedAt)}</Row>
                  <Row label="상자">
                    <span className="inline-flex items-center gap-2">
                      {openParcel.boxName ?? '-'}
                      {onChangeBox && openParcel.status === 'PACKED' && (
                        <Button size="sm" variant="secondary" onClick={() => onChangeBox(openParcel)}>
                          상자 변경
                        </Button>
                      )}
                    </span>
                  </Row>
                  <Row label="담은 물품">
                    {openParcel.items.length === 0 ? (
                      '-'
                    ) : (
                      <ul className="space-y-2">
                        {openParcel.items.map((parcelItem) => (
                          <li key={parcelItem.productId} className="flex items-center justify-end gap-3">
                            <Thumb
                              src={getProductThumbUrl(parcelItem.imageUrl, parcelItem.productId)}
                              alt={parcelItem.productName ?? ''}
                            />
                            <span className="break-words">{parcelItem.productName ?? '-'}</span>
                            <span className="shrink-0 text-gray-500">수량 {parcelItem.quantity}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </Row>
                </dl>
              )}
            </>
          )}
        </section>
      </div>
    </div>
  );
}
