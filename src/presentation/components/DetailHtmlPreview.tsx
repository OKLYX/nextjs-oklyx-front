'use client';

import { useEffect, useState } from 'react';
import { X } from 'lucide-react';

// Natural width the generated detail HTML is authored against. The thumbnail
// renders the page at this width then scales it down, so the miniature keeps
// the real layout proportions instead of reflowing to a tiny width.
const BASE_WIDTH = 800;
// Assumed tall page height (at BASE_WIDTH) the mini preview can scroll through on
// hover. Detail pages have no measurable height (sandboxed iframe is opaque), so
// this is a generous fixed value; anything shorter just shows trailing whitespace.
const CONTENT_HEIGHT = 3200;
// Extra right strip reserved for the always-visible vertical scrollbar so it sits
// OUTSIDE the image area (right of the framed preview) instead of overlaying the
// content. Wide enough to hold classic (~17px) scrollbars so the full image width
// stays visible with overflow-x hidden.
const SCROLL_GUTTER = 18;

interface DetailHtmlThumbProps {
  html: string;
  width?: number;
  height?: number;
  onClick: () => void;
}

/**
 * 생성된 상세페이지 HTML을 작게 축소해 보여주는 미리보기 썸네일
 *
 * 상세페이지 "모습"을 한눈에(제대로 생성됐는지) 확인하기 위한 read-only 미니 프리뷰.
 * HTML을 격리된 iframe(`srcDoc` + `sandbox=""`, 스크립트 차단)에 원본 폭(800px)으로 렌더한 뒤
 * CSS `transform: scale`로 축소한다. iframe은 `pointer-events-none`이라 클릭/휠은 바깥 버튼이 받음.
 *
 * ⚠️ 세로 스크롤바가 항상 보여(오른쪽 gutter) 상세페이지 전체를 축소 상태로 훑을 수 있다.
 * 클릭 시 부모가 탭 모달(`ChannelPreviewModal`)로 크게 띄우는 흐름.
 *
 * @param {string} html - 렌더할 상세페이지 HTML
 * @param {number} [width=96] - 썸네일 표시 폭(px)
 * @param {number} [height=128] - 썸네일 표시 높이(px)
 * @param {() => void} onClick - 클릭(확대) 콜백
 */
export function DetailHtmlThumb({ html, width = 96, height = 128, onClick }: DetailHtmlThumbProps) {
  const scale = width / BASE_WIDTH;
  return (
    <div className="relative" style={{ width: width + SCROLL_GUTTER, height }}>
      {/* Frame overlay hugs the image viewport only; the hover scrollbar lives in
          the gutter to its right, so it never overlays the preview content. */}
      <div
        className="pointer-events-none absolute inset-y-0 left-0 rounded border border-gray-200"
        style={{ width }}
      />
      <button
        type="button"
        onClick={onClick}
        title="클릭: 크게 보기 · 스크롤로 전체 훑기"
        className="block overflow-y-scroll overflow-x-hidden bg-white hover:opacity-90"
        style={{ width: width + SCROLL_GUTTER, height }}
      >
        {/* Middle box carries the scaled layout footprint (image width only) so the
            outer button scrolls through the whole (scaled) page on hover. */}
        <div style={{ position: 'relative', width, height: CONTENT_HEIGHT * scale }}>
          <iframe
            srcDoc={html}
            title="상세페이지 미리보기"
            tabIndex={-1}
            scrolling="no"
            sandbox=""
            className="pointer-events-none absolute left-0 top-0 border-0 bg-white"
            style={{
              width: BASE_WIDTH,
              height: CONTENT_HEIGHT,
              transform: `scale(${scale})`,
              transformOrigin: 'top left',
            }}
          />
        </div>
      </button>
    </div>
  );
}

export interface ChannelPreviewData {
  imageSrc: string | null; // resolved thumbnail URL (already through resolveThumbUrl)
  html: string | null; // generated detail-page HTML
  title: string;
  initialTab: 'image' | 'detail';
}

/**
 * 채널 미리보기 탭 모달 — 썸네일 이미지 + 생성된 상세페이지를 한 번에 확인
 *
 * 매트릭스의 썸네일/상세 셀 클릭 시 열린다. "이미지" 탭(썸네일 확대)과 "상세페이지" 탭
 * (상세 HTML을 격리 iframe에 세로 스크롤 렌더)을 한 모달에서 전환하며 확인한다.
 * backdrop 클릭/ESC로 닫힘. `data`가 null이면 렌더하지 않음.
 *
 * ⚠️ confirm 다이얼로그용 `PopupDialogModal`과 구분(read-only 미리보기 전용).
 *
 * @param {ChannelPreviewData | null} data - 미리보기 데이터 (null이면 return null)
 * @param {() => void} onClose - 닫기 콜백
 */
export function ChannelPreviewModal({
  data,
  onClose,
}: {
  data: ChannelPreviewData | null;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!data) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [data, onClose]);

  if (!data) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={data.title}
    >
      <div
        className="flex h-[85vh] w-full max-w-3xl flex-col overflow-hidden rounded-lg bg-white shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        {/* key resets the active tab whenever a different cell/tab opens the modal. */}
        <ChannelPreviewInner key={`${data.title}:${data.initialTab}`} data={data} onClose={onClose} />
      </div>
    </div>
  );
}

function ChannelPreviewInner({ data, onClose }: { data: ChannelPreviewData; onClose: () => void }) {
  const [tab, setTab] = useState<'image' | 'detail'>(data.initialTab);
  const tabClass = (active: boolean) =>
    `px-3 py-1.5 text-sm font-medium border-b-2 -mb-px ${
      active ? 'border-blue-600 text-blue-700' : 'border-transparent text-gray-500 hover:text-gray-700'
    }`;

  return (
    <>
      <div className="flex items-center justify-between border-b border-gray-200 px-4 pt-3">
        <div className="flex items-end gap-1">
          <button type="button" onClick={() => setTab('image')} className={tabClass(tab === 'image')}>
            이미지
          </button>
          <button type="button" onClick={() => setTab('detail')} className={tabClass(tab === 'detail')}>
            상세페이지
          </button>
        </div>
        <button onClick={onClose} aria-label="닫기" className="mb-2 text-gray-400 hover:text-gray-600">
          <X size={20} />
        </button>
      </div>
      <p className="border-b border-gray-100 px-4 py-2 text-xs text-gray-500">{data.title}</p>

      {/* flex-1 min-h-0 keeps the body a constant size across tabs → the modal
          never grows/shrinks when switching between image and detail. */}
      <div className="min-h-0 flex-1">
        {tab === 'image' ? (
          <div className="flex h-full items-center justify-center overflow-auto p-4">
            {data.imageSrc ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={data.imageSrc}
                alt={data.title}
                className="max-h-full max-w-full object-contain"
              />
            ) : (
              <p className="text-sm text-gray-500">썸네일 이미지가 없습니다</p>
            )}
          </div>
        ) : data.html ? (
          <iframe
            srcDoc={data.html}
            title={data.title}
            sandbox=""
            className="h-full w-full border-0 bg-white"
          />
        ) : (
          <div className="flex h-full items-center justify-center">
            <p className="text-sm text-gray-500">상세페이지가 아직 생성되지 않았습니다</p>
          </div>
        )}
      </div>
    </>
  );
}
