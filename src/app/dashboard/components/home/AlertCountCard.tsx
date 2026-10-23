'use client';

import { useAlertStore } from '@/infrastructure/stores/alertStore';
import { DashboardCardFrame } from './DashboardCardFrame';

interface AlertCountCardProps {
  title: string;
  href: string;
  /** Which number of the alert summary this card shows (D4 · D8). */
  field: 'paidOrders' | 'newOrders' | 'openClaims' | 'unansweredInquiries';
  editing: boolean;
  onRemove: () => void;
}

/**
 * C1 ~ C4 — one number of the alert summary (FEATURE_2610_29 D4 · D20).
 *
 * 🔴 Reads `alertStore` — the 60-second polling in `app/dashboard/layout.tsx` keeps it fresh. This card does not call the
 *    server itself (D20).
 */
export function AlertCountCard({ title, href, field, editing, onRemove }: AlertCountCardProps) {
  const summary = useAlertStore((state) => state.summary);
  const value = summary ? summary[field] : null;

  return (
    <DashboardCardFrame title={title} href={href} editing={editing} onRemove={onRemove}>
      <p className="text-2xl font-bold text-gray-900">
        {value === null ? '—' : value.toLocaleString('ko-KR')}
        <span className="ml-1 text-sm font-normal text-gray-500">건</span>
      </p>
    </DashboardCardFrame>
  );
}
