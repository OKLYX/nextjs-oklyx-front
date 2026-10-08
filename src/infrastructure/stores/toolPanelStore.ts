import { create } from 'zustand';

/**
 * State of the dashboard-wide tool panel (FEATURE_2609_68).
 *
 * **Purpose**: holds, in one place, which tool was picked on the right-hand toolbar (`ToolRail`) and
 *   whether the panel (`ToolPanel`) is open. It stays open when the route changes.
 * **File**: src/infrastructure/stores/toolPanelStore.ts
 * **Where it is used**: `dashboard/layout.tsx` · `ToolRail` · `ToolPanel` · `toolRegistry` · the tool
 *   `ChannelProductTool` (reads `fillTarget`) · the screen that offers a fill target (`ProductRegistrationForm`).
 *   The tools `RegisteredProductTool` · `ClipboardTool` are listed in `toolRegistry` and do not read this store.
 *
 * **Why `fillTarget` exists**: tools live outside the screen (in the global layout), so they cannot call a
 *   form's `setValue` directly. A screen that wants values registers one callback on mount and clears it on unmount.
 *
 * **Usage**
 * ```tsx
 * // Open and close from the toolbar
 * const toggle = useToolPanelStore((s) => s.toggle);
 * <button onClick={() => toggle('channel-product')} />
 *
 * // The screen that wants values offers a target
 * const setFillTarget = useToolPanelStore((s) => s.setFillTarget);
 * useEffect(() => {
 *   setFillTarget((patch) => { ... });
 *   return () => setFillTarget(null);
 * }, [setFillTarget]);
 *
 * // A tool passes values (with no target, the [채우기] button is not rendered)
 * const fillTarget = useToolPanelStore((s) => s.fillTarget);
 * fillTarget?.({ productName: '…' });
 * ```
 *
 * ⚠️ Write `setFillTarget` as `set({ fillTarget: fn })`. With `set(fn)`, zustand reads the function as an
 *    updater and the whole state is lost.
 * ⚠️ The screen that offered a target must call `setFillTarget(null)` on unmount — a leftover target writes into a dead form.
 * ❌ No `persist` — a reload starts closed. Market values are snapshots; persisting them leaks stale values.
 * ❌ Do not fold this into `navigationStore` — that store uses `persist`, so tool state would be persisted too.
 */

/**
 * 도구 키. 🔴 목록(이름·아이콘·본문)은 `dashboard/components/toolRegistry.tsx` 한 곳에 있다 —
 * 키를 더하면 거기도 한 줄 더한다. 플러그인·동적 로딩으로 키우지 말 것.
 */
export type ToolKey = 'channel-product' | 'registered-product' | 'clipboard';

type FillTarget = ((patch: Record<string, string>) => void) | null;

interface ToolPanelStore {
  /** 열려 있는 도구. `null` = 닫힘. */
  openTool: ToolKey | null;
  /** 값을 받을 화면이 마운트되어 있는 동안만 값이 있다. */
  fillTarget: FillTarget;
  open: (tool: ToolKey) => void;
  close: () => void;
  /** 같은 도구를 다시 누르면 닫는다. */
  toggle: (tool: ToolKey) => void;
  setFillTarget: (fn: FillTarget) => void;
}

export const useToolPanelStore = create<ToolPanelStore>((set) => ({
  openTool: null,
  fillTarget: null,
  open: (tool) => set({ openTool: tool }),
  close: () => set({ openTool: null }),
  toggle: (tool) => set((state) => ({ openTool: state.openTool === tool ? null : tool })),
  // 🔴 `set(fn)` 이 아니라 `set({ fillTarget: fn })` — 함수를 상태에 담을 때의 흔한 사고를 막는다.
  setFillTarget: (fn) => set({ fillTarget: fn }),
}));
