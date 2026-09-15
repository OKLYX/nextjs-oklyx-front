'use client';

import { useCallback, useMemo, useRef, useState } from 'react';
import { AlertRepositoryImpl } from '@/infrastructure/repositories/AlertRepositoryImpl';
import { AlertUseCase } from '@/application/usecases/AlertUseCase';
import type { AlertFeedItem, AlertFeedQuery } from '@/domain/entities/AlertEntity';

/**
 * 처리해야 할 일 목록 (FEATURE_2609_51). **열 때·조건이 바뀔 때만** 불러온다.
 *
 * **용도**: 말풍선(`AlertBell`)과 알림 센터 페이지가 **같이 쓰는** 목록 훅.
 * **파일**: src/presentation/hooks/useAlertFeed.ts
 *
 * ❌ 폴링하지 말 것(D10) — 닫힌 말풍선의 내용을 미리 받아둘 이유가 없다. 숫자만 60초로 도는
 *    폴링(`useAlertSummaryPolling`)이 "볼 게 있다"를 알려주고, 목록은 사용자가 열었을 때 최신으로 가져온다.
 * 🔴 **커서를 화면 상태로 끌어올리지 말 것** — 커서는 서버가 준 불투명 값이고, 훅 밖으로 나가는 순간
 *    "어디까지 봤는지"가 두 곳에 생긴다. 이 훅 안(ref)에만 둔다.
 * ⚠️ 실패는 이 목록을 그리는 자리에만 표시한다 — 상단바 전체를 에러로 물들이지 않는다.
 *
 * **사용 예제**
 * ```tsx
 * const feed = useAlertFeed();
 * // 말풍선을 열 때 (최근 20건, 더 보기 없음)
 * void feed.reload({ size: 20 });
 * // 알림 센터 탭 전환 (서버 필터)
 * void feed.reload({ type: 'ORDER', size: 50 });
 * // 무한 스크롤 센티넬
 * void feed.loadMore();
 * ```
 */
export function useAlertFeed() {
  const alertUseCase = useMemo(() => new AlertUseCase(new AlertRepositoryImpl()), []);
  const [items, setItems] = useState<AlertFeedItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [hasMore, setHasMore] = useState(false);
  // 🔴 커서와 조회 조건은 ref 에만 둔다(화면 상태 아님 — 위 주석).
  const cursorRef = useRef<string | null>(null);
  const queryRef = useRef<AlertFeedQuery>({});
  // 로딩 중 재진입 차단. state 는 다음 렌더에야 보이므로 무한 스크롤을 막지 못한다.
  const inFlightRef = useRef(false);

  /** 첫 장부터 다시 — 탭을 바꾸거나 말풍선을 열 때. */
  const reload = useCallback(async (query: AlertFeedQuery = {}) => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    queryRef.current = query;
    setIsLoading(true);
    setError('');
    try {
      const page = await alertUseCase.getFeed({ ...query, cursor: undefined });
      setItems(page.items);
      cursorRef.current = page.nextCursor;
      setHasMore(page.nextCursor != null);
    } catch {
      setItems([]);
      cursorRef.current = null;
      setHasMore(false);
      setError('알림을 불러오지 못했습니다.');
    } finally {
      inFlightRef.current = false;
      setIsLoading(false);
    }
  }, [alertUseCase]);

  /** 다음 장을 이어 붙인다. 이미 로딩 중이거나 끝이면 즉시 반환한다. */
  const loadMore = useCallback(async () => {
    if (inFlightRef.current || cursorRef.current == null) return;
    inFlightRef.current = true;
    setIsLoading(true);
    try {
      const page = await alertUseCase.getFeed({ ...queryRef.current, cursor: cursorRef.current });
      setItems((prev) => [...prev, ...page.items]);
      cursorRef.current = page.nextCursor;
      setHasMore(page.nextCursor != null);
    } catch {
      // 이어 붙이기 실패는 받은 목록을 지우지 않는다 — 다음 스크롤에서 다시 시도한다.
      setError('다음 알림을 불러오지 못했습니다.');
    } finally {
      inFlightRef.current = false;
      setIsLoading(false);
    }
  }, [alertUseCase]);

  return { items, isLoading, error, hasMore, reload, loadMore };
}
