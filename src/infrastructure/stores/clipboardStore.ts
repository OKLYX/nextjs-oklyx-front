import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { ClipItem } from '@/domain/entities/ClipItem';

/**
 * 클립보드(담아둔 물품 값·이미지) 전역 store — FEATURE_2609_62.
 *
 * **용도**: 물품 사이에서 사진과 값을 옮기기 위해 잠시 담아두는 곳. 브라우저 1대 안에서만 산다.
 * **파일**: src/infrastructure/stores/clipboardStore.ts
 * **영속**: `localStorage` 키 `clipboard-storage`. 탭을 닫았다 열어도 유지된다.
 *
 * **필수 규칙**
 * - 담기·붙이기의 **창구는 이 store 하나**다. 화면이 자기 목록을 따로 들고 있지 않는다.
 * - 새로 담은 것이 **앞**에 온다. 최대 `MAX_ITEMS`(30) 개 — 넘으면 뒤에서 잘린다.
 * - 같은 `productImageId` 를 또 담으면 **무시**한다(중복 없음).
 * - `kind: 'product'` 는 같은 `productId` 의 옛 항목을 **지우고 새로 담는다**(값 스냅샷이 최신이어야 한다).
 * - 이미지는 **참조**다(`productImageId`). 파일을 다시 올리지 않는다 — 붙일 때 서버가 행만 복제한다.
 *
 * **사용 예제**
 * ```ts
 * const items = useClipboardStore((s) => s.items);
 * const add = useClipboardStore((s) => s.add);
 * add({ clipId: newClipId(), kind: 'image', pickedAt: new Date().toISOString(), ... });
 * ```
 *
 * ⚠️ **하이드레이션**: `persist` 가 복원한 목록은 서버가 그린 HTML(빈 목록)과 달라 첫 렌더에서
 *   mismatch 가 난다. 개수를 화면에 그리는 쪽(`ClipboardTray` 의 배지)은 `mounted` 가 된 뒤에만 그린다.
 * ❌ 여기에 서버 호출을 넣지 말 것 — 붙이는 것은 `ProductImageUseCase.copy` 가 한다.
 * ❌ 물품 등록(저장 전) 화면에서 담지 말 것 — 아직 서버 id 가 없다.
 */
const MAX_ITEMS = 30;

interface ClipboardStore {
  items: ClipItem[];
  add: (item: ClipItem) => void;
  remove: (clipId: string) => void;
  clear: () => void;
}

/** 담을 때마다 새 id — `crypto.randomUUID` 가 없는 환경(구형 브라우저)에서는 시각+난수로 대체. */
export function newClipId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `clip-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export const useClipboardStore = create<ClipboardStore>()(
  persist(
    (set) => ({
      items: [],
      add: (item) =>
        set((state) => {
          if (item.kind === 'image') {
            // 같은 사진을 또 담아도 늘어나지 않는다.
            const duplicated = state.items.some(
              (existing) => existing.kind === 'image' && existing.productImageId === item.productImageId,
            );
            if (duplicated) return state;
            return { items: [item, ...state.items].slice(0, MAX_ITEMS) };
          }
          // 물품 통째로 담기: 같은 물품의 옛 스냅샷은 버린다.
          const rest = state.items.filter(
            (existing) => !(existing.kind === 'product' && existing.productId === item.productId),
          );
          return { items: [item, ...rest].slice(0, MAX_ITEMS) };
        }),
      remove: (clipId) => set((state) => ({ items: state.items.filter((item) => item.clipId !== clipId) })),
      clear: () => set({ items: [] }),
    }),
    {
      name: 'clipboard-storage',
      storage: createJSONStorage(() => localStorage),
    },
  ),
);
