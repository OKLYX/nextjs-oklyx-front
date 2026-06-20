import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

interface NavigationStore {
  isProductsMenuOpen: boolean;
  isStockMenuOpen: boolean;
  isCostsMenuOpen: boolean;
  isUsersMenuOpen: boolean;
  isSalesProductsMenuOpen: boolean;
  isSellersMenuOpen: boolean;
  isOrdersMenuOpen: boolean;
  isPurchaseMenuOpen: boolean;
  hasHydrated: boolean;
  toggleProductsMenu: () => void;
  closeProductsMenu: () => void;
  toggleStockMenu: () => void;
  closeStockMenu: () => void;
  toggleCostsMenu: () => void;
  closeCostsMenu: () => void;
  toggleUsersMenu: () => void;
  closeUsersMenu: () => void;
  toggleSalesProductsMenu: () => void;
  toggleSellersMenu: () => void;
  toggleOrdersMenu: () => void;
  togglePurchaseMenu: () => void;
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
      isSalesProductsMenuOpen: false,
      isSellersMenuOpen: false,
      isOrdersMenuOpen: false,
      isPurchaseMenuOpen: false,
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
      toggleSalesProductsMenu: () => {
        set((state) => ({ isSalesProductsMenuOpen: !state.isSalesProductsMenuOpen }));
      },
      toggleSellersMenu: () => {
        set((state) => ({ isSellersMenuOpen: !state.isSellersMenuOpen }));
      },
      toggleOrdersMenu: () => {
        set((state) => ({ isOrdersMenuOpen: !state.isOrdersMenuOpen }));
      },
      togglePurchaseMenu: () => {
        set((state) => ({ isPurchaseMenuOpen: !state.isPurchaseMenuOpen }));
      },
      setHasHydrated: (hasHydrated: boolean) => set({ hasHydrated }),
      resetNavigation: () => set({
        isProductsMenuOpen: false,
        isStockMenuOpen: false,
        isCostsMenuOpen: false,
        isUsersMenuOpen: false,
        isSalesProductsMenuOpen: false,
        isSellersMenuOpen: false,
        isOrdersMenuOpen: false,
        isPurchaseMenuOpen: false,
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
        isSalesProductsMenuOpen: state.isSalesProductsMenuOpen,
        isSellersMenuOpen: state.isSellersMenuOpen,
        isOrdersMenuOpen: state.isOrdersMenuOpen,
        isPurchaseMenuOpen: state.isPurchaseMenuOpen,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    }
  )
);
