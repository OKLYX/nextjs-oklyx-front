'use client';

/**
 * Shared photo zoom view (lightbox).
 * File: src/presentation/components/ImageLightbox.tsx
 *
 * **Purpose**: shows one photo large when it is tapped in a thumbnail grid or on a narrow-screen list card photo.
 *   A screen that draws a photo grid does not build its own zoom popup — it **must use this component** (product
 *   gallery · master image pool · duplicate product merge — the other product's search results · the left/right
 *   summary cells · the main photo picker). The narrow-screen card photos open it through `ZoomableThumb`
 *   (FEATURE_2610_31 D34).
 *
 * **Behaviour**
 *   - `index` alone owns whether it is open (`null` = closed). The caller only holds "which one is shown".
 *   - ◀ ▶ buttons and ← → keys move between photos (no wrap at the ends — the sense of how many stays).
 *   - Closing belongs to the shared `Modal` (✕ · ESC). The title shows `n / total` too.
 *   - [원본 열기] opens a new tab. It shows the stored original as it is, so it is not enlarged further in the modal.
 *
 * **Usage**
 * ```tsx
 * const [zoom, setZoom] = useState<number | null>(null);
 * <img onClick={() => setZoom(index)} className="cursor-zoom-in" … />
 * <ImageLightbox
 *   images={items.map((i) => ({ url: i.url }))}
 *   index={zoom}
 *   onIndexChange={setZoom}
 *   onClose={() => setZoom(null)}
 * />
 * ```
 *
 * ⚠️ `images` are render srcs — do not pass the stored value (`imageUrl`) as it is; pass it through `resolveThumbUrl`.
 * ⚠️ When a thumbnail sits in a draggable card, keep `<img draggable={false}>` (the card takes the drag).
 * ❌ Do not build a `fixed inset-0` backdrop in the caller — `Modal` owns the shell.
 */

import { useEffect } from 'react';
import { Modal } from '@/presentation/components/ui/Modal';

export type LightboxImage = {
  /** 렌더용 src(이미 resolveThumbUrl 등을 통과한 값). */
  url: string;
  /** 대체 텍스트(없으면 '확대 이미지'). */
  alt?: string;
};

interface ImageLightboxProps {
  images: LightboxImage[];
  /** 보고 있는 사진의 순번. `null` 이면 닫힘. */
  index: number | null;
  onIndexChange: (index: number) => void;
  onClose: () => void;
}

export function ImageLightbox({ images, index, onIndexChange, onClose }: ImageLightboxProps) {
  const isOpen = index != null && index >= 0 && index < images.length;

  // ← → 로도 넘긴다. 모달이 떠 있는 동안만 듣고, ESC 는 Modal 이 가져간다.
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' && index > 0) onIndexChange(index - 1);
      if (e.key === 'ArrowRight' && index < images.length - 1) onIndexChange(index + 1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, index, images.length, onIndexChange]);

  if (!isOpen) return null;
  const current = images[index];

  return (
    <Modal
      isOpen
      onClose={onClose}
      closeOnOverlayClick
      title={images.length > 1 ? `이미지 ${index + 1} / ${images.length}` : '이미지'}
      footer={
        <a
          href={current.url}
          target="_blank"
          rel="noreferrer"
          className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
        >
          원본 열기
        </a>
      }
    >
      <div className="flex items-center gap-2 max-md:flex-wrap">
        <button
          type="button"
          onClick={() => onIndexChange(index - 1)}
          disabled={index === 0}
          aria-label="이전 이미지"
          className="shrink-0 rounded border border-gray-300 px-2 py-6 text-gray-600 hover:bg-gray-100 disabled:opacity-30"
        >
          ◀
        </button>
        <div className="flex min-h-0 flex-1 items-center justify-center bg-gray-50">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={current.url}
            alt={current.alt ?? '확대 이미지'}
            className="max-h-[70dvh] w-full object-contain"
          />
        </div>
        <button
          type="button"
          onClick={() => onIndexChange(index + 1)}
          disabled={index === images.length - 1}
          aria-label="다음 이미지"
          className="shrink-0 rounded border border-gray-300 px-2 py-6 text-gray-600 hover:bg-gray-100 disabled:opacity-30"
        >
          ▶
        </button>
      </div>
    </Modal>
  );
}
