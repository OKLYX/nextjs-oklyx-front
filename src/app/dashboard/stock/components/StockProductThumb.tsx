'use client';

import { useState } from 'react';
import { getProductThumbUrl } from '@/infrastructure/utils/imageUrl';

interface StockProductThumbProps {
  /** `Product.imageUrl` as the server sent it (S3 URL or disk path); null = no photo. */
  imageUrl: string | null;
  productId: number;
  alt: string;
}

/**
 * The 40px product photo left of a product name on the stock screens (FEATURE_2611_02 D14 · D19 · D20 · D22).
 *
 * **Purpose**: tell products apart at a glance on 「재고 조회」 · the stock history · 「일별 입출고 내역」 · 「입고 작업」 ·
 * 「출고 확인」.
 * **Rule**: every product line of those screens draws its photo with this component — do not copy the `<img>` again.
 * **File**: src/app/dashboard/stock/components/StockProductThumb.tsx
 *
 * **Usage**:
 * ```tsx
 * <StockProductThumb imageUrl={balance.imageUrl} productId={balance.productId} alt={balance.productName} />
 * <StockProductThumb imageUrl={line.imageUrl} productId={line.productId} alt={line.productName} />
 * ```
 *
 * ⚠️ The src comes from `getProductThumbUrl` (representative photo). No photo, or a photo that fails to load, draws
 * the grey 「없음」 box of the same size — never a broken image.
 * ❌ Do not add a tap-to-zoom (`ZoomableThumb` · `ImageLightbox`) — the photo is for telling products apart only.
 */
export function StockProductThumb({ imageUrl, productId, alt }: StockProductThumbProps) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const src = getProductThumbUrl(imageUrl, productId);

  if (src === null || src === failedSrc) {
    return (
      <div className="w-10 h-10 shrink-0 rounded border border-gray-200 bg-gray-50 flex items-center justify-center text-gray-300 text-xs">
        없음
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      loading="lazy"
      onError={() => setFailedSrc(src)}
      className="w-10 h-10 shrink-0 rounded border border-gray-200 object-cover bg-gray-50"
    />
  );
}
