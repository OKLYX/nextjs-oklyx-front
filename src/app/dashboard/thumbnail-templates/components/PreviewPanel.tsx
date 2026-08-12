'use client';

import { useEffect, useRef, useState } from 'react';
import { Spinner } from '@/presentation/components/Spinner';

/**
 * Real composed preview rendered by the backend. The "미리보기" button (NOT
 * every drag) triggers a render; the returned JPEG blob is shown via an object
 * URL that is revoked before the next one and on unmount.
 * File: src/app/dashboard/thumbnail-templates/components/PreviewPanel.tsx
 */
interface PreviewPanelProps {
  onPreview: (sampleBindings: Record<string, string>) => Promise<Blob>;
  /** Returns a blocking error message (e.g. a text element missing a font), or null if valid. */
  validate?: () => string | null;
}

export function PreviewPanel({ onPreview, validate }: PreviewPanelProps) {
  const [brandName, setBrandName] = useState('브랜드명');
  const [productName, setProductName] = useState('아주 긴 상품명 예시 텍스트 오토핏 확인용');
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const objectUrlRef = useRef<string | null>(null);

  useEffect(
    () => () => {
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    },
    []
  );

  const handlePreview = async () => {
    const validationError = validate?.();
    if (validationError) {
      setError(validationError);
      return;
    }
    setIsLoading(true);
    setError('');
    try {
      const blob = await onPreview({ brandName, productName });
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
      const url = URL.createObjectURL(blob);
      objectUrlRef.current = url;
      setImageUrl(url);
    } catch {
      setError('미리보기 생성에 실패했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  const fieldCls =
    'w-full rounded border border-gray-300 px-2 py-1 text-sm text-gray-900 focus:border-blue-500 focus:outline-none';

  return (
    <div className="space-y-3 rounded-lg border border-gray-200 bg-white p-4">
      <h3 className="text-sm font-semibold text-gray-900">미리보기</h3>
      <div className="space-y-2">
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">brandName</label>
          <input className={fieldCls} value={brandName} onChange={(e) => setBrandName(e.target.value)} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">productName</label>
          <input className={fieldCls} value={productName} onChange={(e) => setProductName(e.target.value)} />
        </div>
      </div>
      <button
        type="button"
        onClick={handlePreview}
        disabled={isLoading}
        className="w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
      >
        {isLoading ? <Spinner label="렌더링 중..." /> : '미리보기'}
      </button>
      {error && <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      {imageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={imageUrl} alt="preview" className="w-full rounded border border-gray-300" />
      )}
    </div>
  );
}
