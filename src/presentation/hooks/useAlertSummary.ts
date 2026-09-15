'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertRepositoryImpl } from '@/infrastructure/repositories/AlertRepositoryImpl';
import { AlertUseCase } from '@/application/usecases/AlertUseCase';
import type { AlertSummary } from '@/domain/entities/AlertEntity';

/**
 * 알림 배지 카운트 (FEATURE_2609_49 / D9).
 *
 * **용도**: 사이드바 배지처럼 "처리할 일이 몇 건인가"를 보여주는 모든 자리의 단일 원천.
 * **필수 규칙**: 화면이 자기 목록을 세지 말고 이 훅을 쓴다 — 목록은 필터가 걸려 있어 전체 건수가 아니다.
 * **파일**: src/presentation/hooks/useAlertSummary.ts
 *
 * 🔴 **배지 숫자는 목록 화면의 행 수와 일치하지 않는다 — 정상이다.** 배지는 미완결/미답변 **전부**
 * (타입 무관·기간 무관, 실질 상한은 서버의 STALE 30일)이고, 반품/교환·고객문의 화면은 기본이
 * `반품` 탭 + 최근 2주다. 일치시키려고 배지를 기간으로 자르지 말 것 — 오래된 미처리 건이야말로
 * 배지가 존재하는 이유다.
 *
 * 서버는 로컬 DB 만 세므로(마켓 호출 0) 짧은 주기로 불러도 안전하다. 주기는 백그라운드 동기화(15분)보다
 * 촘촘할 이유가 없지만, 스케줄과 위상이 맞지 않으므로 60초로 둬 최악 지연을 1분으로 만든다.
 *
 * ⚠️ 실패는 조용히 무시한다 — 배지는 보조 정보다. 사이드바에 에러를 띄우면 모든 화면이 오염된다.
 * ❌ 훅을 여러 컴포넌트에서 동시에 쓰지 말 것(그만큼 호출이 늘어난다). 지금 사용처는 `Navbar` 하나다.
 */
export function useAlertSummary(intervalMs = 60_000) {
  const alertUseCase = useMemo(() => new AlertUseCase(new AlertRepositoryImpl()), []);
  const [summary, setSummary] = useState<AlertSummary | null>(null);

  const load = useCallback(async () => {
    try {
      setSummary(await alertUseCase.getSummary());
    } catch {
      // 조용히 무시 (위 주석)
    }
  }, [alertUseCase]);

  useEffect(() => {
    // ⚠️ `load()` 를 효과 본문에서 바로 부르면 lint(set-state-in-effect) 에 걸린다 — 인라인 async 로 감싼다.
    const loadInitialSummary = async () => { await load(); };
    loadInitialSummary();
    const timer = setInterval(() => void load(), intervalMs);
    // 탭을 다시 열었을 때 낡은 숫자를 그대로 두지 않는다.
    const onVisible = () => { if (document.visibilityState === 'visible') void load(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => { clearInterval(timer); document.removeEventListener('visibilitychange', onVisible); };
  }, [load, intervalMs]);

  return summary;
}
