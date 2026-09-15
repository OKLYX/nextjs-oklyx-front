import { Suspense } from 'react';
import { Spinner } from '@/presentation/components/Spinner';
import { AlertCenterContainer } from './components/AlertCenterContainer';

// 알림 센터 (FEATURE_2609_51 / D13). 진입은 상단 종 말풍선 하단 [전체 보기] 하나뿐이다 —
// 🔴 사이드바에 메뉴를 만들지 않는다(알림은 도메인 그룹에 속하지 않는다).
export default function AlertsPage() {
  return (
    <Suspense fallback={<Spinner size={24} label="불러오는 중..." />}>
      <AlertCenterContainer />
    </Suspense>
  );
}
