'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAlertStore } from '@/infrastructure/stores/alertStore';
import { useAlertFeed } from '@/presentation/hooks/useAlertFeed';
import type { AlertFeedItem, AlertKind } from '@/domain/entities/AlertEntity';
import { PageContainer } from '@/presentation/components/PageContainer';
import { Card } from '@/presentation/components/ui/Card';
import { StateBlock } from '@/presentation/components/ui/StateBlock';
import { AlertRow, alertHref } from '../../components/AlertRow';

/** 한 장 크기. 말풍선(20)보다 크다 — 여기는 훑어보는 화면이다. */
const PAGE_SIZE = 50;

/**
 * 탭 = **서버 필터**(D13). 🔴 화면에서 거르지 말 것 — 탭을 고르면 소스가 하나라 읽는 양이 1/3 로
 * 줄고 완전한 페이징이 된다.
 */
const TABS: { label: string; type?: AlertKind }[] = [
  { label: '전체' },
  { label: '새 주문', type: 'ORDER' },
  { label: '반품/교환', type: 'CLAIM' },
  { label: '문의', type: 'INQUIRY' },
];

/**
 * 알림 센터 — 처리해야 할 일 전체 목록 (FEATURE_2609_51 / D13).
 *
 * **용도**: 말풍선이 보여주는 최근 20건 너머를 전부 다루는 자리.
 * **파일**: src/app/dashboard/alerts/components/AlertCenterContainer.tsx
 *
 * 🔴 행은 `AlertRow` 를 **재사용**한다 — 말풍선과 같은 행을 두 번 그리지 말 것.
 * 🔴 정렬은 서버가 준 최신순 그대로다. 화면에서 다시 정렬하지 않는다.
 * 🔴 숫자는 `alertStore` 에서 읽는다(Step 2) — 목록 길이로 세지 않는다.
 * ⚠️ 확인 버튼·체크박스·일괄 처리 UI 를 만들지 말 것(D2). 여기서 하는 일은 **보고 이동하는 것**뿐이다.
 * ❌ 페이지 번호·[25/50 보기] 선택을 두지 않는다(D13) — 더 보기는 무한 스크롤 하나다.
 */
export function AlertCenterContainer() {
  const router = useRouter();
  const summary = useAlertStore((state) => state.summary);
  const feed = useAlertFeed();
  const [activeTab, setActiveTab] = useState(0);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const { reload, loadMore, hasMore, isLoading } = feed;

  // 진입·탭 전환에서만 조회한다(D10 — 목록은 폴링하지 않는다).
  useEffect(() => {
    const type = TABS[activeTab]?.type;
    void (async () => {
      await reload({ ...(type ? { type } : {}), size: PAGE_SIZE });
    })();
  }, [activeTab, reload]);

  // 무한 스크롤: 목록 끝 근처 센티넬이 보이면 다음 장. `hasMore === false` 면 관찰하지 않는다.
  // 로딩 중 재진입은 훅이 막는다(`loadMore` 가 즉시 반환).
  useEffect(() => {
    const target = sentinelRef.current;
    if (!target || !hasMore) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting) void loadMore();
    });
    observer.observe(target);
    return () => observer.disconnect();
  }, [hasMore, loadMore]);

  const handleNavigate = useCallback((item: AlertFeedItem) => {
    router.push(alertHref(item));
  }, [router]);

  const isFiltered = TABS[activeTab]?.type != null;
  const emptyMessage = isFiltered
    ? '이 종류의 할 일이 없습니다.'
    : '처리해야 할 일이 없습니다.';

  return (
    <PageContainer
      title="알림"
      action={
        <span className="shrink-0 text-sm text-gray-600">
          처리해야 할 일 {summary?.todoCount ?? 0}건
        </span>
      }
    >
      <div className="flex flex-wrap gap-2">
        {TABS.map((tab, index) => (
          <button
            key={tab.label}
            type="button"
            onClick={() => setActiveTab(index)}
            disabled={isLoading}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors disabled:opacity-60 ${
              index === activeTab
                ? 'bg-blue-600 text-white'
                : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-100'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <Card padded={false}>
        {isLoading && feed.items.length === 0 && (
          <StateBlock variant="loading" message="불러오는 중..." />
        )}
        {!isLoading && feed.error && feed.items.length === 0 && (
          <StateBlock variant="error" message={feed.error} />
        )}
        {!isLoading && !feed.error && feed.items.length === 0 && (
          <StateBlock variant="empty" message={emptyMessage} />
        )}

        {feed.items.map((item) => (
          <AlertRow
            key={`${item.alertType}-${item.refId}`}
            item={item}
            onNavigate={handleNavigate}
          />
        ))}

        {/* 다음 장 트리거. 마지막 장이면 아무것도 그리지 않는다 —
            `모두 확인했습니다` 같은 종료 문구는 할 일이 끝났다는 오해를 준다. */}
        {hasMore && (
          <div ref={sentinelRef} className="p-4 text-center text-sm text-gray-500">
            {isLoading ? '불러오는 중...' : ''}
          </div>
        )}
      </Card>
    </PageContainer>
  );
}
