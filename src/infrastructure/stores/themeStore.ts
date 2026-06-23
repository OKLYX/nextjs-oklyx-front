import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

/**
 * 애플리케이션 전역 테마(라이트/다크) 상태 store
 *
 * **용도**: Light/Dark 모드 전환 + localStorage 영속.
 * **단일 소스**: 다크모드 색상은 `globals.css`의 `.dark` 블록 한 곳에서만 관리.
 *   (이 store는 `<html>`에 `.dark` 클래스만 토글한다.)
 * **파일**: src/infrastructure/stores/themeStore.ts
 *
 * **사용 예제**:
 *   const theme = useThemeStore((s) => s.theme);
 *   const toggleTheme = useThemeStore((s) => s.toggleTheme);
 *
 * ⚠️ 초기 렌더 FOUC 방지: 첫 페인트 시 `<html>`에 `.dark`를 붙이는 작업은
 *   `app/layout.tsx`의 인라인 스크립트가 담당한다 (localStorage 키 `theme-storage` 파싱).
 *   이 store는 런타임 토글 시 DOM 클래스를 직접 동기화한다.
 *
 * ❌ 금지: 컴포넌트에서 개별적으로 다크 색상을 하드코딩하지 말 것 → globals.css `.dark` 사용.
 */
export type Theme = 'light' | 'dark';

interface ThemeStore {
  theme: Theme;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
}

// Sync the `.dark` class on <html> with the given theme (browser only).
const applyThemeClass = (theme: Theme) => {
  if (typeof document === 'undefined') return;
  document.documentElement.classList.toggle('dark', theme === 'dark');
};

export const useThemeStore = create<ThemeStore>()(
  persist(
    (set) => ({
      theme: 'light',
      toggleTheme: () =>
        set((state) => {
          const next: Theme = state.theme === 'dark' ? 'light' : 'dark';
          applyThemeClass(next);
          return { theme: next };
        }),
      setTheme: (theme) => {
        applyThemeClass(theme);
        set({ theme });
      },
    }),
    {
      name: 'theme-storage',
      storage: createJSONStorage(() => localStorage),
      // Re-sync the DOM class with persisted value after hydration.
      onRehydrateStorage: () => (state) => {
        if (state) applyThemeClass(state.theme);
      },
    }
  )
);
