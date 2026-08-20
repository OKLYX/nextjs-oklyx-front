'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import axios from 'axios';
import { resolveThumbUrl } from '@/infrastructure/utils/thumbUrl';
import { Spinner } from '@/presentation/components/Spinner';
import type { ProductImage } from '@/domain/entities/ProductImage';
import type { ProductImageUseCase } from '@/application/usecases/ProductImageUseCase';

/**
 * 물품(상품)의 다중 이미지 갤러리. 단일 `ProductImageSection` 을 대체하며 물품
 * 등록/수정/상세 3화면에서 재사용한다.
 * File: src/app/dashboard/products/[id]/components/ProductImageGallery.tsx
 *
 * **용도**: 여러 장 업로드·대체·삭제·순서변경(◀▶). 첫 장이 "대표"(백엔드 규칙).
 *
 * **모드**:
 *   - 수정/상세(`productId != null`): 마운트 시 서버 조회, 각 연산 즉시 서버 반영(backend 39).
 *   - 등록(`productId == null`): 서버 호출 없이 부모 보관 버퍼(`buffer`/`onBufferChange`)만
 *     갱신 → 부모가 상품 생성 후 `add(created.id, buffer)` 로 일괄 업로드.
 *
 * **필수 규칙**:
 *   - `useCase`/`buffer` 는 부모가 소유·주입(컴포넌트 내 신규 생성 금지).
 *   - 서버 이미지 `imageUrl` 은 `resolveThumbUrl`(http 직접 / else uploads 프록시)로 렌더.
 *     ⚠️ 대표 `Product.imageUrl` 프록시(`getImageUrl`)와 다름 — 갤러리는 이미지별 URL 이라
 *     프록시를 쓰면 모든 카드가 같은 이미지가 됨. 절대 혼용 금지.
 *   - 삭제 409 = 마스터 풀에 배치돼 사용 중 → 백엔드 메시지 안내(§5).
 *
 * ❌ 금지 패턴:
 *   - 등록 모드에서 서버 호출(버퍼만).
 *   - `getImageUrl(imageUrl, productId)` 로 갤러리 이미지 렌더(대표 프록시 → 전 카드 동일).
 */
interface ProductImageGalleryProps {
  productId: number | null; // null = 등록(버퍼), 값 = 수정(즉시 서버)
  useCase: ProductImageUseCase;
  buffer?: File[]; // 등록 모드: 부모 보관 업로드 대기열(순서 = 대표 후보)
  onBufferChange?: (files: File[]) => void;
  isViewMode?: boolean; // true = 조회 전용(업로드/편집 숨김)
}

const ACCEPT = 'image/jpeg,image/png';
const MAX_SIZE = 20 * 1024 * 1024;
const REJECT_MSG = 'JPEG/PNG·20MB 이하만 업로드 가능';

// A row normalized across both modes. `imageId` is null in register mode.
type GalleryItem = { key: string; url: string; imageId: number | null };

export function ProductImageGallery({
  productId,
  useCase,
  buffer,
  onBufferChange,
  isViewMode = false,
}: ProductImageGalleryProps) {
  const isEdit = productId != null;

  const [images, setImages] = useState<ProductImage[]>([]);
  const [isLoading, setIsLoading] = useState(isEdit);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const uploadRef = useRef<HTMLInputElement>(null);
  const replaceRef = useRef<HTMLInputElement>(null);
  // Which row a pending [대체] applies to (imageId in edit mode, index in register mode).
  const replaceTargetRef = useRef<{ imageId: number | null; index: number } | null>(null);

  const reload = useCallback(async () => {
    if (productId == null) return;
    const list = await useCase.list(productId);
    setImages([...list].sort((a, b) => a.sortOrder - b.sortOrder));
  }, [useCase, productId]);

  useEffect(() => {
    if (productId == null) return;
    let alive = true;
    (async () => {
      setIsLoading(true);
      setError('');
      try {
        const list = await useCase.list(productId);
        if (alive) setImages([...list].sort((a, b) => a.sortOrder - b.sortOrder));
      } catch {
        if (alive) setError('이미지를 불러오지 못했습니다.');
      } finally {
        if (alive) setIsLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [useCase, productId]);

  // Register-mode object-URL previews (revoked on change/unmount).
  const bufferFiles = buffer;
  const previews = useMemo(
    () => (isEdit ? [] : (bufferFiles ?? []).map((f) => URL.createObjectURL(f))),
    [isEdit, bufferFiles],
  );
  useEffect(() => {
    return () => previews.forEach((u) => URL.revokeObjectURL(u));
  }, [previews]);

  const items: GalleryItem[] = useMemo(() => {
    if (isEdit) {
      return images.map((img) => ({
        key: String(img.id),
        url: resolveThumbUrl(img.imageUrl),
        imageId: img.id,
      }));
    }
    return previews.map((url, index) => ({ key: `buf-${index}`, url, imageId: null }));
  }, [isEdit, images, previews]);

  // Keep only JPEG/PNG ≤ 20MB; surface a banner if anything was dropped.
  const filterValid = useCallback((files: File[]): File[] => {
    const valid: File[] = [];
    let rejected = false;
    for (const f of files) {
      if (!ACCEPT.split(',').includes(f.type) || f.size > MAX_SIZE) {
        rejected = true;
        continue;
      }
      valid.push(f);
    }
    if (rejected) setError(REJECT_MSG);
    return valid;
  }, []);

  // ---- Upload ----
  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files ?? []);
    e.target.value = '';
    if (selected.length === 0) return;
    setError('');
    const valid = filterValid(selected);
    if (valid.length === 0) return;
    if (!isEdit) {
      onBufferChange?.([...(bufferFiles ?? []), ...valid]);
      return;
    }
    if (productId == null) return;
    setBusy(true);
    try {
      await useCase.add(productId, valid);
      await reload();
    } catch {
      setError('이미지 업로드에 실패했습니다.');
    } finally {
      setBusy(false);
    }
  };

  // ---- Replace (both modes) ----
  const triggerReplace = (item: GalleryItem, index: number) => {
    replaceTargetRef.current = { imageId: item.imageId, index };
    replaceRef.current?.click();
  };

  const handleReplaceFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    const target = replaceTargetRef.current;
    replaceTargetRef.current = null;
    if (!file || !target) return;
    setError('');
    const valid = filterValid([file]);
    if (valid.length === 0) return;
    if (!isEdit) {
      const next = [...(bufferFiles ?? [])];
      next[target.index] = valid[0];
      onBufferChange?.(next);
      return;
    }
    if (productId == null || target.imageId == null) return;
    setBusy(true);
    try {
      await useCase.replace(productId, target.imageId, valid[0]);
      await reload();
    } catch {
      setError('이미지 대체에 실패했습니다.');
    } finally {
      setBusy(false);
    }
  };

  // ---- Delete (edit → 409 guard; register → local splice) ----
  const handleDelete = async (item: GalleryItem, index: number) => {
    setError('');
    if (!isEdit) {
      onBufferChange?.((bufferFiles ?? []).filter((_, i) => i !== index));
      return;
    }
    if (productId == null || item.imageId == null) return;
    setBusy(true);
    try {
      await useCase.remove(productId, item.imageId);
      await reload();
    } catch (e: unknown) {
      if (axios.isAxiosError(e) && e.response?.status === 409) {
        setError(
          (e.response.data as { message?: string })?.message ??
            '다른 상품 리스팅에서 사용 중입니다. 마스터 풀 배치를 먼저 해제하세요.',
        );
      } else {
        setError('이미지 삭제에 실패했습니다.');
      }
    } finally {
      setBusy(false);
    }
  };

  // ---- Move (◀▶ adjacent swap; first = 대표) ----
  const handleMove = async (index: number, dir: -1 | 1) => {
    const target = index + dir;
    if (target < 0 || target >= items.length) return;
    setError('');
    if (!isEdit) {
      const next = [...(bufferFiles ?? [])];
      [next[index], next[target]] = [next[target], next[index]];
      onBufferChange?.(next);
      return;
    }
    if (productId == null) return;
    const ids = images.map((img) => img.id);
    [ids[index], ids[target]] = [ids[target], ids[index]];
    setBusy(true);
    try {
      await useCase.reorder(productId, ids);
      await reload();
    } catch {
      setError('순서 변경에 실패했습니다.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="border border-gray-200 rounded-lg p-6 bg-white">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">상품 이미지</h2>
        <div className="flex items-center gap-3">
          {busy && <Spinner size={18} />}
          {!isViewMode && (
            <label className="cursor-pointer rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
              이미지 업로드
              <input
                ref={uploadRef}
                type="file"
                accept={ACCEPT}
                multiple
                onChange={handleUpload}
                disabled={busy}
                hidden
              />
            </label>
          )}
        </div>
      </div>

      {error && (
        <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}

      {/* Shared hidden input for per-card [대체]. */}
      {!isViewMode && (
        <input
          ref={replaceRef}
          type="file"
          accept={ACCEPT}
          onChange={handleReplaceFile}
          hidden
        />
      )}

      {isEdit && isLoading ? (
        <div className="flex min-h-24 items-center justify-center">
          <Spinner size={20} label="이미지 불러오는 중..." />
        </div>
      ) : items.length === 0 ? (
        <div className="flex aspect-video w-full items-center justify-center rounded-lg border border-gray-300 bg-gray-100">
          <p className="text-gray-500">이미지 없음</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
          {items.map((item, index) => (
            <div key={item.key} className="rounded-lg border border-gray-200 p-2">
              <div className="relative mb-2 aspect-square overflow-hidden rounded bg-gray-100">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={item.url} alt="상품 이미지" className="h-full w-full object-contain" />
                {index === 0 && (
                  <span className="absolute left-1 top-1 rounded bg-blue-600 px-1.5 py-0.5 text-[10px] font-medium text-white">
                    대표
                  </span>
                )}
              </div>
              {!isViewMode && (
                <div className="space-y-1">
                  <div className="flex gap-1">
                    <button
                      type="button"
                      onClick={() => handleMove(index, -1)}
                      disabled={busy || index === 0}
                      aria-label="앞으로"
                      className="flex-1 rounded border border-gray-300 px-1 py-0.5 text-xs text-gray-600 hover:bg-gray-100 disabled:opacity-40"
                    >
                      ◀
                    </button>
                    <button
                      type="button"
                      onClick={() => handleMove(index, 1)}
                      disabled={busy || index === items.length - 1}
                      aria-label="뒤로"
                      className="flex-1 rounded border border-gray-300 px-1 py-0.5 text-xs text-gray-600 hover:bg-gray-100 disabled:opacity-40"
                    >
                      ▶
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => triggerReplace(item, index)}
                    disabled={busy}
                    className="w-full rounded border border-gray-300 px-1.5 py-0.5 text-[11px] text-gray-700 hover:bg-gray-100 disabled:opacity-50"
                  >
                    대체
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(item, index)}
                    disabled={busy}
                    className="w-full rounded border border-red-300 px-1.5 py-0.5 text-[11px] text-red-600 hover:bg-red-50 disabled:opacity-50"
                  >
                    삭제
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
