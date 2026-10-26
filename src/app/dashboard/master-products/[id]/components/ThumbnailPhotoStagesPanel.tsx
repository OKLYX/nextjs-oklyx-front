'use client';

import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/presentation/components/ui/Button';
import { Spinner } from '@/presentation/components/Spinner';
import { extractErrorMessage } from '@/infrastructure/utils/errorMessage';
import { DetailContentUseCase } from '@/application/usecases/DetailContentUseCase';
import { DetailContentRepositoryImpl } from '@/infrastructure/repositories/DetailContentRepositoryImpl';
import type { MasterPoolImage } from '@/domain/entities/DetailTemplateEntity';
import type { ThumbnailPhotoStageView } from '@/domain/entities/ThumbnailPhotoEntity';
import { MasterImagePickerModal } from '../../components/MasterImagePickerModal';
import {
  THUMBNAIL_PHOTO_COLLAGE_NOTICE,
  THUMBNAIL_PHOTO_SOURCE_LABEL,
  thumbnailPhotoStageLabel,
} from '../../components/thumbnailPhotoLabels';

interface ThumbnailPhotoStagesPanelProps {
  masterId: number;
  /** A change reloads the stages (the pool bumps it after any mapping change). */
  reloadKey: number;
  /** Called after a stage was chosen or cleared, so the pool reloads its 「사용중」 state. */
  onChanged: () => void;
}

/**
 * 「단계별 썸네일 사진」 block of the master 「이미지」 tab (FEATURE_2610_32 D13 (나) · D14 · D32).
 * File: src/app/dashboard/master-products/[id]/components/ThumbnailPhotoStagesPanel.tsx
 *
 * One row per seller that has a listing of this master and per listing (the master stage is edited only in the
 * 「썸네일 사진」 card of the pool above) — the stage, the photo it uses with its status text, the collage notice,
 * [고르기] (one photo of this master's pool) and, for a stage with its own choice, [지우기(위 단계를 따름)].
 * The block title comes from the caller's `StackedBlock`.
 *
 * ⚠️ Choosing never regenerates a thumbnail (D9) — the listing's [저장 후 재생성] applies it.
 */
export function ThumbnailPhotoStagesPanel({
  masterId,
  reloadKey,
  onChanged,
}: ThumbnailPhotoStagesPanelProps) {
  const useCase = useMemo(() => new DetailContentUseCase(new DetailContentRepositoryImpl()), []);
  const [stages, setStages] = useState<ThumbnailPhotoStageView[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [picking, setPicking] = useState<ThumbnailPhotoStageView | null>(null);
  const [pool, setPool] = useState<MasterPoolImage[]>([]);

  useEffect(() => {
    let alive = true;
    (async () => {
      setIsLoading(true);
      setError('');
      try {
        const res = await useCase.listThumbnailPhotoStages(masterId);
        if (alive) setStages(res);
      } catch (e: unknown) {
        if (alive) setError(extractErrorMessage(e, '썸네일 사진 상태를 불러오지 못했습니다.'));
      } finally {
        if (alive) setIsLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [useCase, masterId, reloadKey]);

  const openPicker = async (view: ThumbnailPhotoStageView) => {
    setError('');
    try {
      const list = await useCase.listPoolImages(masterId);
      setPool([...list].sort((a, b) => a.sortOrder - b.sortOrder));
      setPicking(view);
    } catch (e: unknown) {
      setError(extractErrorMessage(e, '이미지 풀을 불러오지 못했습니다.'));
    }
  };

  const save = async (view: ThumbnailPhotoStageView, imageId: number | null) => {
    setBusy(true);
    setError('');
    try {
      setStages(
        await useCase.setThumbnailPhoto(masterId, {
          stage: view.stage,
          sellerId: view.stage === 'SELLER' ? view.sellerId : null,
          listingId: view.stage === 'LISTING' ? view.listingId : null,
          imageId,
        }),
      );
      onChanged();
    } catch (e: unknown) {
      setError(extractErrorMessage(e, '썸네일 사진을 바꾸지 못했습니다.'));
    } finally {
      setBusy(false);
    }
  };

  const rows = stages.filter((s) => s.stage !== 'MASTER');

  return (
    <div className="space-y-2 p-4">
      <p className="text-[11px] text-gray-500">
        썸네일 사진을 골라도 썸네일은 바로 바뀌지 않습니다. 판매상품 상세 「썸네일」 탭의 [저장 후
        재생성]으로 반영됩니다.
      </p>
      {error && <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      {isLoading ? (
        <div className="flex min-h-10 items-center">
          <Spinner size={18} label="불러오는 중..." />
        </div>
      ) : rows.length === 0 ? (
        <p className="py-3 text-center text-xs text-gray-500">이 마스터의 판매상품이 없습니다.</p>
      ) : (
        <ul className="divide-y divide-gray-100 rounded border border-gray-200">
          {rows.map((view) => (
            <li
              key={`${view.stage}-${view.sellerId ?? ''}-${view.listingId ?? ''}`}
              className={`flex flex-wrap items-center gap-3 px-3 py-2 text-sm ${
                view.stage === 'LISTING' ? 'pl-8' : ''
              }`}
            >
              <span
                className={view.stage === 'LISTING' ? 'text-gray-700' : 'font-medium text-gray-900'}
              >
                {thumbnailPhotoStageLabel(view)}
              </span>
              <div className="ml-auto flex items-center gap-2">
                {view.imageUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={view.imageUrl}
                    alt="썸네일 사진"
                    className="h-10 w-10 rounded border border-gray-200 bg-gray-100 object-contain"
                  />
                )}
                <div className="text-right">
                  <p className="text-xs text-gray-500">{THUMBNAIL_PHOTO_SOURCE_LABEL[view.source]}</p>
                  {view.collageUsed && (
                    <p className="text-[11px] text-amber-700">{THUMBNAIL_PHOTO_COLLAGE_NOTICE}</p>
                  )}
                </div>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => void openPicker(view)}
                  disabled={busy}
                >
                  고르기
                </Button>
                {view.source === 'OWN' && (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => void save(view, null)}
                    disabled={busy}
                  >
                    지우기(위 단계를 따름)
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {picking && (
        <MasterImagePickerModal
          key={`${picking.stage}-${picking.sellerId ?? ''}-${picking.listingId ?? ''}`}
          fieldLabel={`단계별 썸네일 사진 · ${thumbnailPhotoStageLabel(picking)}`}
          single
          images={pool.map((img) => ({ token: img.id, url: img.imageUrl }))}
          initialSelected={picking.source === 'OWN' && picking.imageId != null ? [picking.imageId] : []}
          onConfirm={(tokens) => {
            const view = picking;
            setPicking(null);
            void save(view, tokens[0] ?? null);
          }}
          onClose={() => setPicking(null)}
        />
      )}
    </div>
  );
}
