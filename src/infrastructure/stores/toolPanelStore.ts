import { create } from 'zustand';

/**
 * 대시보드 전역 도구 패널의 상태 (FEATURE_2609_68).
 *
 * **용도**: 오른쪽 세로 툴바(`ToolRail`)에서 고른 도구가 무엇인지, 패널(`ToolPanel`)이 열려 있는지를
 *   한 곳에서 들고 있다. 경로가 바뀌어도 열린 채로 따라온다.
 * **파일**: src/infrastructure/stores/toolPanelStore.ts
 * **쓰는 곳**: `dashboard/layout.tsx` · `ToolRail` · `ToolPanel` · 도구 컴포넌트(`ChannelProductTool`) ·
 *   손을 내미는 화면(`ProductRegistrationForm`).
 *
 * **`fillTarget` 이 있는 이유**: 도구가 화면 밖(전역 레이아웃)에 살기 때문에 폼의 `setValue` 를 직접
 *   부를 수 없다. 값을 받겠다는 화면이 마운트될 때 콜백 하나를 등록하고, 언마운트하면 지운다.
 *
 * **사용 예제**
 * ```tsx
 * // 툴바에서 열고 닫기
 * const toggle = useToolPanelStore((s) => s.toggle);
 * <button onClick={() => toggle('channel-product')} />
 *
 * // 값을 받을 화면에서 손을 내민다
 * const setFillTarget = useToolPanelStore((s) => s.setFillTarget);
 * useEffect(() => {
 *   setFillTarget((patch) => { ... });
 *   return () => setFillTarget(null);
 * }, [setFillTarget]);
 *
 * // 도구에서 값을 넘긴다 (없으면 [채우기] 버튼 자체를 그리지 않는다)
 * const fillTarget = useToolPanelStore((s) => s.fillTarget);
 * fillTarget?.({ productName: '…' });
 * ```
 *
 * ⚠️ `setFillTarget` 은 반드시 `set({ fillTarget: fn })` 형태로 쓴다. `set(fn)` 으로 넘기면 zustand 가
 *    함수를 updater 로 읽어 상태가 통째로 날아간다.
 * ⚠️ 손을 내민 화면은 언마운트에서 **반드시** `setFillTarget(null)` 한다 — 남으면 죽은 폼에 값을 쓴다.
 * ❌ `persist` 금지 — 새로고침하면 닫힌 상태로 시작한다. 마켓 값은 스냅샷이라 굳히면 낡은 값이 샌다.
 * ❌ `navigationStore` 에 끼워 넣지 말 것 — 그쪽은 `persist` 라 도구 상태까지 굳는다.
 */

/** 도구 키. 🔴 지금은 하나다 — 레지스트리·플러그인 추상화를 만들지 않는다. */
type ToolKey = 'channel-product';

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
