'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Spinner } from '@/presentation/components/Spinner';
import type { MasterProductImageResponse } from '@/domain/entities/DetailTemplateEntity';
import type { DetailContentUseCase } from '@/application/usecases/DetailContentUseCase';

interface ZoneImageManagerProps {
  masterId: number;
  zoneId: string;
  detailUseCase: DetailContentUseCase;
  onDirty: () => void;
}

/**
 * imageZone 블록별 이미지 매니저(masterId 기준, 마스터 소유 = 전 채널 공유).
 * File: src/app/dashboard/master-products/[id]/detail/[listingId]/components/ZoneImageManager.tsx
 *
 * ⚠️ imageUrl 은 이미 완성 URL → 그대로 <img src>(resolveThumbUrl 미적용).
 * ⚠️ reorder 는 해당 zone 전체 id 를 새 순서로 전송(부분 전송 시 백엔드 400).
 * CRUD 는 각자 즉시 서버 저장 → 변경 시 onDirty() 로 상위 재생성 트리거만 통지.
 */
export function ZoneImageManager({ masterId, zoneId, detailUseCase, onDirty }: ZoneImageManagerProps) {
  const [images, setImages] = useState<MasterProductImageResponse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyImageId, setBusyImageId] = useState<number | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadImages = useCallback(async () => {
    const list = await detailUseCase.listImages(masterId);
    setImages(
      list.filter((img) => img.zoneId === zoneId).sort((a, b) => a.sortOrder - b.sortOrder),
    );
  }, [detailUseCase, masterId, zoneId]);

  useEffect(() => {
    let alive = true;
    (async () => {
      setIsLoading(true);
      setError('');
      try {
        await loadImages();
      } catch {
        if (alive) setError('이미지를 불러오지 못했습니다.');
      } finally {
        if (alive) setIsLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [loadImages]);

  const anyBusy = busyImageId !== null || isUploading;

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setError('');
    setIsUploading(true);
    try {
      await detailUseCase.uploadImage(masterId, file, zoneId);
      await loadImages();
      onDirty();
    } catch {
      setError('이미지 업로드에 실패했습니다.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleDelete = async (imageId: number) => {
    setError('');
    setBusyImageId(imageId);
    try {
      await detailUseCase.deleteImage(masterId, imageId);
      await loadImages();
      onDirty();
    } catch {
      setError('삭제에 실패했습니다.');
    } finally {
      setBusyImageId(null);
    }
  };

  const move = async (index: number, dir: -1 | 1) => {
    const target = index + dir;
    if (target < 0 || target >= images.length) return;
    // Full zone id set in the new order (backend validates the set matches).
    const ids = images.map((img) => img.id);
    [ids[index], ids[target]] = [ids[target], ids[index]];
    setError('');
    setBusyImageId(images[index].id);
    try {
      const res = await detailUseCase.reorderImages(masterId, { zoneId, imageIds: ids });
      setImages(
        res.filter((img) => img.zoneId === zoneId).sort((a, b) => a.sortOrder - b.sortOrder),
      );
      onDirty();
    } catch {
      setError('순서 변경에 실패했습니다.');
    } finally {
      setBusyImageId(null);
    }
  };

  return (
    <div className="rounded-lg border border-gray-200 p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-medium text-gray-600">이미지 zone: {zoneId}</span>
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={anyBusy}
          className="flex items-center gap-1 rounded border border-blue-300 px-2 py-1 text-xs font-medium text-blue-700 hover:bg-blue-50 disabled:opacity-50"
        >
          {isUploading ? <Spinner label="업로드 중..." /> : '이미지 추가'}
        </button>
      </div>

      {error && <p className="mb-2 text-[11px] text-red-600">{error}</p>}

      {isLoading ? (
        <div className="flex min-h-20 items-center justify-center">
          <Spinner size={20} label="불러오는 중..." />
        </div>
      ) : images.length === 0 ? (
        <p className="text-xs text-gray-500">이 zone 에 등록된 이미지가 없습니다.</p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {images.map((img, index) => {
            const busy = busyImageId === img.id;
            return (
              <div key={img.id} className="rounded border border-gray-200 p-2">
                <div className="relative mb-2 aspect-square overflow-hidden rounded bg-gray-100">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={img.imageUrl}
                    alt={`${zoneId} #${img.sortOrder}`}
                    className="h-full w-full object-contain"
                  />
                  {busy && (
                    <div className="absolute inset-0 flex items-center justify-center bg-white/60">
                      <Spinner size={20} />
                    </div>
                  )}
                </div>
                <div className="flex items-center justify-between gap-1">
                  <div className="flex gap-1">
                    <button
                      type="button"
                      onClick={() => move(index, -1)}
                      disabled={anyBusy || index === 0}
                      className="rounded border border-gray-300 px-1.5 py-0.5 text-xs text-gray-700 hover:bg-gray-100 disabled:opacity-40"
                      aria-label="위로"
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      onClick={() => move(index, 1)}
                      disabled={anyBusy || index === images.length - 1}
                      className="rounded border border-gray-300 px-1.5 py-0.5 text-xs text-gray-700 hover:bg-gray-100 disabled:opacity-40"
                      aria-label="아래로"
                    >
                      ↓
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDelete(img.id)}
                    disabled={anyBusy}
                    className="rounded border border-red-300 px-1.5 py-0.5 text-xs text-red-600 hover:bg-red-50 disabled:opacity-50"
                  >
                    삭제
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png"
        onChange={handleUpload}
        hidden
      />
    </div>
  );
}
