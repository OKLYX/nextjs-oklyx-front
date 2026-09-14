import { Suspense } from 'react';
import { Spinner } from '@/presentation/components/Spinner';
import { MasterFromChannelForm } from './components/MasterFromChannelForm';

// 2609_45/D17: 경로는 플랫폼 중립(`new-from-channel`). 쿠팡은 메뉴 라벨·화면 문구에만 남는다.
export default function MasterFromChannelPage() {
  return (
    <Suspense fallback={<Spinner size={24} label="불러오는 중..." />}>
      <MasterFromChannelForm />
    </Suspense>
  );
}
