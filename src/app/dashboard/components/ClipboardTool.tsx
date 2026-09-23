'use client';

import { useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import { useClipboardStore } from '@/infrastructure/stores/clipboardStore';
import { CLIP_MIME, hasClipPayload, type ClipItem } from '@/domain/entities/ClipItem';
import { resolveThumbUrl } from '@/infrastructure/utils/thumbUrl';
import { NavBadge } from './NavBadge';

/**
 * 클립보드 — 오른쪽 툴바의 도구 하나 (FEATURE_2609_62 · 상단바에서 툴바로 옮김).
 *
 * **용도**: 물품 사진·값을 담아두고 다른 물품에 옮긴다. 담긴 개수는 툴바 아이콘 위 배지로 본다.
 * **파일**: src/app/dashboard/components/ClipboardTool.tsx
 * **내보내는 것 둘**
 * - `ClipboardRailSlot` — 툴바(`ToolRail`) 아이콘을 감싸는 껍데기. **배지 + 드롭존**을 얹는다.
 * - `ClipboardTool` — 도구 패널(`ToolPanel`) 본문. 담긴 목록·비우기·드롭존.
 * **엮는 곳**: `toolRegistry.tsx` 한 곳뿐이다 — 화면마다 달지 않는다.
 * **숫자**: `useClipboardStore` 의 `items.length` — 이 store 가 담기·붙이기의 단일 창구다.
 *
 * **담는 법(둘 다 된다)**
 * - 물품 갤러리 사진을 끌어 **툴바 아이콘 위**에 놓기 (패널이 닫혀 있어도 받는다)
 * - 전역 도구 패널의 **마켓 사진**을 끌어다 놓기 (2609_68 — 우리 행이 아니라 마켓 URL 이다)
 * - 패널을 연 채로 **패널 안**에 놓기
 * - 물품 상세의 [클립보드에 담기] 버튼(값 + 갤러리 전부)
 *
 * **붙이는 법**: 패널의 행을 끌어 물품 갤러리에 놓는다(`ProductImageGallery`).
 *   붙여도 클립보드에서 사라지지 않는다 — 여러 물품에 붙일 수 있어야 한다.
 *
 * 🔴 개수를 props 로 받지 않는다 — store 를 직접 읽는다(`AlertBell` 과 같은 규칙).
 * 🔴 `ui/Modal` 을 쓰지 않는다 — 여는 것은 `ToolPanel`(z-40, 사이드바·모달 z-50 아래)이다.
 *   ⚠️ 툴바 안에서 자체 드롭다운(`absolute`)을 띄우지 말 것 — `ToolPanel` 과 오른쪽에서 겹친다.
 * 🔴 썸네일은 `resolveThumbUrl(imageUrl)` 로 렌더한다. 대표 프록시 `getImageUrl` 금지.
 *   ⚠️ **마켓 사진(`market-image`)만 예외** — 이미 절대 주소라 그대로 `<img src>` 에 넣는다.
 * ⚠️ `persist` 복원 ↔ SSR 첫 렌더 mismatch 를 피하려고 **마운트 전에는 배지를 그리지 않는다**.
 * ⚠️ `dragover` 에서는 `getData()` 를 읽을 수 없다 — 받을지 말지는 `dataTransfer.types` 로만 판단한다.
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
  };

  return (
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
              draggable
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
  );
}
