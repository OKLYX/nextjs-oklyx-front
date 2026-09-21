'use client';

/**
 * 사진 확대 보기(라이트박스) 공용 컴포넌트.
 * File: src/presentation/components/ImageLightbox.tsx
 *
 * **용도**: 썸네일 격자에서 사진 한 장을 눌렀을 때 크게 보여준다. 이미지 격자를 그리는 화면은
 *   자체 확대 팝업을 만들지 말고 **반드시 이 컴포넌트를 쓴다**(물품 갤러리 · 마스터 이미지 풀).
 *
 * **동작**
 *   - 열림 여부는 `index` 하나가 소유한다(`null` = 닫힘). 호출부는 "몇 번째를 보고 있는지"만 들면 된다.
 *   - ◀ ▶ 버튼과 ← → 키로 앞뒤 사진 이동(끝에서 순환하지 않는다 — 몇 장인지 감이 유지된다).
 *   - 닫기는 공용 `Modal` 이 소유한다(✕ · ESC). 제목에 `n / 전체` 를 함께 보여준다.
 *   - [원본 열기]는 새 탭. 저장한 원본을 그대로 띄우는 용도라 모달 안에서 더 키우지 않는다.
 *
 * **사용 예제**
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
 * ⚠️ `images` 는 렌더용 src 다 — 저장값(`imageUrl`)을 그대로 넘기지 말고 `resolveThumbUrl` 을 통과시킨다.
 * ⚠️ 썸네일이 드래그 가능한 카드 안에 있으면 `<img draggable={false}>` 를 유지할 것(드래그는 카드가 받는다).
 * ❌ 호출부에서 `fixed inset-0` 백드롭을 새로 만들지 않는다 — 껍데기는 `Modal` 이 소유한다.
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
      <div className="flex items-center gap-2">
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
