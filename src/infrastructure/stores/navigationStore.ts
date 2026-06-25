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
  // Mobile/narrow-viewport sidebar drawer (hamburger). Not persisted.
  isSidebarOpen: boolean;
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
  toggleSidebar: () => void;
  closeSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
  setHasHydrated: (hasHydrated: boolean) => void;
  resetNavigation: () => void;
}

// All menus closed. Used to enforce accordion behavior:
// opening one menu collapses every other menu.
const ALL_MENUS_CLOSED = {
  isProductsMenuOpen: false,
  isStockMenuOpen: false,
  isCostsMenuOpen: false,
  isUsersMenuOpen: false,
  isSalesProductsMenuOpen: false,
  isSellersMenuOpen: false,
  isOrdersMenuOpen: false,
  isPurchaseMenuOpen: false,
} as const;

export const useNavigationStore = create<NavigationStore>()(
  persist(
    (set) => ({
      ...ALL_MENUS_CLOSED,
      isSidebarOpen: false,
      hasHydrated: false,
      toggleProductsMenu: () => {
        set((state) => ({ ...ALL_MENUS_CLOSED, isProductsMenuOpen: !state.isProductsMenuOpen }));
      },
      closeProductsMenu: () => set({ isProductsMenuOpen: false }),
      toggleStockMenu: () => {
        set((state) => ({ ...ALL_MENUS_CLOSED, isStockMenuOpen: !state.isStockMenuOpen }));
      },
      closeStockMenu: () => set({ isStockMenuOpen: false }),
      toggleCostsMenu: () => {
        set((state) => ({ ...ALL_MENUS_CLOSED, isCostsMenuOpen: !state.isCostsMenuOpen }));
      },
      closeCostsMenu: () => set({ isCostsMenuOpen: false }),
      toggleUsersMenu: () => {
        set((state) => ({ ...ALL_MENUS_CLOSED, isUsersMenuOpen: !state.isUsersMenuOpen }));
      },
      closeUsersMenu: () => set({ isUsersMenuOpen: false }),
      toggleSalesProductsMenu: () => {
        set((state) => ({ ...ALL_MENUS_CLOSED, isSalesProductsMenuOpen: !state.isSalesProductsMenuOpen }));
      },
      toggleSellersMenu: () => {
        set((state) => ({ ...ALL_MENUS_CLOSED, isSellersMenuOpen: !state.isSellersMenuOpen }));
      },
      toggleOrdersMenu: () => {
        set((state) => ({ ...ALL_MENUS_CLOSED, isOrdersMenuOpen: !state.isOrdersMenuOpen }));
      },
      togglePurchaseMenu: () => {
        set((state) => ({ ...ALL_MENUS_CLOSED, isPurchaseMenuOpen: !state.isPurchaseMenuOpen }));
      },
      toggleSidebar: () => set((state) => ({ isSidebarOpen: !state.isSidebarOpen })),
      closeSidebar: () => set({ isSidebarOpen: false }),
      setSidebarOpen: (open: boolean) => set({ isSidebarOpen: open }),
      setHasHydrated: (hasHydrated: boolean) => set({ hasHydrated }),
      resetNavigation: () => set({ ...ALL_MENUS_CLOSED, isSidebarOpen: false }),
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
