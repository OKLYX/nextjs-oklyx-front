'use client';

import { useSyncExternalStore } from 'react';

/**
 * 현재 뷰포트가 "좁은 화면(모바일 폭, md 미만 = 767px 이하)"인지 반환하는 훅.
 *
 * 용도: NavBar 드로어/레일 분기처럼 **동작(상태/이벤트) 레벨** 반응형 분기가
 * 필요할 때 사용. 경계는 CSS 유틸(`md:`)과 동일하게 Tailwind `md`(768px)를 따른다.
 * 파일: src/presentation/hooks/useIsMobile.ts
 *
 * SSR 안전: 서버에서는 항상 false(데스크탑)로 렌더한 뒤, 클라이언트 마운트 시
 * 실제 matchMedia 값으로 동기화한다(하이드레이션 불일치 방지). TopBar 다크모드
 * 토글의 useSyncExternalStore client-guard 패턴과 동일한 철학.
 *
 * @returns {boolean} 뷰포트가 767px 이하이면 true
 *
 * @example
 * const isMobile = useIsMobile();
 * // 드로어 vs 고정 레일처럼 렌더 구조 자체가 갈릴 때
 * return isMobile ? <Drawer /> : <Rail />;
 *
 * ⚠️ 순수 시각적 분기(테이블 ↔ 카드, 컬럼 수 등)는 이 훅 대신 CSS 유틸
 *    (`hidden md:block` / `md:hidden`)을 우선 사용할 것. 이 훅은 JS 동작이
 *    달라져야 할 때만 사용한다(불필요한 리렌더 방지).
 */
const MOBILE_QUERY = '(max-width: 767px)';

function subscribe(callback: () => void): () => void {
  const mql = window.matchMedia(MOBILE_QUERY);
  mql.addEventListener('change', callback);
  return () => mql.removeEventListener('change', callback);
}

export function useIsMobile(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(MOBILE_QUERY).matches,
    () => false
  );
}
