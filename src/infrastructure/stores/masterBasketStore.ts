import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

/**
 * 마스터 바구니 — 「이 물품들로 마스터 만들기」 할 물품을 모아 두는 곳 (FEATURE_2609_78 / UX D39·D45·D49).
 *
 * **용도**: 물품 목록·물품 상세에서 담아 두었다가 [마스터 만들기] 로 판매 상품 관리 마스터를 그 물품들이
 * 구성상품으로 골라진 채로 연다(`?productIds=`).
 * **파일**: src/infrastructure/stores/masterBasketStore.ts
 * **영속**: `localStorage` 키 `master-basket-storage` — 검색·페이지·화면을 오가도, 탭을 닫았다 열어도 남는다(D49).
 *
 * **필수 규칙**
 * - 클립보드(`clipboardStore`)와 **따로다**(D45). 섞지 말 것 — 클립보드는 값·사진을 옮기는 도구다.
 * - 담은 순서대로 뒤에 붙는다(이 순서가 구성상품 순서). 같은 `productId` 는 다시 담아도 늘지 않는다. 개수 제한 없음.
 * - [마스터 만들기] 를 누르면 비운다(D49 「누르거나 비우기 전까지」 유지).
 *
 * **사용 예제**
 * ```ts
 * const items = useMasterBasketStore((s) => s.items);
 * const add = useMasterBasketStore((s) => s.add);
 * add([{ productId: p.id, productName: p.productName }]);
 * ```
 *
 * ⚠️ **하이드레이션**: 개수를 화면에 그리는 쪽은 마운트된 뒤에만 그린다(`useSyncExternalStore` 가드 — 클립보드와 같은 방식).
 * ❌ 여기서 서버를 부르지 말 것. ❌ 물품 값(가격·사진)을 담지 말 것 — 이름은 목록 표시용일 뿐이다.
 */
export interface MasterBasketItem {
  productId: number;
  productName: string;
}

interface MasterBasketStore {
  items: MasterBasketItem[];
  add: (items: MasterBasketItem[]) => void;
  remove: (productId: number) => void;
  clear: () => void;
}

export const useMasterBasketStore = create<MasterBasketStore>()(
  persist(
    (set) => ({
      items: [],
      add: (incoming) =>
        set((state) => {
          const next = [...state.items];
          for (const item of incoming) {
            if (!next.some((existing) => existing.productId === item.productId)) next.push(item);
          }
          return { items: next };
        }),
      remove: (productId) =>
        set((state) => ({ items: state.items.filter((item) => item.productId !== productId) })),
      clear: () => set({ items: [] }),
    }),
    {
      name: 'master-basket-storage',
      storage: createJSONStorage(() => localStorage),
    },
  ),
);
