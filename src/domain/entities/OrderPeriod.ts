// Order query period options. 'RECENT' is the server's default window (coupang.sync-days=14)
// and sends no from/to parameter at all.
// ⚠️ If the server's sync-days changes, this label must change with it.
export const RECENT_PERIOD = 'RECENT';

export interface OrderPeriodOption {
  value: string;            // RECENT_PERIOD | 'YYYY-MM'
  label: string;            // '최근 2주' | '2026년 8월'
}

export interface OrderPeriodRange {
  from: string;             // 'YYYY-MM-DD' (first day of the month)
  to: string;               // 'YYYY-MM-DD' (last day of the month, inclusive on the server)
}

const pad = (n: number): string => String(n).padStart(2, '0');

// Recent 2 weeks + the last 12 months (current month included).
// Dates are generated mechanically; months without orders are kept and labeled '(데이터 없음)'
// instead of being dropped — dropping them would make the month unselectable and remove the
// entry point for the follow-up backfill feature (2609_10).
// 🔴 Never use toISOString() here: in KST it shifts the date one day back.
export function buildPeriodOptions(
  monthsWithData: ReadonlySet<string>,          // 'YYYY-MM' set; empty = everything is (데이터 없음)
  today: Date = new Date(),
  months = 12,
): OrderPeriodOption[] {
  const options: OrderPeriodOption[] = [{ value: RECENT_PERIOD, label: '최근 2주' }];
  for (let i = 0; i < months; i += 1) {
    const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
    const value = `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
    const base = `${d.getFullYear()}년 ${d.getMonth() + 1}월`;
    options.push({
      value,
      label: monthsWithData.has(value) ? base : `${base} (데이터 없음)`,
    });
  }
  return options;
}

// RECENT → undefined (no parameter = server default window). 'YYYY-MM' → first..last day of it.
export function toPeriodRange(value: string): OrderPeriodRange | undefined {
  if (value === RECENT_PERIOD) return undefined;
  const [year, month] = value.split('-').map(Number);
  if (!year || !month) return undefined;
  const lastDay = new Date(year, month, 0).getDate();   // month is 1-based → day 0 of next month
  return { from: `${year}-${pad(month)}-01`, to: `${year}-${pad(month)}-${pad(lastDay)}` };
}

// A month option means the list can hold stale delivery statuses (PLAN D7).
export const isMonthPeriod = (value: string): boolean => value !== RECENT_PERIOD;
