'use client';

import { useState } from 'react';
import { Spinner } from '@/presentation/components/Spinner';
import type { GeneratedProductResponse } from '@/domain/entities/ListingRegistrationEntity';
import type { ListingRegistrationUseCase } from '@/application/usecases/ListingRegistrationUseCase';
import type { OnGenerated } from './DetailEditorTabs';

interface RawHtmlPaneProps {
  listingId: number;
  generated: GeneratedProductResponse;
  listingUseCase: ListingRegistrationUseCase;
  onGenerated: OnGenerated;
}

/**
 * 탭3 — raw HTML override(MANUAL_OVERRIDE). 현재 저장본을 직접 수정/복귀.
 * File: src/app/dashboard/master-products/[id]/detail/[listingId]/components/RawHtmlPane.tsx
 *
 * 빈 문자열 저장 허용(백엔드 @NotNull 은 null 만 거부). 미리보기는 격리 컨테이너.
 */
export function RawHtmlPane({ listingId, generated, listingUseCase, onGenerated }: RawHtmlPaneProps) {
  const [html, setHtml] = useState(generated.detailHtml ?? '');
  const [isSaving, setIsSaving] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [error, setError] = useState('');

  const busy = isSaving || isClearing;

  const handleOverride = async () => {
    setIsSaving(true);
    setError('');
    try {
      const res = await listingUseCase.overrideDetailHtml(listingId, { html });
      setHtml(res.detailHtml ?? '');
      onGenerated(res);
    } catch {
      setError('직접 작성한 내용을 저장하지 못했습니다.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleClear = async () => {
    if (!window.confirm('직접 수정한 내용을 버리고 템플릿 자동생성 결과로 되돌립니다. 계속하시겠습니까?')) return;
    setIsClearing(true);
    setError('');
    try {
      const res = await listingUseCase.clearDetailHtml(listingId);
      setHtml(res.detailHtml ?? '');
      onGenerated(res);
    } catch {
      setError('자동생성 복귀에 실패했습니다.');
    } finally {
      setIsClearing(false);
    }
  };

  return (
    <div className="space-y-3">
      <p className="rounded bg-amber-50 px-3 py-2 text-xs text-amber-700">
        저장하면 이 채널은 직접 수정한 상태가 되어, 재생성해도 여기 작성한 HTML 이 그대로 유지됩니다.
      </p>

      {error && <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">HTML 원본</label>
          <textarea
            value={html}
            onChange={(e) => setHtml(e.target.value)}
            spellCheck={false}
            className="h-96 w-full rounded border border-gray-300 p-2 font-mono text-xs text-gray-900"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">미리보기</label>
          <div className="h-96 overflow-auto rounded border border-gray-200 bg-white p-4">
            <div dangerouslySetInnerHTML={{ __html: html }} />
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 border-t border-gray-100 pt-3">
        <button
          type="button"
          onClick={handleOverride}
          disabled={busy}
          className="flex items-center gap-1 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {isSaving ? <Spinner label="저장 중..." /> : '저장하기'}
        </button>
        <button
          type="button"
          onClick={handleClear}
          disabled={busy}
          className="flex items-center gap-1 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-50"
        >
          {isClearing ? <Spinner label="초기화 중..." /> : '변경 초기화'}
        </button>
      </div>
    </div>
  );
}
