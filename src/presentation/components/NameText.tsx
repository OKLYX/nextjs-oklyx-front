'use client';

/**
 * Shared name text (product name / customer name) with one truncation rule.
 * File: src/presentation/components/NameText.tsx
 *
 * **Purpose**: every list, card and table cell that shows a product name or a customer name renders it through this
 *   component, so the number of lines and the width are decided in one place. A product name folds to two lines,
 *   a customer name folds to one line. The full name is always available as the native tooltip (`title`).
 *
 * **Props**
 * - `name` — the name to show. `null`, `undefined` or a blank string counts as empty.
 * - `kind` — `'product'` (two lines) or `'customer'` (one line).
 * - `emptyText` (default `-`) — text shown when the name is empty. No tooltip, no toggle.
 * - `inTable` (default false) — caps the width inside a table cell (product 20rem, customer 10rem).
 * - `expandable` (default false) — renders a button that toggles between folded and full name on click.
 *   The click does not bubble up to the row.
 * - `noTruncate` (default false) — shows the full name, never folds, and ignores `expandable`.
 * - `className` — colour, font size and weight only.
 *
 * **Usage**
 * ```tsx
 * // 1. Product name in a table cell
 * <td className="px-6 py-3 text-sm text-gray-700">
 *   <NameText kind="product" name={order.itemName} inTable />
 * </td>
 *
 * // 2. Customer name on a card
 * <NameText kind="customer" name={customerName} className="text-[13px] text-gray-500" />
 *
 * // 3. Toggle in place
 * <NameText kind="product" name={item.name} expandable emptyText="—" />
 * ```
 *
 * ⚠️ The number of lines and the width are decided only in this file.
 * ⚠️ `noTruncate` is turned on only by the detail or sheet side of a reusable component — when on, the whole name is
 *    shown and there is no toggle (D31, D32).
 * ❌ Do not pass clamp, truncate or max width classes through `className` from the call site.
 * ❌ Do not turn on `expandable` on a row that opens a detail on click, in a picker list, inside a popup, in an input,
 *    in a notification text or for an option name (D22, D23, D24, D26).
 */

import { MouseEvent, useState } from 'react';

export type NameKind = 'product' | 'customer';

export interface NameTextProps {
  name: string | null | undefined;
  kind: NameKind;
  emptyText?: string;
  inTable?: boolean;
  expandable?: boolean;
  noTruncate?: boolean;
  className?: string;
}

const BASE_CLASS = 'min-w-0 break-words';
const PLAIN_DISPLAY_CLASS = 'block';
const BUTTON_CLASS = '[text-align:inherit] cursor-pointer';

// The product clamp class carries its own display value, so it is never combined with the plain display class.
const PRODUCT_COLLAPSED_CLASS = 'line-clamp-2';
const CUSTOMER_COLLAPSED_CLASS = 'block truncate';

const COLLAPSED_CLASS: Record<NameKind, string> = {
  product: PRODUCT_COLLAPSED_CLASS,
  customer: CUSTOMER_COLLAPSED_CLASS,
};

const TABLE_WIDTH_CLASS: Record<NameKind, string> = {
  product: 'max-w-[20rem]',
  customer: 'max-w-[10rem]',
};

function joinClasses(...classes: (string | false | undefined)[]): string {
  return classes.filter(Boolean).join(' ');
}

export function NameText({ name, kind, emptyText = '-', inTable = false, expandable = false, noTruncate = false, className }: NameTextProps) {
  const [expanded, setExpanded] = useState(false);
  const widthClass = inTable ? TABLE_WIDTH_CLASS[kind] : undefined;

  if (name == null || name.trim() === '') {
    return <span className={joinClasses(BASE_CLASS, PLAIN_DISPLAY_CLASS, widthClass, className)}>{emptyText}</span>;
  }

  if (noTruncate) {
    return (
      <span className={joinClasses(BASE_CLASS, PLAIN_DISPLAY_CLASS, widthClass, className)} title={name}>
        {name}
      </span>
    );
  }

  if (!expandable) {
    return (
      <span className={joinClasses(BASE_CLASS, COLLAPSED_CLASS[kind], widthClass, className)} title={name}>
        {name}
      </span>
    );
  }

  const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    setExpanded((prev) => !prev);
  };

  return (
    <button
      type="button"
      title={name}
      aria-expanded={expanded}
      onClick={handleClick}
      className={joinClasses(
        BASE_CLASS,
        BUTTON_CLASS,
        widthClass,
        className,
        expanded ? PLAIN_DISPLAY_CLASS : COLLAPSED_CLASS[kind],
      )}
    >
      {name}
    </button>
  );
}
