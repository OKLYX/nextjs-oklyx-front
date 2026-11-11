import { create } from 'zustand';

/**
 * The 「채울까요?」 windows after an intake save (FEATURE_2611_22 D3 ① · D31 · D39).
 *
 * **Use**: every intake save hands the stock rows it wrote here; `FillFlowHost` asks the server which products have
 * order outbound rows without a lot and shows one window per product.
 * **File**: src/infrastructure/stores/fillFlowStore.ts
 * **Drawn by**: `presentation/components/FillFlowHost.tsx` only — `dashboard/layout.tsx` mounts it once.
 *
 * **Example**
 * ```ts
 * import { openFillFlow } from '@/infrastructure/stores/fillFlowStore';
 * const result = await purchaseListUseCase.recordPurchase(request);
 * if (result.lotId !== null) openFillFlow([result.lotId]);
 * ```
 *
 * ⚠️ Call it after the save succeeded — the intake is saved before any window shows (D39).
 * ❌ No `persist` — a reload drops the windows not shown yet; [입고로 채우기] of 「일별 입출고 내역」 fills them later.
 */
interface FillFlowStore {
  /** The saved lots of the last intake save, in save order; null = no window. */
  lotIds: number[] | null;
  open: (lotIds: number[]) => void;
  close: () => void;
}

export const useFillFlowStore = create<FillFlowStore>((set) => ({
  lotIds: null,
  open: (lotIds) => set({ lotIds: lotIds.length > 0 ? lotIds : null }),
  close: () => set({ lotIds: null }),
}));

/** Callable outside a component (after a save handler's request). */
export const openFillFlow = (lotIds: number[]) => useFillFlowStore.getState().open(lotIds);
