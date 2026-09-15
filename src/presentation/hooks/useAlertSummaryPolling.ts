'use client';

import { useEffect } from 'react';
import { useAlertStore } from '@/infrastructure/stores/alertStore';

/**
 * 알림 배지 카운트 폴링 (FEATURE_2609_49 / D9 · FEATURE_2609_51 / D10).
 *
 * **용도**: `alertStore` 의 숫자를 주기적으로 최신으로 유지한다. 값을 **반환하지 않는다** —
 *   숫자가 필요한 곳은 `useAlertStore((s) => s.summary)` 를 읽는다.
 * **파일**: src/presentation/hooks/useAlertSummary.ts
 *
 * 🔴 **레이아웃(`app/dashboard/layout.tsx`)에서 한 번만 호출한다.** 사용처가 늘 때마다 호출도
 * 늘어나므로 훅을 여러 컴포넌트에서 부르지 말 것 — 그래서 값을 store 로 올렸다(2609_51 Step 2).
 *
 * 🔴 **배지 숫자는 목록 화면의 행 수와 일치하지 않는다 — 정상이다.** `openClaims`·
 * `unansweredInquiries` 는 미완결/미답변 **전부**(타입 무관·기간 무관, 실질 상한은 서버의 STALE 30일)
 * 이고, 반품/교환·고객문의 화면은 기본이 `반품` 탭 + 최근 2주다. 일치시키려고 배지를 기간으로
 * 자르지 말 것 — 오래된 미처리 건이야말로 배지가 존재하는 이유다.
 * (예외: 종 배지 `todoCount` 는 알림 목록 자체를 세므로 목록 행 수와 같다 — 2609_51 D3.)
 *
 * 서버는 로컬 DB 만 세므로(마켓 호출 0) 짧은 주기로 불러도 안전하다. 주기는 백그라운드 동기화(15분)보다
 * 촘촘할 이유가 없지만, 스케줄과 위상이 맞지 않으므로 60초로 둬 최악 지연을 1분으로 만든다.
 *
 * ⚠️ 실패는 조용히 무시한다 — 배지는 보조 정보다. 사이드바에 에러를 띄우면 모든 화면이 오염된다.
 * ❌ 알림 **목록**은 폴링하지 않는다(D10) — `useAlertFeed` 는 열 때만 부른다.
 */
export function useAlertSummaryPolling(intervalMs = 60_000) {
  const refresh = useAlertStore((state) => state.refresh);

  useEffect(() => {
    // ⚠️ `refresh()` 를 효과 본문에서 바로 부르면 lint(set-state-in-effect) 에 걸린다 — 인라인 async 로 감싼다.
    const loadInitialSummary = async () => { await refresh(); };
    loadInitialSummary();
    const timer = setInterval(() => void refresh(), intervalMs);
    // 탭을 다시 열었을 때 낡은 숫자를 그대로 두지 않는다.
    const onVisible = () => { if (document.visibilityState === 'visible') void refresh(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => { clearInterval(timer); document.removeEventListener('visibilitychange', onVisible); };
  }, [refresh, intervalMs]);
}
