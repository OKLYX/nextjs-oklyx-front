'use client';

import { Modal } from '@/presentation/components/ui/Modal';
import { DragNotice } from '@/presentation/components/WideScreenOnly';
import { useIsMobile } from '@/presentation/hooks/useIsMobile';

/**
 * Enlarged market photo (FEATURE_2609_68).
 *
 * **Purpose**: shows one large photo when a market photo in the global tool panel is tapped.
 * **File**: src/app/dashboard/components/MarketImagePreviewModal.tsx
 * **Used in**: `ChannelProductTool` only — **one for the whole tool**, not one per grid.
 *
 * **Usage**
 * ```tsx
 * const [previewUrl, setPreviewUrl] = useState<string | null>(null);
 * <MarketImagePreviewModal url={previewUrl} onClose={() => setPreviewUrl(null)} />
 * ```
 *
 * ⚠️ Open = `url != null` — the opener (the grid) holds the state.
 * ⚠️ The enlarged photo can be dragged too (look at it large, then drop it on a product) at 768px and up — do not
 *    turn `draggable` off there. Below 768px it is not draggable and a notice line sits above it (FEATURE_2610_31 D19).
 * 🔴 Backdrop, close and layer belong to `ui/Modal`. Do not define them again here (web popup rule).
 * 🔴 Market URLs are absolute — through `resolveThumbUrl` · `getImageUrl` they return 404.
 * ❌ No save or keep buttons. It is a window to look.
 */
interface MarketImagePreviewModalProps {
  /** 확대할 마켓 사진 URL. `null` = 닫힘. */
  url: string | null;
  onClose: () => void;
  /** 드래그로 실어 보낼 payload 를 만든다(격자와 같은 손). 없으면 끌 수 없다. */
  onDragStart?: (e: React.DragEvent, url: string) => void;
}

export function MarketImagePreviewModal({ url, onClose, onDragStart }: MarketImagePreviewModalProps) {
  const isMobile = useIsMobile();
  return (
    <Modal isOpen={url != null} onClose={onClose} title="사진 보기" closeOnOverlayClick>
      {url && (
        <>
          <DragNotice />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={url}
            alt="마켓 사진"
            draggable={!isMobile}
            onDragStart={(e) => onDragStart?.(e, url)}
            className="max-h-[70vh] w-full object-contain"
          />
        </>
      )}
    </Modal>
  );
}
