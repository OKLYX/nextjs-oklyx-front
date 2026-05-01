import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

interface NavigationStore {
  isProductsMenuOpen: boolean;
  hasHydrated: boolean;
  toggleProductsMenu: () => void;
  closeProductsMenu: () => void;
  setHasHydrated: (hasHydrated: boolean) => void;
}

export const useNavigationStore = create<NavigationStore>()(
  persist(
    (set) => ({
      isProductsMenuOpen: false,
      hasHydrated: false,
      toggleProductsMenu: () => {
        set((state) => ({ isProductsMenuOpen: !state.isProductsMenuOpen }));
      },
      closeProductsMenu: () => set({ isProductsMenuOpen: false }),
      setHasHydrated: (hasHydrated: boolean) => set({ hasHydrated }),
    }),
    {
      name: 'navigation-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        isProductsMenuOpen: state.isProductsMenuOpen,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    }
  )
);
