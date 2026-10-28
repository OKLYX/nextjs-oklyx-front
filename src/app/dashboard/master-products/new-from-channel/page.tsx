import { Suspense } from 'react';
import { Spinner } from '@/presentation/components/Spinner';
import { MasterFromChannelForm } from './components/MasterFromChannelForm';

// 2609_45/D17: the path is platform neutral. The platform picker's names come only from the `PLATFORMS` table.
export default function MasterFromChannelPage() {
  return (
    <Suspense fallback={<Spinner size={24} label="불러오는 중..." />}>
      <MasterFromChannelForm />
    </Suspense>
  );
}
