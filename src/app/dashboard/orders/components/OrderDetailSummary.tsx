'use client';

import type { ReactNode } from 'react';
import { Button } from '@/presentation/components/ui/Button';
import { getProductThumbUrl } from '@/infrastructure/utils/imageUrl';
import { ROUTES } from '@/config/routes';
import type { OrderDetail, OrderDetailParcel, OrderLineMaster } from '@/domain/entities/OrderEntity';
import { PARCEL_STATUS_LABELS, getOrderStatusLabel, parcelChipLabel } from '@/domain/entities/OrderEntity';
import { unexpandedReasonLabel } from '@/domain/entities/StockEntity';

export interface OrderDetailField {
  label: string;
  value: string | number;
}

interface OrderDetailSummaryProps {
  detail: OrderDetail;
  /** Field rows above the lists — the opening mode builds them */
  fields: OrderDetailField[];
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
 * Body of the shared order detail (FEATURE_2611_07 / D13 · D23 · D26 · D33 · D36) — the field list, 「상품 목록」 and
 * 「송장 목록」 (one chip per parcel, the open chip's content below it).
 * Each 「상품 목록」 line also shows its master product · master option and component products × quantity, or the broken
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
  fields,
  highlightLineId,
  openParcelId,
  onSelectParcel,
  onChangeBox,
}: OrderDetailSummaryProps) {
  const openParcel = detail.parcels.find((parcel) => parcel.parcelId === openParcelId) ?? null;

  return (
    <div>
      <dl className="divide-y divide-gray-200">
        {fields.map((field) => (
          <div key={field.label} className="flex justify-between py-2">
            <dt className="text-sm font-medium text-gray-500">{field.label}</dt>
            <dd className="text-sm text-gray-900 text-right">{field.value}</dd>
          </div>
        ))}
      </dl>

      <div className="mt-6 border-t border-gray-200 pt-6">
        <h4 className="text-sm font-semibold text-gray-900">상품 목록</h4>
        <ul className="mt-3 space-y-2">
          {detail.lines.map((line) => (
            <li
              key={line.id}
              className={`flex items-center gap-3 rounded-lg border border-gray-200 p-3 text-sm ${
                line.id === highlightLineId ? 'bg-blue-50' : ''
              }`}
            >
              <Thumb
                src={line.thumbnailProductId != null
                  ? getProductThumbUrl(line.thumbnailImageUrl, line.thumbnailProductId)
                  : null}
                alt={line.itemName ?? ''}
              />
              <div className="min-w-0 flex-1">
                <p className="text-gray-900 break-words">{line.itemName ?? '-'}</p>
                <p className="mt-1 text-xs text-gray-500">수량 {line.orderCount}</p>
                {detail.lineMasters
                  ?.filter((lineMaster) => lineMaster.orderLineId === line.id)
                  .map((lineMaster) => (
                    <LineMaster key={lineMaster.orderLineId} lineMaster={lineMaster} admin={detail.admin === true} />
                  ))}
              </div>
              <span className="shrink-0 px-2 py-0.5 text-xs rounded-full bg-gray-100 text-gray-700">
                {getOrderStatusLabel(line.status)}
              </span>
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-6 border-t border-gray-200 pt-6">
        <h4 className="text-sm font-semibold text-gray-900">송장 목록</h4>
        {detail.parcels.length === 0 ? (
          <p className="mt-3 text-sm text-gray-500">송장이 없습니다</p>
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
                <Row label="송장번호">{openParcel.invoiceNumber}</Row>
                <Row label="택배사">{openParcel.carrierName ?? '-'}</Row>
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
                      {openParcel.items.map((item) => (
                        <li key={item.productId} className="flex items-center justify-end gap-3">
                          <Thumb
                            src={getProductThumbUrl(item.imageUrl, item.productId)}
                            alt={item.productName ?? ''}
                          />
                          <span className="break-words">{item.productName ?? '-'}</span>
                          <span className="shrink-0 text-gray-500">수량 {item.quantity}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </Row>
              </dl>
            )}
          </>
        )}
      </div>
    </div>
  );
}
