'use client';

import { useEffect, useState } from 'react';
import { Spinner } from '@/presentation/components/Spinner';
import type { GeneratedProductResponse } from '@/domain/entities/ListingRegistrationEntity';
import type { ListingRegistrationUseCase } from '@/application/usecases/ListingRegistrationUseCase';

interface AutoPreviewPaneProps {
  listingId: number;
  generated: GeneratedProductResponse;
  listingUseCase: ListingRegistrationUseCase;
}

/**
 * 탭1 — override 를 무시한 AUTO 생성 결과 미리보기(비교용).
 * File: src/app/dashboard/master-products/[id]/detail/[listingId]/components/AutoPreviewPane.tsx
 *
 * 신뢰 소스(백엔드 산출 HTML)이므로 dangerouslySetInnerHTML + 격리 컨테이너로 렌더.
 * generated 가 갱신되면(저장 후) 미리보기를 재조회한다.
 */
export function AutoPreviewPane({ listingId, generated, listingUseCase }: AutoPreviewPaneProps) {
  const [html, setHtml] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  const isOverridden = generated.source === 'MANUAL_OVERRIDE';

  useEffect(() => {
    let alive = true;
    (async () => {
      setIsLoading(true);
      setError('');
      try {
        const res = await listingUseCase.previewDetail(listingId);
        if (alive) setHtml(res.html);
      } catch {
        if (alive) setError('미리보기를 불러오지 못했습니다.');
      } finally {
        if (alive) setIsLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
    // Re-fetch after a save (generated identity changes).
  }, [listingUseCase, listingId, generated]);

  return (
    <div className="space-y-3">
      <p className="rounded bg-blue-50 px-3 py-2 text-xs text-blue-700">
        현재 저장본이 아니라 자동생성 결과 미리보기입니다.
      </p>
      {isOverridden && (
        <p className="rounded bg-amber-50 px-3 py-2 text-xs text-amber-700">
          수동 override 가 적용 중입니다 — 실제 저장본은 &quot;상세 페이지 &gt; HTML 직접수정&quot; 에서 확인하세요.
        </p>
      )}

      {error && <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      {isLoading ? (
        <div className="flex min-h-40 items-center justify-center">
          <Spinner size={24} label="불러오는 중..." />
        </div>
      ) : (
        <div className="overflow-x-auto rounded border border-gray-200 bg-white p-4">
          <div dangerouslySetInnerHTML={{ __html: html }} />
        </div>
      )}
    </div>
  );
}
