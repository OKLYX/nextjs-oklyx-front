'use client';

import { PERIOD_LABELS } from '@/config/dashboardGrid';
import type { DashboardPeriod } from '@/domain/entities/DashboardEntity';
import { CARD_SELECT_CLASS, stopTap } from './DashboardCardFrame';

interface PeriodSelectProps {
  periods: DashboardPeriod[];
  value: DashboardPeriod;
  onChange: (period: DashboardPeriod) => void;
}

/** Period selector in a card's title row (FEATURE_2610_29 D22 · D23). A tap on it does not open the card's screen. */
export function PeriodSelect({ periods, value, onChange }: PeriodSelectProps) {
  return (
    <select
      aria-label="기간"
      value={value}
      onClick={stopTap}
      onChange={(e) => onChange(e.target.value as DashboardPeriod)}
      className={CARD_SELECT_CLASS}
    >
      {periods.map((period) => (
        <option key={period} value={period}>
          {PERIOD_LABELS[period]}
        </option>
      ))}
    </select>
  );
}
