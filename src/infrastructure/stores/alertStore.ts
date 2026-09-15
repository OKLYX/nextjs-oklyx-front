import { create } from 'zustand';
import { AlertRepositoryImpl } from '@/infrastructure/repositories/AlertRepositoryImpl';
import { AlertUseCase } from '@/application/usecases/AlertUseCase';
import type { AlertSummary } from '@/domain/entities/AlertEntity';

/**
 * 알림 숫자의 단일 원천 (FEATURE_2609_51). 종 배지·사이드바 배지·알림 센터가 같은 값을 본다.
 *
 * **용도**: "처리할 일이 몇 건인가"를 묻는 모든 자리가 읽는 store.
 * **파일**: src/infrastructure/stores/alertStore.ts
 *
 * 🔴 폴링을 시작하는 곳은 `app/dashboard/layout.tsx` **한 곳**이다(`useAlertSummaryPolling`).
 *    컴포넌트마다 폴링을 걸면 호출량이 사용처 수만큼 늘어난다.
 * 🔴 숫자를 props 로 내려보내지 않는다 — 알림 센터는 레이아웃의 자식이지만 경로가 달라
 *    Navbar/TopBar 와 같은 props 흐름에 얹을 수 없다. 읽는 쪽이 store 를 직접 구독한다.
 * ⚠️ 조회 실패는 **직전 값을 유지**하고 화면에 에러를 띄우지 않는다 — 배지는 보조 정보다.
 *
 * **사용 예제**
 * ```tsx
 * // 숫자를 읽는 쪽 (Navbar · AlertBell · 알림 센터)
 * const summary = useAlertStore((s) => s.summary);
 *
 * // 폴링을 도는 쪽 (레이아웃 하나뿐)
 * useAlertSummaryPolling();
 * ```
 *
 * ❌ 화면이 자기 목록을 세서 숫자를 만들지 않는다 — 목록에는 필터가 걸려 있다.
 */
interface AlertState {
  summary: AlertSummary | null;
  /** 즉시 재조회. 실패하면 직전 값을 그대로 둔다. */
  refresh: () => Promise<void>;
}

const alertUseCase = new AlertUseCase(new AlertRepositoryImpl());

export const useAlertStore = create<AlertState>((set) => ({
  summary: null,
  refresh: async () => {
    try {
      set({ summary: await alertUseCase.getSummary() });
    } catch {
      // 조용히 무시 (위 주석) — 직전 값 유지.
    }
  },
}));
