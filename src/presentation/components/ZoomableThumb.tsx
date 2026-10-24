'use client';

import { useState, type MouseEvent, type ReactNode } from 'react';
import { Search } from 'lucide-react';
import { ImageLightbox } from '@/presentation/components/ImageLightbox';

interface ZoomableThumbProps {
  /** Render src of the photo (already through `resolveThumbUrl` / `getProductThumbUrl`). null = no photo. */
  src: string | null;
  alt: string;
  /** Classes of the `<img>` (size, corners, fit) — the card's photo slot look. */
  imgClassName: string;
  /** What is drawn when there is no photo or it failed to load — not tappable. */
  placeholder: ReactNode;
}

const stop = (event: MouseEvent) => event.stopPropagation();

/**
 * Card photo with a small magnifier at its lower right; a tap opens the photo large in `ImageLightbox`
 * (FEATURE_2610_31 D34).
 *
 * **Purpose**: the narrow-screen cards whose app card zooms its photo (「주문」 · 「구매목록」 · 「상품조회」).
 * **File**: src/presentation/components/ZoomableThumb.tsx
 *
 * **Usage**:
 * ```tsx
 * <DataCard
 *   image={
 *     <ZoomableThumb
 *       src={getProductThumbUrl(p.imageUrl, p.id)}
 *       alt={p.productName}
 *       imgClassName="h-14 w-14 rounded object-cover"
 *       placeholder={<div className="h-14 w-14 rounded bg-gray-200" />}
 *     />
 *   }
 * />
 * ```
 *
 * ⚠️ The magnifier shows only after the photo has loaded; before that, and with no photo, a tap goes to the card.
 * ⚠️ A tap on the loaded photo (and inside the open lightbox) does not reach the card's `onClick`.
 * ❌ Do not build another zoom popup — this uses `ImageLightbox`.
 */
export function ZoomableThumb({ src, alt, imgClassName, placeholder }: ZoomableThumbProps) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const [zoom, setZoom] = useState<number | null>(null);

  if (src == null || failed) return <>{placeholder}</>;

  return (
    <span
      className="relative inline-block"
      onClick={
        loaded
          ? (event) => {
              event.stopPropagation();
              setZoom(0);
            }
          : undefined
      }
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        className={`${imgClassName} ${loaded ? 'cursor-zoom-in' : ''}`}
        onLoad={() => setLoaded(true)}
        onError={() => setFailed(true)}
      />
      {loaded && (
        <span
          aria-hidden
          className="absolute bottom-0.5 right-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-black/50 text-white"
        >
          <Search size={12} />
        </span>
      )}
      <span onClick={stop}>
        <ImageLightbox images={[{ url: src, alt }]} index={zoom} onIndexChange={setZoom} onClose={() => setZoom(null)} />
      </span>
    </span>
  );
}
