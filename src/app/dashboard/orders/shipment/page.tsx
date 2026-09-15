import { Suspense } from 'react';
import { Spinner } from '@/presentation/components/Spinner';
import { ShipmentContainer } from './components/ShipmentContainer';

// ShipmentContainer 가 useSearchParams(알림 딥링크 `?orderNo=`)를 쓰므로 Suspense 경계가 없으면
// 빌드가 실패한다 (Next 16).
export default function ShipmentPage() {
  return (
    <Suspense fallback={<Spinner size={24} label="불러오는 중..." />}>
      <ShipmentContainer />
    </Suspense>
  );
}
