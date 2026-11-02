import type { ReactNode } from 'react';
import { ShippedOnlyScope } from './components/ShippedOnlyContext';

export default function SalesLayout({ children }: { children: ReactNode }) {
  return <ShippedOnlyScope>{children}</ShippedOnlyScope>;
}
