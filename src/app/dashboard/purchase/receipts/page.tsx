import { Suspense } from 'react';
import { Spinner } from '@/presentation/components/Spinner';
import { ReceiptList } from './components/ReceiptList';

// ReceiptList uses useSearchParams — without a Suspense boundary the build fails (Next 16).
export default function PurchaseReceiptsPage() {
  return (
    <Suspense fallback={<Spinner size={24} label="불러오는 중..." />}>
      <ReceiptList />
    </Suspense>
  );
}
