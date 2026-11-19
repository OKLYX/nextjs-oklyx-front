'use client';

import { ChevronDown } from 'lucide-react';

interface OrderFilterChipSelectProps {
  label: string;
  value: string | number;
  options: { value: string | number; label: string }[];
  onChange: (value: string) => void;
  highlighted: boolean;
  ariaLabel: string;
}

/**
 * Filter chip below 768px = the current native `<select>`, only dressed as a chip
 * (FEATURE_2611_32 / D24 · D14 · D22).
 *
 * **Purpose**: the order list and shipment filter cards draw their seller / period / channel pickers as chips on
 * narrow screens. Tapping opens the device's own picker; the transparent `<select>` covers the whole chip.
 * **File**: src/app/dashboard/orders/components/OrderFilterChipSelect.tsx
 * ⚠️ The chip text is `label` — the screen decides it (for 「전체」 it passes 「판매자」 · 「채널」).
 * ❌ Do not build a custom dropdown menu in place of the native picker.
 *
 * @example
 * <OrderFilterChipSelect label={sellerChipLabel} value={selectedSellerId} ariaLabel={sellerAriaLabel}
 *   options={sellerOptions} onChange={(v) => onSellerChange(v === '' ? '' : Number(v))}
 *   highlighted={selectedSellerId !== ''} />
 */
export function OrderFilterChipSelect({
  label,
  value,
  options,
  onChange,
  highlighted,
  ariaLabel,
}: OrderFilterChipSelectProps) {
  return (
    <label
      className={`relative inline-flex h-[34px] shrink-0 items-center gap-1 rounded-full border px-3 text-[13px] ${highlighted ? 'border-strong bg-strong text-white' : 'border-gray-300 bg-white text-gray-900'}`}
    >
      <span className="max-w-40 truncate">{label}</span>
      <ChevronDown size={14} aria-hidden />
      <select
        aria-label={ariaLabel}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
