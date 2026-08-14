'use client';

import { useEffect, useRef, useState } from 'react';
import { Spinner } from '@/presentation/components/Spinner';
import type { TemplateField } from '@/domain/entities/ThumbnailEntity';

/**
 * Real composed preview rendered by the backend. The "미리보기" button (NOT
 * every drag) triggers a render; the returned JPEG blob is shown via an object
 * URL that is revoked before the next one and on unmount.
 * File: src/app/dashboard/thumbnail-templates/components/PreviewPanel.tsx
 */
interface PreviewPanelProps {
  fields: TemplateField[];
  onPreview: (sampleBindings: Record<string, string>) => Promise<Blob>;
  // Display the rendered preview at the SAME on-screen size as the editing
  // canvas (canvasWidth*scale × canvasHeight*scale) so element sizes match 1:1.
  displayWidth: number;
  displayHeight: number;
  /** Returns a blocking error message (e.g. a text element missing a font), or null if valid. */
  validate?: () => string | null;
}

export function PreviewPanel({ fields, onPreview, displayWidth, displayHeight, validate }: PreviewPanelProps) {
  // Sample value per field = user override, else defaultValue || label (reserved
  // fields have empty defaults → their label shows in the preview). Derived, so
  // no effect is needed to re-sync when fields change.
  const [overrides, setOverrides] = useState<Record<string, string>>({});
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const objectUrlRef = useRef<string | null>(null);

  const valueOf = (f: TemplateField) => overrides[f.key] ?? (f.defaultValue || f.label);

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
      const bindings: Record<string, string> = {};
      for (const f of fields) bindings[f.key] = valueOf(f);
      const blob = await onPreview(bindings);
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
        {fields.map((f) => (
          <div key={f.key}>
            <label className="mb-1 block text-xs font-medium text-gray-600">{f.label}</label>
            <input
              className={fieldCls}
              value={valueOf(f)}
              onChange={(e) => setOverrides((prev) => ({ ...prev, [f.key]: e.target.value }))}
            />
          </div>
        ))}
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
        <img
          src={imageUrl}
          alt="preview"
          className="rounded border border-gray-300"
          style={{ width: displayWidth, height: displayHeight, maxWidth: '100%' }}
        />
      )}
    </div>
  );
}
