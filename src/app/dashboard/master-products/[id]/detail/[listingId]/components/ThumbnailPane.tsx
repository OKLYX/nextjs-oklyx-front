'use client';

import { useRef, useState } from 'react';
import { Spinner } from '@/presentation/components/Spinner';
import { resolveThumbUrl } from '@/infrastructure/utils/thumbUrl';
import type { GeneratedProductResponse } from '@/domain/entities/ListingRegistrationEntity';
import type { ListingRegistrationUseCase } from '@/application/usecases/ListingRegistrationUseCase';
import type { OnGenerated } from './DetailEditorTabs';

interface ThumbnailPaneProps {
  listingId: number;
  generated: GeneratedProductResponse;
  useCase: ListingRegistrationUseCase;
  onGenerated: OnGenerated;
}

/**
 * 탭4 — 채널 셀 썸네일 관리(조회 / 재생성 / 업로드 override / override 해제).
 * File: src/app/dashboard/master-products/[id]/detail/[listingId]/components/ThumbnailPane.tsx
 *
 * 배지·override 상태는 항상 `generated.thumbnailSource`로 파생(상세용 `source`와 별개).
 * override 상태에선 백엔드가 재생성 시 썸네일을 보존 → 재생성 버튼은 안내 후 비활성.
 * 텍스트값(brandName 등) 편집은 구조 데이터 탭 담당(여기선 최종 이미지만).
 */
export function ThumbnailPane({ listingId, generated, useCase, onGenerated }: ThumbnailPaneProps) {
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [error, setError] = useState('');
  // Cache-buster: same S3/local URL after re-upload would hit the browser cache.
  // Bumped after each action (0 on first render = no buster on the untouched image).
  const [bust, setBust] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const busy = isRegenerating || isUploading || isClearing;
  const isOverridden = generated.thumbnailSource === 'MANUAL_OVERRIDE';

  const handleRegenerate = async () => {
    setIsRegenerating(true);
    setError('');
    try {
      onGenerated(await useCase.regenerate(listingId));
      setBust(Date.now());
    } catch {
      setError('썸네일 처리에 실패했습니다.');
    } finally {
      setIsRegenerating(false);
    }
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploading(true);
    setError('');
    try {
      onGenerated(await useCase.overrideThumbnail(listingId, file));
      setBust(Date.now());
    } catch (err) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      setError(status === 400 ? '파일을 확인해 주세요 (JPG/PNG).' : '썸네일 처리에 실패했습니다.');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleClear = async () => {
    if (!window.confirm('수동 썸네일을 삭제하고 자동 생성으로 되돌립니다.')) return;
    setIsClearing(true);
    setError('');
    try {
      onGenerated(await useCase.clearThumbnail(listingId));
      setBust(Date.now());
    } catch {
      setError('썸네일 처리에 실패했습니다.');
    } finally {
      setIsClearing(false);
    }
  };

  return (
    <div className="space-y-4">
      {error && <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <div className="flex flex-wrap items-start gap-4">
        <div className="h-48 w-48 shrink-0 overflow-hidden rounded border border-gray-200 bg-gray-50">
          {generated.thumbnailUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={resolveThumbUrl(generated.thumbnailUrl, bust || undefined)}
              alt="현재 썸네일"
              className="h-full w-full object-contain"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-xs text-gray-400">
              썸네일 없음
            </div>
          )}
        </div>

        <div className="space-y-2">
          {isOverridden ? (
            <span className="inline-block rounded bg-amber-100 px-2 py-1 text-xs font-medium text-amber-700">
              수동 교체됨
            </span>
          ) : (
            <span className="inline-block rounded bg-emerald-100 px-2 py-1 text-xs font-medium text-emerald-700">
              자동 생성
            </span>
          )}
          <p className="max-w-md text-xs text-gray-500">
            {isOverridden
              ? 'override 상태에선 재생성해도 썸네일이 유지됩니다. 자동으로 되돌리려면 [override 해제]를 누르세요.'
              : '텍스트 값(브랜드명 등) 편집은 구조 데이터 탭에서 하면 썸네일에 반영됩니다.'}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 border-t border-gray-100 pt-3">
        <button
          type="button"
          onClick={handleRegenerate}
          disabled={busy || isOverridden}
          title={isOverridden ? 'override 상태에선 재생성해도 썸네일이 유지됩니다.' : undefined}
          className="flex items-center gap-1 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {isRegenerating ? <Spinner label="재생성 중..." /> : '재생성'}
        </button>

        <label className="flex cursor-pointer items-center gap-1 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100">
          {isUploading ? <Spinner label="업로드 중..." /> : '이미지 업로드로 교체'}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png"
            onChange={handleUpload}
            disabled={busy}
            className="hidden"
          />
        </label>

        {isOverridden && (
          <button
            type="button"
            onClick={handleClear}
            disabled={busy}
            className="flex items-center gap-1 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-50"
          >
            {isClearing ? <Spinner label="해제 중..." /> : 'override 해제'}
          </button>
        )}
      </div>
    </div>
  );
}
