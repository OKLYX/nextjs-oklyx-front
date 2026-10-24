/**
 * One 「label · value」 line of a narrow-screen sales card (FEATURE_2610_31 D14) — the web copy of the mobile app's
 * `SalesValueRow` (`lib/features/sales/presentation/widgets/sales_value_row.dart`).
 *
 * **Purpose**: the label on the left (with an optional small line under it), the value on the right.
 * **File**: src/app/dashboard/sales/components/SalesValueRow.tsx
 * **Used in**: the narrow-screen cards of 「상품별 매출」 · 「통합 매출 조회」 (seller and channel rows).
 *
 * **Usage**:
 * ```tsx
 * <SalesValueRow label="매출액" value={formatMoney(row.grossSales)} bold />
 * <SalesValueRow label="정산 추정 금액" sub="기간 무관 · 미지급 잔액" value={formatMoney(row.pendingPayout)} />
 * ```
 *
 * ❌ Not for the wide-screen tables — they keep their columns.
 */
interface SalesValueRowProps {
  label: string;
  value: string;
  /** Small line under the label. */
  sub?: string;
  bold?: boolean;
  /** Text colour class of the value (default `text-gray-900`). */
  tone?: string;
  /** Hover text of the value. */
  hint?: string;
}

export function SalesValueRow({ label, value, sub, bold = false, tone = 'text-gray-900', hint }: SalesValueRowProps) {
  return (
    <div className="flex items-start justify-between gap-3 text-[13px]">
      <span className="text-gray-900">
        {label}
        {sub && <span className="block text-[11px] text-gray-500">{sub}</span>}
      </span>
      <span className={`text-right ${bold ? 'font-semibold' : ''} ${tone}`} title={hint}>
        {value}
      </span>
    </div>
  );
}
