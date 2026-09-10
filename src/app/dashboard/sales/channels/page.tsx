import { Suspense } from 'react';
import { ChannelSalesContainer } from './components/ChannelSalesContainer';

// 🔴 `useSearchParams` 를 쓰는 클라이언트 컴포넌트는 Suspense 경계가 없으면 `npm run build` 가 깨진다.
export default function SalesByChannelPage() {
  return (
    <Suspense>
      <ChannelSalesContainer />
    </Suspense>
  );
}
