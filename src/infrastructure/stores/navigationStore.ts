import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

interface NavigationStore {
  isProductsMenuOpen: boolean;
  isStockMenuOpen: boolean;
  isCostsMenuOpen: boolean;
  isUsersMenuOpen: boolean;
  hasHydrated: boolean;
  toggleProductsMenu: () => void;
  closeProductsMenu: () => void;
  toggleStockMenu: () => void;
  closeStockMenu: () => void;
  toggleCostsMenu: () => void;
  closeCostsMenu: () => void;
  toggleUsersMenu: () => void;
  closeUsersMenu: () => void;
  setHasHydrated: (hasHydrated: boolean) => void;
  resetNavigation: () => void;
}

export const useNavigationStore = create<NavigationStore>()(
  persist(
    (set) => ({
      isProductsMenuOpen: false,
      isStockMenuOpen: false,
      isCostsMenuOpen: false,
      isUsersMenuOpen: false,
      hasHydrated: false,
      toggleProductsMenu: () => {
        set((state) => ({ isProductsMenuOpen: !state.isProductsMenuOpen }));
      },
      closeProductsMenu: () => set({ isProductsMenuOpen: false }),
      toggleStockMenu: () => {
        set((state) => ({ isStockMenuOpen: !state.isStockMenuOpen }));
      },
      closeStockMenu: () => set({ isStockMenuOpen: false }),
      toggleCostsMenu: () => {
        set((state) => ({ isCostsMenuOpen: !state.isCostsMenuOpen }));
      },
      closeCostsMenu: () => set({ isCostsMenuOpen: false }),
      toggleUsersMenu: () => {
        set((state) => ({ isUsersMenuOpen: !state.isUsersMenuOpen }));
      },
      closeUsersMenu: () => set({ isUsersMenuOpen: false }),
      setHasHydrated: (hasHydrated: boolean) => set({ hasHydrated }),
      resetNavigation: () => set({
        isProductsMenuOpen: false,
        isStockMenuOpen: false,
        isCostsMenuOpen: false,
        isUsersMenuOpen: false,
      }),
    }),
    {
      name: 'navigation-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        isProductsMenuOpen: state.isProductsMenuOpen,
        isStockMenuOpen: state.isStockMenuOpen,
        isCostsMenuOpen: state.isCostsMenuOpen,
        isUsersMenuOpen: state.isUsersMenuOpen,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    }
  )
);
