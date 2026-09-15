'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Bell } from 'lucide-react';
import { useAlertStore } from '@/infrastructure/stores/alertStore';
import { useAlertFeed } from '@/presentation/hooks/useAlertFeed';
import type { AlertFeedItem } from '@/domain/entities/AlertEntity';
import { ROUTES } from '@/config/routes';
import { NavBadge } from './NavBadge';
import { AlertRow, alertHref } from './AlertRow';

/** 말풍선이 보여주는 최대 건수(D13). 더 보려면 알림 센터로 간다 — 말풍선에는 더 보기가 없다. */
const BUBBLE_SIZE = 20;

/**
 * 상단바 알림 종 + 말풍선 (FEATURE_2609_51).
 *
 * **용도**: 처리해야 할 일이 무엇인지 메뉴를 열지 않고 보고, 그 건으로 바로 간다.
 * **파일**: src/app/dashboard/components/AlertBell.tsx
 * **숫자**: `useAlertStore` 의 `summary.todoCount` — 🔴 알림 센터를 끝까지 스크롤한 행 수와 같다(D3).
 *    말풍선은 최근 20건만 보여주므로 배지가 더 클 수 있고, 그때 하단에 `외 더 있음` 이 붙는다.
 *
 * **사용 예제** — 상단바에서만 쓴다:
 * ```tsx
 * <AlertBell />
 * ```
 *
 * 🔴 `TopBar` 에서 숫자를 props 로 받지 않는다 — store 를 직접 읽는다(Step 2).
 * 🔴 목록은 **열 때만** 조회한다(D10). 닫힌 말풍선 내용을 미리 받아두지 않는다.
 * ⚠️ 확인·읽음 버튼을 만들지 말 것(D2). 일이 처리되면 목록에서 저절로 빠진다.
 * ❌ 화면 문구에 `미처리`·`미확인` 을 쓰지 말 것 — `처리해야 할 일` 로 통일한다(D4).
 */
export function AlertBell() {
  const router = useRouter();
  const summary = useAlertStore((state) => state.summary);
  const feed = useAlertFeed();
  const [isOpen, setIsOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const close = useCallback(() => setIsOpen(false), []);

  // 바깥 클릭·Esc 로 닫는다. 닫혀 있을 때는 리스너를 걸지 않는다.
  useEffect(() => {
    if (!isOpen) return;
    const onMouseDown = (event: MouseEvent) => {
      if (!wrapperRef.current?.contains(event.target as Node)) close();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close();
    };
    document.addEventListener('mousedown', onMouseDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onMouseDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [isOpen, close]);

  const toggle = () => {
    if (isOpen) {
      close();
      return;
    }
    setIsOpen(true);
    // 열 때 최신으로 한 번 가져온다(D10).
    void feed.reload({ size: BUBBLE_SIZE });
  };

  const handleNavigate = (item: AlertFeedItem) => {
    close();
    router.push(alertHref(item));
  };

  const todoCount = summary?.todoCount ?? 0;
  // 한 장이 꽉 찼으면 뒤에 더 있다는 뜻이다 — 말풍선은 여기서 멈추고 알림 센터로 넘긴다.
  const hasMoreThanBubble = feed.items.length >= BUBBLE_SIZE;

  return (
    <div ref={wrapperRef} className="relative">
      <button
        type="button"
        onClick={toggle}
        aria-label="알림"
        aria-expanded={isOpen}
        className="relative inline-flex h-9 w-9 items-center justify-center rounded-lg text-gray-700 hover:bg-gray-100 transition-colors"
      >
        <Bell className="h-5 w-5" />
        {/* NavBadge 는 메뉴 줄용 인라인 배지(`ml-2`)라 종 위에 겹치려면 절대 배치 래퍼가 필요하다.
            🔴 NavBadge 자체를 고치면 사이드바 배지가 같이 틀어진다. */}
        <span className="absolute -top-1 -right-1">
          <NavBadge count={summary?.todoCount} />
        </span>
      </button>

      {isOpen && (
        // 팝업이 아니라 상단바에 붙은 드롭다운이다 — 층은 사이드바(z-50)·모달(z-50) **아래**,
        // 표 sticky 헤더(z-10) 위인 z-40 이다. `ui/Modal` 의 z-50 을 여기서 흉내내지 않는다.
        <div className="absolute right-0 mt-2 z-40 w-96 max-w-[calc(100vw-2rem)] max-h-[70vh] overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-lg">
          <div className="sticky top-0 z-10 border-b border-gray-200 bg-white px-4 py-3 text-sm font-semibold text-gray-900">
            처리해야 할 일 {todoCount}건
          </div>

          {feed.isLoading && feed.items.length === 0 && (
            <div className="px-4 py-6 text-center text-sm text-gray-500">불러오는 중…</div>
          )}
          {!feed.isLoading && feed.error && (
            <div className="px-4 py-6 text-center text-sm text-red-600">{feed.error}</div>
          )}
          {!feed.isLoading && !feed.error && feed.items.length === 0 && (
            <div className="px-4 py-6 text-center text-sm text-gray-500">처리해야 할 일이 없습니다.</div>
          )}

          {feed.items.map((item) => (
            <AlertRow
              key={`${item.alertType}-${item.refId}`}
              item={item}
              onNavigate={handleNavigate}
            />
          ))}

          <div className="sticky bottom-0 border-t border-gray-200 bg-white px-4 py-2 text-center">
            <Link
              href={ROUTES.ALERTS}
              onClick={close}
              className="text-sm font-medium text-blue-600 hover:underline"
            >
              {hasMoreThanBubble ? '외 더 있음 · 전체 보기' : '전체 보기'}
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
