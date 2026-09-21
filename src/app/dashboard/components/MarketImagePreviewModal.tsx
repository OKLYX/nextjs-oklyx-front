'use client';

import { Modal } from '@/presentation/components/ui/Modal';

/**
 * 마켓 사진 확대 보기 (FEATURE_2609_68).
 *
 * **용도**: 전역 도구 패널의 마켓 사진을 눌렀을 때 큰 사진 한 장을 보여준다.
 * **파일**: src/app/dashboard/components/MarketImagePreviewModal.tsx
 * **쓰는 곳**: `ChannelProductTool` 하나뿐 — 격자마다가 아니라 **도구 전체에 하나**만 그린다.
 *
 * **사용 예제**
 * ```tsx
 * const [previewUrl, setPreviewUrl] = useState<string | null>(null);
 * <MarketImagePreviewModal url={previewUrl} onClose={() => setPreviewUrl(null)} />
 * ```
 *
 * ⚠️ 열림 여부는 `url != null` 이다 — 상태는 여는 쪽(격자)이 들고 있다.
 * ⚠️ 확대한 사진도 끌 수 있다(크게 보고 바로 물품에 넣는다) — `draggable` 을 끄지 말 것.
 * 🔴 백드롭·닫기·층은 `ui/Modal` 이 소유한다. 여기서 새로 정의하지 않는다(프론트 팝업 규칙).
 * 🔴 마켓 URL 은 절대 주소다 — `resolveThumbUrl`·`getImageUrl` 을 태우면 404 가 난다.
 * ❌ 저장·담기 버튼을 넣지 않는다. 보는 창이다.
 */
interface MarketImagePreviewModalProps {
  /** 확대할 마켓 사진 URL. `null` = 닫힘. */
  url: string | null;
  onClose: () => void;
  /** 드래그로 실어 보낼 payload 를 만든다(격자와 같은 손). 없으면 끌 수 없다. */
  onDragStart?: (e: React.DragEvent, url: string) => void;
}

export function MarketImagePreviewModal({ url, onClose, onDragStart }: MarketImagePreviewModalProps) {
  return (
    <Modal isOpen={url != null} onClose={onClose} title="사진 보기" closeOnOverlayClick>
      {url && (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          src={url}
          alt="마켓 사진"
          draggable
          onDragStart={(e) => onDragStart?.(e, url)}
          className="max-h-[70vh] w-full object-contain"
        />
      )}
    </Modal>
  );
}
