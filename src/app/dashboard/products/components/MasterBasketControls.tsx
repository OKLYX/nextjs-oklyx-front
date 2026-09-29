'use client';

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { useRouter } from 'next/navigation';
import { ROUTES } from '@/config/routes';
import { toast } from '@/infrastructure/stores/toastStore';
import {
  useMasterBasketStore,
  type MasterBasketItem,
} from '@/infrastructure/stores/masterBasketStore';
import { Button } from '@/presentation/components/ui/Button';
import { ConfirmDialog } from '@/presentation/components/ui/ConfirmDialog';

interface MasterBasketControlsProps {
  /** 물품 상세 전용 — 넘기면 앞에 [바구니에 담기] 를 그린다(이 물품을 담는다, UX D51). */
  addTarget?: MasterBasketItem;
  /** 물품 목록 = true(말풍선에 [비우기] 추가, UX D68) · 물품 상세 = false(보기·빼기·[마스터 만들기]만, UX D55). */
  allowClear: boolean;
}

/**
 * 마스터 바구니 버튼 + 말풍선 (FEATURE_2609_78 / UX D51·D55·D65·D68).
 * File: src/app/dashboard/products/components/MasterBasketControls.tsx
 *
 * **쓰는 곳 2곳**: 물품 목록 제목 줄 오른쪽(`PageContainer action`) · 물품 상세 머리 버튼 줄.
 * 「바구니 N개」 를 누르면 **페이지를 옮기지 않고** 말풍선으로 담긴 목록을 보여 준다 — 줄마다 [빼기],
 * 아래 [마스터 만들기](+ 목록에서만 [비우기]). [마스터 만들기] = 바구니를 비우고 판매 상품 관리 마스터를
 * `?productIds=` 로 연다(그 물품들이 구성상품으로 골라진 채 — [설정 적용]은 사용자가 누른다).
 *
 * **필수 규칙**:
 * - 목록의 단일 원천은 `useMasterBasketStore`. 화면이 자기 목록을 따로 들지 않는다.
 * - 말풍선 층 = `AlertBell` 과 같은 z-40 · 바깥 클릭·Esc 로 닫기. 🔴 `ui/Modal` 을 쓰지 않는다(팝업이 아니다).
 * - [빼기]·[비우기] 는 공용 `ConfirmDialog` 로 확인한 뒤 뺀다(UX D68 · D32 — 모은 것을 버리는 일은 화면에서 되돌릴 수 없다).
 *   확인창이 떠 있는 동안에는 말풍선의 바깥 클릭·Esc 닫기를 멈춘다(확인창 클릭이 말풍선 바깥이라 닫혀 버린다).
 * - 개수는 마운트된 뒤에만 그린다(`persist` 하이드레이션 mismatch 방지).
 *
 * @example
 * <PageContainer title="상품 목록" action={<MasterBasketControls allowClear />}>…</PageContainer>
 * <MasterBasketControls addTarget={{ productId: product.id, productName: product.productName }} allowClear={false} />
 */
export function MasterBasketControls({ addTarget, allowClear }: MasterBasketControlsProps) {
  const router = useRouter();
  const items = useMasterBasketStore((state) => state.items);
  const add = useMasterBasketStore((state) => state.add);
  const remove = useMasterBasketStore((state) => state.remove);
  const clear = useMasterBasketStore((state) => state.clear);
  // 하이드레이션 가드(서버 false / 클라이언트 true) — `ClipboardRailSlot` 과 같은 방식.
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  const [isOpen, setIsOpen] = useState(false);
  // [빼기]·[비우기] 확인 대기(null = 확인창 닫힘).
  const [confirm, setConfirm] = useState<
    { kind: 'remove'; item: MasterBasketItem } | { kind: 'clear' } | null
  >(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const close = useCallback(() => setIsOpen(false), []);

  // 바깥 클릭·Esc 로 닫는다. 닫혀 있을 때·확인창이 떠 있을 때는 리스너를 걸지 않는다(`AlertBell` 과 같은 규칙).
  useEffect(() => {
    if (!isOpen || confirm != null) return;
    const onMouseDown = (event: MouseEvent) => {
      if (!wrapperRef.current?.contains(event.target as Node)) close();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close();
    };
    document.addEventListener('mousedown', onMouseDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onMouseDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [isOpen, close, confirm]);

  const shown = mounted ? items : [];
  const inBasket =
    addTarget != null && shown.some((item) => item.productId === addTarget.productId);

  const handleAdd = () => {
    if (addTarget == null) return;
    add([addTarget]);
    toast.success('바구니에 담았습니다.');
  };

  const handleCreateMaster = () => {
    if (shown.length === 0) return;
    const ids = shown.map((item) => item.productId).join(',');
    // UX D49: [마스터 만들기] 를 누르면 바구니를 비운다.
    clear();
    close();
    router.push(`${ROUTES.MASTER_PRODUCT_NEW}?productIds=${ids}`);
  };

  const handleConfirm = () => {
    if (confirm == null) return;
    if (confirm.kind === 'remove') remove(confirm.item.productId);
    else clear();
    setConfirm(null);
  };

  return (
    <div className="flex items-center gap-2">
      {addTarget != null && (
        <Button variant="secondary" onClick={handleAdd} disabled={!mounted || inBasket}>
          {inBasket ? '바구니에 담김' : '바구니에 담기'}
        </Button>
      )}
      <div ref={wrapperRef} className="relative">
        <Button variant="secondary" aria-expanded={isOpen} onClick={() => setIsOpen((open) => !open)}>
          바구니 {shown.length}개
        </Button>
        {isOpen && (
          // 팝업이 아니라 버튼에 붙은 말풍선이다 — 층은 `AlertBell` 과 같은 z-40(사이드바·모달 z-50 아래).
          <div className="absolute right-0 top-full z-40 mt-2 w-80 max-w-[calc(100vw-2rem)] rounded-lg border border-gray-200 bg-white shadow-lg">
            <div className="border-b border-gray-200 px-4 py-3 text-sm font-semibold text-gray-900">
              마스터 바구니 {shown.length}개
            </div>
            {shown.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-gray-500">바구니가 비어 있습니다.</p>
            ) : (
              <ul className="max-h-[50vh] divide-y divide-gray-100 overflow-y-auto">
                {shown.map((item) => (
                  <li key={item.productId} className="flex items-center justify-between gap-2 px-4 py-2">
                    <span className="min-w-0 truncate text-sm text-gray-900">{item.productName}</span>
                    <Button size="sm" variant="secondary" onClick={() => setConfirm({ kind: 'remove', item })}>
                      빼기
                    </Button>
                  </li>
                ))}
              </ul>
            )}
            <div className="flex items-center justify-end gap-2 border-t border-gray-200 px-4 py-2">
              {allowClear && (
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => setConfirm({ kind: 'clear' })}
                  disabled={shown.length === 0}
                >
                  비우기
                </Button>
              )}
              <Button size="sm" onClick={handleCreateMaster} disabled={shown.length === 0}>
                마스터 만들기
              </Button>
            </div>
          </div>
        )}
      </div>
      <ConfirmDialog
        isOpen={confirm != null}
        title={confirm?.kind === 'clear' ? '바구니 비우기' : '바구니에서 빼기'}
        message={
          confirm?.kind === 'clear'
            ? `바구니에 담긴 ${shown.length}개를 모두 뺍니다. 계속하시겠습니까?`
            : `${confirm?.item.productName ?? ''} 을(를) 바구니에서 뺍니다. 계속하시겠습니까?`
        }
        confirmText={confirm?.kind === 'clear' ? '비우기' : '빼기'}
        cancelText="취소"
        isDangerous
        onConfirm={handleConfirm}
        onCancel={() => setConfirm(null)}
      />
    </div>
  );
}
