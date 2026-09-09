import { Suspense } from 'react';
import { Spinner } from '@/presentation/components/Spinner';
import { PayoutListContainer } from './components/PayoutListContainer';

// PayoutListContainer 가 useSearchParams 를 쓰므로 Suspense 경계가 없으면 빌드가 실패한다 (Next 16).
export default function SettlementPayoutsPage() {
  return (
    <Suspense fallback={<Spinner size={24} label="불러오는 중..." />}>
      <PayoutListContainer />
    </Suspense>
  );
}
