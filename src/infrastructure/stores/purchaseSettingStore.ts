import { create } from 'zustand';
import { PurchaseSettingRepositoryImpl } from '@/infrastructure/repositories/PurchaseSettingRepositoryImpl';
import { PurchaseSettingUseCase } from '@/application/usecases/PurchaseSettingUseCase';

/**
 * The one source of the stock link setting (FEATURE_2610_09 D65 · D71 · D72).
 *
 * **Purpose**: every place that changes with the stock link reads this store — the sidebar 「재고 조회」 item,
 * the 「입고·조정」 screen's 「입고 대기」 list, purchase hint and unit price field, and the purchase list check-in notice.
 * **File**: src/infrastructure/stores/purchaseSettingStore.ts
 *
 * 🔴 `stockLinked` is `null` until the first `load()` finishes, and stays `null` when it fails. Readers show the
 *    stock-linked parts only when the value is `true` — `null` behaves like off (D69 default).
 * 🔴 The 「구매관리 설정」 screen calls `setStockLinked` after a save so the sidebar follows without a reload.
 *
 * **Usage**
 * ```tsx
 * const stockLinked = usePurchaseSettingStore((s) => s.stockLinked);
 * const loadPurchaseSetting = usePurchaseSettingStore((s) => s.load);
 * useEffect(() => { void loadPurchaseSetting(); }, [loadPurchaseSetting]);
 * ```
 *
 * ❌ Do not fetch `/api/admin/purchase-settings` in a screen for this value — read the store.
 */
interface PurchaseSettingState {
  stockLinked: boolean | null;
  /** Fetch the setting. A failure leaves the previous value. */
  load: () => Promise<void>;
  setStockLinked: (stockLinked: boolean) => void;
}

const purchaseSettingUseCase = new PurchaseSettingUseCase(new PurchaseSettingRepositoryImpl());

export const usePurchaseSettingStore = create<PurchaseSettingState>((set) => ({
  stockLinked: null,
  load: async () => {
    try {
      const setting = await purchaseSettingUseCase.get();
      set({ stockLinked: setting.stockLinked });
    } catch {
      // Keep the previous value — the menu is not worth an error message.
    }
  },
  setStockLinked: (stockLinked) => set({ stockLinked }),
}));
