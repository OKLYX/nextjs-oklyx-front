'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Shared button that copies one value to the clipboard.
 * File: src/app/dashboard/master-products/[id]/components/CopyIdButton.tsx
 *
 * **Purpose**: placed next to a value, it copies the value exactly (no spaces or line breaks added) —
 *   market IDs (product ID · option ID) on the master detail page, compared by eye with WING, and the
 *   field values of the 「등록 상품 조회」 tool.
 *
 * **Where it is used**
 * - Coverage matrix 「상품 ID」 column (`CoverageMatrix.tsx`)
 * - Option ID cells of the option × channel table
 * - Field rows of the 「등록 상품 조회」 tool (`dashboard/components/RegisteredProductTool.tsx`, FEATURE_2610_08)
 *
 * **Usage**
 * ```tsx
 * <CopyIdButton value={cell.platformProductId} />
 * <CopyIdButton value={String(option.platformOptionId)} />
 * ```
 *
 * ⚠️ A failed copy is **ignored silently** — some browsers deny clipboard access, and this button is a
 *    helper, not worth an error toast (the value stays on screen).
 * ⚠️ It is used inside tables, so it calls `stopPropagation` to keep the click from reaching row handlers.
 *
 * ❌ Do not re-implement it inline — two copies of one behavior drift apart
 *    (root CLAUDE.md shared Component rule).
 * ❌ Do not transform `value` (no formatting or prefix beyond trim) — it must stay the original text for comparison.
 */
export function CopyIdButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    },
    [],
  );

  const handleCopy = useCallback(
    async (e: React.MouseEvent) => {
      e.stopPropagation();
      try {
        await navigator.clipboard.writeText(value);
        setCopied(true);
        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => setCopied(false), 2000);
      } catch {
        // Clipboard permission denied — stay silent on purpose.
      }
    },
    [value],
  );

  return (
    <button
      type="button"
      onClick={handleCopy}
      title="복사"
      aria-label={`${value} 복사`}
      className="rounded border border-gray-300 px-1.5 py-0.5 text-[10px] font-medium text-gray-600 hover:bg-gray-100"
    >
      {copied ? '복사됨' : '복사'}
    </button>
  );
}
