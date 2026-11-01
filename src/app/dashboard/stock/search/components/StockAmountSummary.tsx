'use client';

import {
  ALL_AMOUNT_KEY,
  formatWonOrUnknown,
  type StockAmountLine,
} from '@/domain/entities/StockLotEntity';
import { Card } from '@/presentation/components/ui/Card';

interface StockAmountSummaryProps {
  lines: StockAmountLine[];
  /** Key of the 「미기입 N줄」 filtering the list now; null = none. */
  activeKey: string | null;
  onToggle: (key: string) => void;
}

/**
 * 「재고 조회」 amount box above the list (FEATURE_2611_02 D26 · D34 ~ D38): 「전체」 and one line per seller (「판매자 미정」
 * last) with the purchase-price total of the rows received. 「미기입 N줄」 = that line's rows left out of its total
 * (unknown price or negative on-hand); a click shows only those rows, a second click turns it off, a click on another
 * one switches to it. The totals stay as received while the list is filtered (D35).
 */
export function StockAmountSummary({ lines, activeKey, onToggle }: StockAmountSummaryProps) {
  return (
    <Card>
      <ul className="divide-y divide-gray-100 text-sm">
        {lines.map((line) => (
          <li key={line.key} className="flex items-center justify-between gap-2 py-1.5">
            <span
              className={
                line.key === ALL_AMOUNT_KEY ? 'font-semibold text-gray-900' : 'text-gray-700'
              }
            >
              {line.label}
            </span>
            <span className="flex items-center gap-2">
              {line.unknownCount > 0 && (
                <button
                  type="button"
                  aria-pressed={activeKey === line.key}
                  onClick={() => onToggle(line.key)}
                  className={`px-2 py-0.5 text-xs rounded-full bg-amber-100 text-amber-800${
                    activeKey === line.key ? ' ring-2 ring-amber-400' : ''
                  }`}
                >
                  미기입 {line.unknownCount}줄
                </button>
              )}
              <span className="font-semibold text-gray-900">{formatWonOrUnknown(line.total)}</span>
            </span>
          </li>
        ))}
      </ul>
    </Card>
  );
}
