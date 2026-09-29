import { Suspense } from 'react';
import { Spinner } from '@/presentation/components/Spinner';
import { MasterProductCreateContainer } from './components/MasterProductCreateContainer';

// MasterProductCreateContainer 가 useSearchParams(`?productIds=`)를 쓰므로 Suspense 경계가 없으면
// 빌드가 실패한다 (Next 16).
export default function MasterProductNewPage() {
  return (
    <Suspense fallback={<Spinner size={24} label="불러오는 중..." />}>
      <MasterProductCreateContainer />
    </Suspense>
  );
}
