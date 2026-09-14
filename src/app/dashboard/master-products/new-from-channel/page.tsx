import { Suspense } from 'react';
import { Spinner } from '@/presentation/components/Spinner';
import { MasterFromChannelForm } from './components/MasterFromChannelForm';

// 2609_45/D17: 경로·메뉴 라벨 모두 플랫폼 중립. 플랫폼 이름은 `PLATFORMS` 표에서만 나온다.
export default function MasterFromChannelPage() {
  return (
    <Suspense fallback={<Spinner size={24} label="불러오는 중..." />}>
      <MasterFromChannelForm />
    </Suspense>
  );
}
