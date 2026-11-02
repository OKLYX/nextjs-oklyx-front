'use client';

import { createContext, useContext, useState, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { ROUTES } from '@/config/routes';

/**
 * Shared value of the 「출고 전 주문 제외」 switch for the three sales tabs (FEATURE_2611_04 D3 · D9).
 *
 * **Purpose**: the summary, by-channel and by-product tabs read and change one value, so the switch stays on
 * while moving between those three tabs (tab bar, opening a channel from the seller summary, period change).
 * **Lifetime**: the value lives only while the address is one of the three tabs. Going anywhere else
 * (settlement list, seller debts, home, other menus) drops the provider, so coming back starts switched off.
 * A browser reload also starts switched off.
 * **File**: src/app/dashboard/sales/components/ShippedOnlyContext.tsx
 *
 * ❌ Not kept in browser storage, the address, a global store or the server (D9).
 */
interface ShippedOnlyValue {
  excludeUnshipped: boolean;
  setExcludeUnshipped: (next: boolean) => void;
}

const ShippedOnlyContext = createContext<ShippedOnlyValue>({
  excludeUnshipped: false,
  setExcludeUnshipped: () => {},
});

/** The three sales tabs that share the switch value. */
const SHIPPED_ONLY_PATHS: string[] = [ROUTES.SALES_SUMMARY, ROUTES.SALES_BY_CHANNEL, ROUTES.SALES_BY_PRODUCT];

/** Owner of the switch value — mounted only while the address is one of the three tabs. */
function ShippedOnlyProvider({ children }: { children: ReactNode }) {
  const [excludeUnshipped, setExcludeUnshipped] = useState(false);
  return (
    <ShippedOnlyContext.Provider value={{ excludeUnshipped, setExcludeUnshipped }}>
      {children}
    </ShippedOnlyContext.Provider>
  );
}

/**
 * Wraps the sales section. Holds no state itself: the section layout stays mounted across the settlement and
 * seller-debts pages, so the value must live in the provider that unmounts when leaving the three tabs.
 */
export function ShippedOnlyScope({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  if (!SHIPPED_ONLY_PATHS.includes(pathname)) return <>{children}</>;
  return <ShippedOnlyProvider>{children}</ShippedOnlyProvider>;
}

/** Switch value of the three sales tabs. Outside the provider: always off, setter does nothing. */
export function useShippedOnly(): ShippedOnlyValue {
  return useContext(ShippedOnlyContext);
}
