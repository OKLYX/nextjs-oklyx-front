'use client';

import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { Spinner } from '@/presentation/components/Spinner';

interface ImageLightboxProps {
  src: string | null;
  alt: string;
  onClose: () => void;
}

/**
 * 읽기 전용 이미지 확대(라이트박스) 모달
 *
 * 썸네일/상세이미지를 클릭해 원본 크기로 크게 보여줄 때 사용.
 * backdrop 클릭 / ESC 로 닫힌다. 편집 기능 없음(순수 뷰어).
 *
 * ⚠️ confirm 다이얼로그용 `PopupDialogModal`과 다름 — 그건 확인/취소용, 이건 이미지 확대 전용.
 * `src`가 null이면 아무것도 렌더하지 않음(열림 상태를 부모가 `lightbox` state로 관리).
 *
 * @component
 * @example
 * const [lightbox, setLightbox] = useState<{ src: string; alt: string } | null>(null);
 * // ...
 * <img src={url} onClick={() => setLightbox({ src: url, alt: '썸네일' })} />
 * <ImageLightbox src={lightbox?.src ?? null} alt={lightbox?.alt ?? ''} onClose={() => setLightbox(null)} />
 *
 * @param {string | null} src - 확대할 이미지 URL. null이면 return null.
 * @param {string} alt - 이미지 대체 텍스트
 * @param {() => void} onClose - 닫기 콜백 (backdrop 클릭/ESC/X 버튼)
 */
export function ImageLightbox({ src, alt, onClose }: ImageLightboxProps) {
  useEffect(() => {
    if (!src) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [src, onClose]);

  if (!src) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={alt}
    >
      <button
        onClick={onClose}
        aria-label="닫기"
        className="absolute right-4 top-4 text-white/80 transition-colors hover:text-white"
      >
        <X size={28} />
      </button>

      {/* key={src} remounts LightboxImage on src change → resets loaded/errored
          without a setState-in-effect (project lint rule). */}
      <LightboxImage key={src} src={src} alt={alt} />
    </div>
  );
}

function LightboxImage({ src, alt }: { src: string; alt: string }) {
  const [loaded, setLoaded] = useState(false);
  const [errored, setErrored] = useState(false);

  return (
    <div className="relative flex items-center justify-center" onClick={(e) => e.stopPropagation()}>
      {!loaded && !errored && (
        <div className="absolute inset-0 flex items-center justify-center text-white">
          <Spinner size={28} />
        </div>
      )}
      {errored ? (
        <div className="flex h-40 w-64 items-center justify-center rounded bg-gray-200 text-sm text-gray-600">
          이미지를 불러오지 못했습니다
        </div>
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={alt}
          onLoad={() => setLoaded(true)}
          onError={() => setErrored(true)}
          className={`max-h-[85vh] max-w-[90vw] object-contain ${loaded ? '' : 'invisible'}`}
        />
      )}
    </div>
  );
}
