'use client';

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Clipboard } from 'lucide-react';
import { useClipboardStore } from '@/infrastructure/stores/clipboardStore';
import { CLIP_MIME, hasClipPayload, type ClipItem } from '@/domain/entities/ClipItem';
import { resolveThumbUrl } from '@/infrastructure/utils/thumbUrl';
import { NavBadge } from './NavBadge';

/**
 * 상단바 클립보드 아이콘 + 말풍선 (FEATURE_2609_62).
 *
 * **용도**: 물품 사진·값을 담아두고 다른 물품에 옮긴다. 담긴 개수는 아이콘 위 배지로 본다.
 * **파일**: src/app/dashboard/components/ClipboardTray.tsx
 * **숫자**: `useClipboardStore` 의 `items.length` — 이 store 가 담기·붙이기의 단일 창구다.
 *
 * **담는 법(둘 다 된다)**
 * - 물품 갤러리 사진을 끌어 **아이콘 위**에 놓기 (말풍선이 닫혀 있어도 받는다)
 * - 말풍선을 연 채로 **말풍선 안**에 놓기
 * - 물품 상세의 [클립보드에 담기] 버튼(값 + 갤러리 전부)
 *
 * **붙이는 법**: 말풍선의 행을 끌어 물품 갤러리에 놓는다(`ProductImageGallery`).
 *   붙여도 클립보드에서 사라지지 않는다 — 여러 물품에 붙일 수 있어야 한다.
 *
 * **사용 예제** — 상단바에서만 쓴다:
 * ```tsx
 * <ClipboardTray />
 * ```
 *
 * 🔴 `TopBar` 에서 개수를 props 로 받지 않는다 — store 를 직접 읽는다(`AlertBell` 과 같은 규칙).
 * 🔴 `ui/Modal` 을 쓰지 않는다 — 상단바 드롭다운이다(z-40, 사이드바·모달 z-50 아래).
 * 🔴 썸네일은 `resolveThumbUrl(imageUrl)` 로 렌더한다. 대표 프록시 `getImageUrl` 금지.
 * ⚠️ `persist` 복원 ↔ SSR 첫 렌더 mismatch 를 피하려고 **마운트 전에는 배지를 그리지 않는다**.
 * ⚠️ `dragover` 에서는 `getData()` 를 읽을 수 없다 — 받을지 말지는 `dataTransfer.types` 로만 판단한다.
 */
export function ClipboardTray() {
  const items = useClipboardStore((state) => state.items);
  const add = useClipboardStore((state) => state.add);
  const remove = useClipboardStore((state) => state.remove);
  const clear = useClipboardStore((state) => state.clear);

  const [isOpen, setIsOpen] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  // dragenter/dragleave 는 자식마다 뜬다 → boolean 하나면 강조가 깜빡인다(갤러리와 같은 이유).
  const dragDepth = useRef(0);

  // 하이드레이션 mismatch 방지: 서버는 빈 목록을 그리지만 `persist` 는 localStorage 에서 복원한다.
  // ⚠️ `useState`+`useEffect` 로 하면 프로젝트 lint(`react-hooks/set-state-in-effect`)에 걸린다 —
  //    `TopBar` 의 테마 가드와 같은 방식을 쓴다(서버 false / 클라이언트 true).
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  const close = useCallback(() => setIsOpen(false), []);

  // 바깥 클릭·Esc 로 닫는다. 닫혀 있을 때는 리스너를 걸지 않는다.
  useEffect(() => {
    if (!isOpen) return;
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
  }, [isOpen, close]);

  // ---- 아이콘·말풍선이 함께 드롭존이다(래퍼에 한 번만 단다) ----
  const handleDragEnter = (e: React.DragEvent) => {
    if (!hasClipPayload(e.dataTransfer.types)) return;
    e.preventDefault();
    dragDepth.current += 1;
    setIsDragOver(true);
  };

  const handleDragOver = (e: React.DragEvent) => {
    if (!hasClipPayload(e.dataTransfer.types)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  };

  const handleDragLeave = () => {
    dragDepth.current = Math.max(0, dragDepth.current - 1);
    if (dragDepth.current === 0) setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    if (!hasClipPayload(e.dataTransfer.types)) return;
    e.preventDefault();
    dragDepth.current = 0;
    setIsDragOver(false);
    const raw = e.dataTransfer.getData(CLIP_MIME);
    if (!raw) return;
    try {
      add(JSON.parse(raw) as ClipItem);
    } catch {
      // 우리 형식이 아니면 조용히 무시한다 — 담기는 실패해도 화면을 막지 않는다.
    }
  };

  const startDragItem = (e: React.DragEvent, item: ClipItem) => {
    e.dataTransfer.setData(CLIP_MIME, JSON.stringify(item));
    e.dataTransfer.effectAllowed = 'copy';
  };

  const thumbOf = (item: ClipItem): string | null => {
    if (item.kind === 'image') return resolveThumbUrl(item.imageUrl);
    const first = item.imageRefs[0];
    return first ? resolveThumbUrl(first.imageUrl) : null;
  };

  const summaryOf = (item: ClipItem): string => {
    if (item.kind === 'image') return '사진 1장';
    const valueCount = Object.values(item.values).filter((v) => v != null && v !== '').length;
    return `사진 ${item.imageRefs.length}장 · 값 ${valueCount}개`;
  };

  return (
    <div
      ref={wrapperRef}
      className="relative"
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        aria-label="클립보드"
        aria-expanded={isOpen}
        className={`relative inline-flex h-9 w-9 items-center justify-center rounded-lg text-gray-700 transition-colors hover:bg-gray-100 ${
          isDragOver ? 'ring-2 ring-blue-500' : ''
        }`}
      >
        <Clipboard className="h-5 w-5" />
        {/* NavBadge 는 메뉴 줄용 인라인 배지라 아이콘 위에 겹치려면 절대 배치 래퍼가 필요하다. */}
        <span className="absolute -top-1 -right-1">
          <NavBadge count={mounted ? items.length : 0} />
        </span>
      </button>

      {isOpen && (
        // AlertBell 과 같은 층(z-40) — 사이드바·모달(z-50) 아래, 표 sticky 헤더(z-10) 위.
        <div className="absolute right-0 mt-2 z-40 w-96 max-w-[calc(100vw-2rem)] max-h-[70vh] overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-lg">
          <div className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-200 bg-white px-4 py-3">
            <span className="text-sm font-semibold text-gray-900">담긴 항목 {items.length}개</span>
            {items.length > 0 && (
              <button
                type="button"
                onClick={clear}
                className="text-xs font-medium text-gray-500 hover:text-red-600"
              >
                모두 비우기
              </button>
            )}
          </div>

          {items.length === 0 ? (
            <div className="px-4 py-6 text-center text-sm text-gray-500">
              여기에 상품 이미지를 끌어다 놓으세요
            </div>
          ) : (
            items.map((item) => {
              const thumb = thumbOf(item);
              return (
                <div
                  key={item.clipId}
                  draggable
                  onDragStart={(e) => startDragItem(e, item)}
                  className="flex cursor-grab items-center gap-3 border-b border-gray-100 px-4 py-2 last:border-b-0 hover:bg-gray-50 active:cursor-grabbing"
                >
                  <div className="h-10 w-10 shrink-0 overflow-hidden rounded bg-gray-100">
                    {thumb && (
                      /* eslint-disable-next-line @next/next/no-img-element */
                      <img
                        src={thumb}
                        alt=""
                        draggable={false}
                        className="h-full w-full object-contain"
                      />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-gray-900">{item.productName}</p>
                    <p className="text-xs text-gray-500">{summaryOf(item)}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => remove(item.clipId)}
                    aria-label="비우기"
                    className="shrink-0 rounded px-2 py-1 text-xs text-gray-400 hover:bg-gray-100 hover:text-red-600"
                  >
                    ✕
                  </button>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
