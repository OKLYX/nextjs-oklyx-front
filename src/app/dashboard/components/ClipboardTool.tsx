'use client';

import { useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import { useClipboardStore } from '@/infrastructure/stores/clipboardStore';
import { CLIP_MIME, hasClipPayload, type ClipItem } from '@/domain/entities/ClipItem';
import { resolveThumbUrl } from '@/infrastructure/utils/thumbUrl';
import { setSmallDragImage } from '@/infrastructure/utils/dragGhost';
import { DragNotice } from '@/presentation/components/WideScreenOnly';
import { useIsMobile } from '@/presentation/hooks/useIsMobile';
import { NavBadge } from './NavBadge';

/**
 * Clipboard — one tool of the right tool bar (FEATURE_2609_62 · moved from the top bar to the tool bar).
 *
 * **Purpose**: keeps product photos and values to move them to another product. The number of kept items shows as
 *   a badge on the tool bar icon; below 768px it is not shown while the tool bar is collapsed (FEATURE_2610_31 D43).
 * **File**: src/app/dashboard/components/ClipboardTool.tsx
 * **Two exports**
 * - `ClipboardRailSlot` — the shell around the tool bar (`ToolRail`) icon. Adds **the badge + the drop zone**.
 * - `ClipboardTool` — the tool panel (`ToolPanel`) body. The kept list, clear-all and the drop zone.
 * **Wired in**: `toolRegistry.tsx` only — screens do not mount it.
 * **Count**: `useClipboardStore` `items.length` — this store is the one way in for keeping and pasting.
 *
 * **Ways to keep (all work at 768px and up)**
 * - Drag a product gallery photo onto **the tool bar icon** (works while the panel is closed)
 * - Drag a **market photo** from the global tool panel (2609_68 — a market URL, not our row)
 * - Drop **into the panel** while it is open
 * - The [클립보드에 담기] button on the product detail (values + the whole gallery)
 *
 * **Pasting**: drag a panel row onto a product gallery (`ProductImageGallery`).
 *   Pasting does not remove it from the clipboard — it must be pastable onto several products.
 * **Below 768px**: rows are not draggable; a notice line sits above the list (FEATURE_2610_31 D19).
 *
 * 🔴 The count does not come in props — read the store directly (same rule as `AlertBell`).
 * 🔴 Do not use `ui/Modal` — `ToolPanel` opens it (z-40, under the sidebar · modal z-50).
 *   ⚠️ Do not open a dropdown (`absolute`) inside the tool bar — it overlaps `ToolPanel` on the right.
 * 🔴 Thumbnails render through `resolveThumbUrl(imageUrl)`. The representative proxy `getImageUrl` is not allowed.
 *   ⚠️ **Market photos (`market-image`) are the only exception** — already absolute, they go straight into `<img src>`.
 * ⚠️ To avoid a `persist` restore ↔ SSR first render mismatch, **the badge is not drawn before mount**.
 * ⚠️ `getData()` cannot be read on `dragover` — whether to accept is decided from `dataTransfer.types` only.
 */

/**
 * 툴바 아이콘과 패널 본문이 **같은 드롭존**이 되도록 핸들러를 한 곳에서 만든다.
 *
 * ⚠️ dragenter/dragleave 는 자식마다 뜬다 → boolean 하나면 강조가 깜빡인다(갤러리와 같은 이유).
 *    그래서 깊이를 센다.
 */
function useClipDropZone() {
  const add = useClipboardStore((state) => state.add);
  const [isDragOver, setIsDragOver] = useState(false);
  const dragDepth = useRef(0);

  const dropHandlers = {
    onDragEnter: (e: React.DragEvent) => {
      if (!hasClipPayload(e.dataTransfer.types)) return;
      e.preventDefault();
      dragDepth.current += 1;
      setIsDragOver(true);
    },
    onDragOver: (e: React.DragEvent) => {
      if (!hasClipPayload(e.dataTransfer.types)) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
    },
    onDragLeave: () => {
      dragDepth.current = Math.max(0, dragDepth.current - 1);
      if (dragDepth.current === 0) setIsDragOver(false);
    },
    onDrop: (e: React.DragEvent) => {
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
    },
  };

  return { isDragOver, dropHandlers };
}

/**
 * 툴바 아이콘 껍데기 — 안의 버튼(패널 열기/닫기)은 `ToolRail` 이 그대로 넘겨준다.
 * 여기서는 **담긴 개수 배지**와 **드롭존**만 얹는다.
 */
export function ClipboardRailSlot({ children }: { children: ReactNode }) {
  const items = useClipboardStore((state) => state.items);
  const { isDragOver, dropHandlers } = useClipDropZone();

  // 하이드레이션 mismatch 방지: 서버는 빈 목록을 그리지만 `persist` 는 localStorage 에서 복원한다.
  // ⚠️ `useState`+`useEffect` 로 하면 프로젝트 lint(`react-hooks/set-state-in-effect`)에 걸린다 —
  //    `TopBar` 의 테마 가드와 같은 방식을 쓴다(서버 false / 클라이언트 true).
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  return (
    <div
      {...dropHandlers}
      className={`relative rounded ${isDragOver ? 'ring-2 ring-blue-500' : ''}`}
    >
      {children}
      {/* NavBadge 는 메뉴 줄용 인라인 배지라 아이콘 위에 겹치려면 절대 배치 래퍼가 필요하다. */}
      <span className="absolute -top-1 -right-1">
        <NavBadge count={mounted ? items.length : 0} />
      </span>
    </div>
  );
}

/** 도구 패널 본문. 패널이 열려 있을 때만 마운트되므로 SSR 가드가 필요 없다. */
export function ClipboardTool() {
  const items = useClipboardStore((state) => state.items);
  const remove = useClipboardStore((state) => state.remove);
  const clear = useClipboardStore((state) => state.clear);
  const { isDragOver, dropHandlers } = useClipDropZone();
  const isMobile = useIsMobile();

  const thumbOf = (item: ClipItem): string | null => {
    // 마켓 사진은 절대 주소다 — 프록시를 태우면 404 가 난다.
    if (item.kind === 'market-image') return item.imageUrl;
    if (item.kind === 'image') return resolveThumbUrl(item.imageUrl);
    const first = item.imageRefs[0];
    return first ? resolveThumbUrl(first.imageUrl) : null;
  };

  const summaryOf = (item: ClipItem): string => {
    if (item.kind === 'market-image') return `마켓 · ${item.productName}`;
    if (item.kind === 'image') return '사진 1장';
    const valueCount = Object.values(item.values).filter((v) => v != null && v !== '').length;
    return `사진 ${item.imageRefs.length}장 · 값 ${valueCount}개`;
  };

  const startDragItem = (e: React.DragEvent, item: ClipItem) => {
    e.dataTransfer.setData(CLIP_MIME, JSON.stringify(item));
    e.dataTransfer.effectAllowed = 'copy';
    // 붙이는 쪽(물품 갤러리)도 같은 규칙 — 행 전체 대신 작은 조각이 따라다닌다.
    setSmallDragImage(e);
  };

  return (
    <>
      <DragNotice />
      <div
        {...dropHandlers}
        className={`overflow-hidden rounded-lg border ${
          isDragOver ? 'border-blue-500 ring-2 ring-blue-500' : 'border-gray-200'
        }`}
      >
        <div className="flex items-center justify-between border-b border-gray-200 bg-white px-3 py-2">
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
          <div className="px-3 py-6 text-center text-sm text-gray-500">
            여기에 상품 이미지를 끌어다 놓으세요
          </div>
        ) : (
          items.map((item) => {
            const thumb = thumbOf(item);
            return (
              <div
                key={item.clipId}
                draggable={!isMobile}
                onDragStart={(e) => startDragItem(e, item)}
                className="flex cursor-grab items-center gap-3 border-b border-gray-100 px-3 py-2 last:border-b-0 hover:bg-gray-50 active:cursor-grabbing"
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
    </>
  );
}
