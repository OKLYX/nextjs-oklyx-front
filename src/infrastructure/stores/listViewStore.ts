import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

/**
 * 리스트 화면의 보기 모드(표/카드) 전역 store.
 *
 * **용도**: 좁은 화면(md 미만)에서 테이블을 가로 스크롤로 볼지, 카드로 볼지에 대한
 *   사용자 선호를 한 곳에서 관리 + localStorage 영속(화면 간 유지).
 * **파일**: src/infrastructure/stores/listViewStore.ts
 *
 * **동작 범위**: md 이상(데스크탑)에서는 항상 표를 보여주므로 이 값은 무시된다.
 *   md 미만에서만 표↔카드 전환에 사용된다(반응형 기준: md=768px).
 *
 * **사용 예제**:
 *   const viewMode = useListViewStore((s) => s.viewMode);
 *   const isMobile = useIsMobile();
 *   const showCards = isMobile && viewMode === 'card';
 *
 * ⚠️ 카드 뷰가 있는 테이블만 토글이 의미 있음. 카드 렌더러가 없는 테이블은
 *   `viewMode`와 무관하게 표(가로 스크롤)만 보여준다 → [[DataCard]] 참고.
 */
export type ListViewMode = 'table' | 'card';

interface ListViewStore {
  viewMode: ListViewMode;
  toggleViewMode: () => void;
  setViewMode: (mode: ListViewMode) => void;
}

export const useListViewStore = create<ListViewStore>()(
  persist(
    (set) => ({
      viewMode: 'table',
      toggleViewMode: () =>
        set((state) => ({ viewMode: state.viewMode === 'table' ? 'card' : 'table' })),
      setViewMode: (viewMode) => set({ viewMode }),
    }),
    {
      name: 'list-view-storage',
      storage: createJSONStorage(() => localStorage),
    }
  )
);
