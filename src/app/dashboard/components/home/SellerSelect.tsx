'use client';

import type { Seller } from '@/domain/entities/SellerEntity';
import { CARD_SELECT_CLASS, stopTap } from './DashboardCardFrame';

interface SellerSelectProps {
  sellers: Seller[];
  /** null = 「전체」. */
  value: number | null;
  onChange: (sellerId: number | null) => void;
}

/**
 * Seller selector in a chart card's title row (FEATURE_2610_30 D34 · D35 · D37): 「전체」 first, then the sellers in
 * the order of the seller list. A long name is cut with an ellipsis inside the selector. A tap on it does not open the
 * card's screen.
 */
export function SellerSelect({ sellers, value, onChange }: SellerSelectProps) {
  return (
    <select
      aria-label="판매자"
      value={value ?? ''}
      onClick={stopTap}
      onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))}
      className={`${CARD_SELECT_CLASS} max-w-28 truncate`}
    >
      <option value="">전체</option>
      {sellers.map((seller) => (
        <option key={seller.id} value={seller.id}>
          {seller.sellerName}
        </option>
      ))}
    </select>
  );
}
