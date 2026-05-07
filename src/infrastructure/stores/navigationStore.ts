import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

interface NavigationStore {
  isProductsMenuOpen: boolean;
  isStockMenuOpen: boolean;
  hasHydrated: boolean;
  toggleProductsMenu: () => void;
  closeProductsMenu: () => void;
  toggleStockMenu: () => void;
  closeStockMenu: () => void;
  setHasHydrated: (hasHydrated: boolean) => void;
}

export const useNavigationStore = create<NavigationStore>()(
  persist(
    (set) => ({
      isProductsMenuOpen: false,
      isStockMenuOpen: false,
      hasHydrated: false,
      toggleProductsMenu: () => {
        set((state) => ({ isProductsMenuOpen: !state.isProductsMenuOpen }));
      },
      closeProductsMenu: () => set({ isProductsMenuOpen: false }),
      toggleStockMenu: () => {
        set((state) => ({ isStockMenuOpen: !state.isStockMenuOpen }));
      },
      closeStockMenu: () => set({ isStockMenuOpen: false }),
      setHasHydrated: (hasHydrated: boolean) => set({ hasHydrated }),
    }),
    {
      name: 'navigation-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        isProductsMenuOpen: state.isProductsMenuOpen,
        isStockMenuOpen: state.isStockMenuOpen,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    }
  )
);
