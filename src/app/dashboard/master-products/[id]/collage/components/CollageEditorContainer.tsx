'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { PageContainer } from '@/presentation/components/PageContainer';
import { Card } from '@/presentation/components/ui/Card';
import { Button } from '@/presentation/components/ui/Button';
import { ConfirmDialog } from '@/presentation/components/ui/ConfirmDialog';
import { Spinner } from '@/presentation/components/Spinner';
import { ROUTES } from '@/config/routes';
import { extractErrorMessage } from '@/infrastructure/utils/errorMessage';
import { toast } from '@/infrastructure/stores/toastStore';
import { CollageUseCase } from '@/application/usecases/CollageUseCase';
import { CollageRepositoryImpl } from '@/infrastructure/repositories/CollageRepositoryImpl';
import type {
  CollageLayout,
  CollageShape,
  CollageStageKey,
  CollageStageResponse,
} from '@/domain/entities/CollageEntity';
import {
  MAX_ZOOM,
  cellPhotoUrl,
  collageSize,
  cellRects,
  initialLayout,
  minZoom,
  reshape,
  withCellPhoto,
} from '@/domain/collage/collageGeometry';
import { resolveThumbUrl } from '@/infrastructure/utils/thumbUrl';
import { CollageCanvas, type PhotoSize } from './CollageCanvas';
import { CollageShapePicker } from './CollageShapePicker';
import { sourceLabel, stageLabel, targetLabel } from './collageLabels';

interface CollageEditorContainerProps {
  id: string;
  stage?: string;
  sellerId?: string;
  listingId?: string;
}

const DISPLAY_MAX = 480;
const APPLY_HINT = '판매상품 썸네일은 판매상품 상세 「썸네일」 탭의 [저장 후 재생성]으로 바뀝니다.';

/** Stage address from the page query — anything other than SELLER / LISTING is the master default. */
function keyFromQuery(stage?: string, sellerId?: string, listingId?: string): CollageStageKey {
  if (stage === 'SELLER') return { stage: 'SELLER', sellerId: Number(sellerId) };
  if (stage === 'LISTING') return { stage: 'LISTING', listingId: Number(listingId) };
  return { stage: 'MASTER' };
}

/**
 * Thumbnail collage editor page (FEATURE_2610_21 D20 · D25~D34 · D40~D48 · D51).
 * File: src/app/dashboard/master-products/[id]/collage/components/CollageEditorContainer.tsx
 *
 * Entry points (D40): the master 「이미지」 tab block (every stage) and the listing 「썸네일」 tab (listing stage).
 * The stage comes from the query `stage=MASTER|SELLER|LISTING` (+ `sellerId` / `listingId`).
 *
 * | Stage state (`stage.source` · `ownLayout`) | Shown | Buttons |
 * |---|---|---|
 * | own row on (`OWN`, ownLayout set) | editor | [저장] [이 단계에서 콜라주 끄기] [따로 만든 것 지우기(위 단계를 따름)] |
 * | own row off (`OWN`, ownLayout null) | inherited collage dimmed | [이 단계에서 따로 만들기] [따로 만든 것 지우기(위 단계를 따름)] |
 * | no own row (`SELLER` · `MASTER` · `NONE`) | inherited collage dimmed | [이 단계에서 따로 만들기] [이 단계에서 콜라주 끄기] |
 * | editing a new own collage (not saved yet) | editor | [저장] [이 단계에서 콜라주 끄기] [취소] (+ [따로 만든 것 지우기(위 단계를 따름)] when the own row is off) |
 *
 * 「이 단계에서 따로 만들기」 starts from the inherited collage, or from the initial collage when there is none
 * (D32 · D41). Saving never regenerates a thumbnail (D20).
 */
export function CollageEditorContainer({ id, stage, sellerId, listingId }: CollageEditorContainerProps) {
  const router = useRouter();
  const masterId = Number(id);
  const key = useMemo(() => keyFromQuery(stage, sellerId, listingId), [stage, sellerId, listingId]);
  const useCase = useMemo(() => new CollageUseCase(new CollageRepositoryImpl()), []);

  const [data, setData] = useState<CollageStageResponse | null>(null);
  const [draft, setDraft] = useState<CollageLayout | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState<'save' | 'off' | 'delete' | 'preview' | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [targetIndex, setTargetIndex] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [photoSizes, setPhotoSizes] = useState<Record<string, PhotoSize>>({});
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      setIsLoading(true);
      setError('');
      try {
        const res = await useCase.getStage(masterId, key);
        if (!alive) return;
        setData(res);
        setDraft(res.ownLayout);
      } catch (e: unknown) {
        if (alive) setError(extractErrorMessage(e, '콜라주 정보를 불러오지 못했습니다.'));
      } finally {
        if (alive) setIsLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [useCase, masterId, key]);

  // Revoke the previous preview object URL when it is replaced and on unmount.
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const target = data?.previewTargets[targetIndex] ?? data?.previewTargets[0] ?? null;
  const shown = draft ?? data?.inheritedLayout ?? null;
  const size = target && shown ? collageSize(shown.useTemplate, target) : null;
  const scale = size && size.width > 0 && size.height > 0 ? Math.min(DISPLAY_MAX / size.width, DISPLAY_MAX / size.height) : 0;
  const displayW = size ? Math.round(size.width * scale) : 0;
  const displayH = size ? Math.round(size.height * scale) : 0;

  const reportPhotoSize = (url: string, s: PhotoSize) =>
    setPhotoSizes((prev) => (prev[url] ? prev : { ...prev, [url]: s }));

  const applyResponse = (res: CollageStageResponse) => {
    setData(res);
    setDraft(res.ownLayout);
    setSelected(null);
  };

  const handleSave = async () => {
    if (!draft) return;
    setBusy('save');
    try {
      applyResponse(await useCase.save(masterId, key, { enabled: true, layout: draft }));
      toast.success(`콜라주를 저장했습니다. ${APPLY_HINT}`);
    } catch (e: unknown) {
      toast.error(extractErrorMessage(e, '콜라주를 저장하지 못했습니다.'));
    } finally {
      setBusy(null);
    }
  };

  const handleOff = async () => {
    setBusy('off');
    try {
      applyResponse(await useCase.save(masterId, key, { enabled: false, layout: null }));
      toast.success(`이 단계에서 콜라주를 껐습니다. ${APPLY_HINT}`);
    } catch (e: unknown) {
      toast.error(extractErrorMessage(e, '콜라주를 끄지 못했습니다.'));
    } finally {
      setBusy(null);
    }
  };

  const handleDelete = async () => {
    setBusy('delete');
    try {
      applyResponse(await useCase.remove(masterId, key));
      setConfirmDelete(false);
      toast.success(`따로 만든 콜라주를 지웠습니다. ${APPLY_HINT}`);
    } catch (e: unknown) {
      toast.error(extractErrorMessage(e, '콜라주를 지우지 못했습니다.'));
    } finally {
      setBusy(null);
    }
  };

  const handlePreview = async () => {
    if (!draft || !target) return;
    setBusy('preview');
    try {
      const blob = await useCase.preview(masterId, { listingId: target.listingId, layout: draft });
      setPreviewUrl(URL.createObjectURL(blob));
    } catch (e: unknown) {
      toast.error(extractErrorMessage(e, '미리보기를 만들지 못했습니다.'));
    } finally {
      setBusy(null);
    }
  };

  const startOwn = () => {
    if (!data) return;
    setDraft(data.inheritedLayout ?? initialLayout(data.products.map((p) => p.productId)));
    setSelected(null);
  };

  const pickShape = (shape: CollageShape) => {
    if (draft) setDraft(reshape(draft, shape));
  };

  const selectedCell = draft && selected !== null ? draft.cells[selected] : null;
  const selectedRect = draft && selected !== null ? cellRects(draft, displayW, displayH)[selected] : null;
  const selectedProduct = selectedCell ? data?.products.find((p) => p.productId === selectedCell.productId) : undefined;
  const selectedUrl = selectedCell ? cellPhotoUrl(selectedCell, selectedProduct) : null;
  const selectedPhoto = selectedUrl ? photoSizes[selectedUrl] : undefined;
  // The highlighted photo of the strip: the chosen one while it is still in the gallery, otherwise the cover (D17).
  const selectedImageId =
    selectedCell?.productImageId != null &&
    selectedProduct?.images.some((i) => i.productImageId === selectedCell.productImageId)
      ? selectedCell.productImageId
      : null;
  const zoomMin =
    selectedRect && selectedPhoto ? minZoom(selectedRect.w, selectedRect.h, selectedPhoto.w, selectedPhoto.h) : 1;

  // FEATURE_2610_32 D18 · D20: choosing a photo for the selected cell resets its zoom/position.
  const pickPhoto = (productImageId: number | null) => {
    if (!draft || selected === null) return;
    setDraft(withCellPhoto(draft, selected, productImageId));
  };

  const setZoom = (zoom: number) => {
    if (!draft || selected === null) return;
    const cells = draft.cells.map((c, i) => (i === selected ? { ...c, zoom } : c));
    setDraft({ ...draft, cells });
  };

  const isOwn = data?.stage.source === 'OWN';
  const deleteMessage =
    key.stage === 'MASTER'
      ? '마스터 기본 콜라주를 지웁니다. 따로 만든 판매자·판매상품 콜라주가 없는 판매상품은 사진 한 장 썸네일이 됩니다.'
      : '이 단계에서 따로 만든 콜라주를 지웁니다. 이 단계는 위 단계 콜라주를 따릅니다.';

  return (
    <PageContainer title="썸네일 콜라주">
      <Card>
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <Button variant="secondary" size="sm" onClick={() => router.push(ROUTES.MASTER_PRODUCT_DETAIL(masterId))}>
            ← 마스터 상세
          </Button>
        </div>

        {error && <p className="mb-4 rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

        {isLoading ? (
          <div className="flex min-h-40 items-center justify-center">
            <Spinner size={24} label="불러오는 중..." />
          </div>
        ) : data ? (
          <div className="space-y-4">
            <div className="rounded border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-800">
              <p>
                편집 중인 단계: <span className="font-semibold">{stageLabel(data.stage)}</span>
              </p>
              <p>
                이 단계에 지금 쓰이는 콜라주: <span className="font-semibold">{sourceLabel(data.stage)}</span>
              </p>
            </div>

            {!data.bundle ? (
              <p className="text-sm text-gray-500">구성품이 2개 이상인 마스터만 콜라주를 만들 수 있습니다.</p>
            ) : draft ? (
              <div className="space-y-4">
                <CollageShapePicker
                  shapes={data.shapes}
                  count={draft.cells.length}
                  value={draft.shape}
                  disabled={busy !== null}
                  onPick={pickShape}
                />

                <div className="flex flex-wrap items-center gap-6 text-sm text-gray-700">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={draft.useTemplate}
                      onChange={(e) => setDraft({ ...draft, useTemplate: e.target.checked })}
                    />
                    썸네일 틀(글자·로고·배경) 함께 쓰기
                  </label>
                  <label className="flex items-center gap-2">
                    간격
                    <input
                      type="range"
                      min={0}
                      max={5}
                      step={0.5}
                      value={draft.gap * 100}
                      onChange={(e) => setDraft({ ...draft, gap: Number(e.target.value) / 100 })}
                    />
                    <span className="w-10 text-right">{(draft.gap * 100).toFixed(1)}%</span>
                  </label>
                  <label className="flex items-center gap-2">
                    간격 색
                    <input
                      type="color"
                      className="h-9 w-16 rounded border border-gray-300"
                      value={draft.gapColor}
                      onChange={(e) => setDraft({ ...draft, gapColor: e.target.value })}
                    />
                  </label>
                </div>

                <div className="flex flex-wrap items-start gap-6">
                  <div className="space-y-2">
                    {displayW > 0 && displayH > 0 ? (
                      <CollageCanvas
                        layout={draft}
                        products={data.products}
                        width={displayW}
                        height={displayH}
                        photoSizes={photoSizes}
                        onPhotoSize={reportPhotoSize}
                        selected={selected}
                        onSelect={setSelected}
                        onChange={setDraft}
                      />
                    ) : (
                      <p className="text-sm text-red-700">썸네일 틀 크기를 알 수 없습니다.</p>
                    )}
                    <p className="max-w-[480px] text-xs text-gray-500">
                      사진을 끌어 위치를 옮기고, 다른 칸에 놓으면 두 칸이 바뀝니다. 칸 사이 선을 끌면 칸 크기가
                      바뀝니다.
                    </p>
                    {selectedCell && (
                      <label className="flex items-center gap-2 text-sm text-gray-700">
                        확대 · {selectedProduct?.productName}
                        <input
                          type="range"
                          min={zoomMin}
                          max={MAX_ZOOM}
                          step={0.01}
                          disabled={!selectedPhoto}
                          value={Math.max(zoomMin, Math.min(MAX_ZOOM, selectedCell.zoom))}
                          onChange={(e) => setZoom(Number(e.target.value))}
                        />
                        <span className="w-12 text-right">{Math.round(selectedCell.zoom * 100)}%</span>
                      </label>
                    )}
                    {selectedCell && selectedProduct && (
                      <div className="max-w-[480px] space-y-1">
                        <p className="text-sm text-gray-700">사진 · {selectedProduct.productName}</p>
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => pickPhoto(null)}
                            disabled={busy !== null}
                            className={`flex h-16 w-16 items-center justify-center overflow-hidden rounded border-2 bg-gray-100 text-[11px] text-gray-600 ${
                              selectedImageId === null ? 'border-blue-500' : 'border-gray-200'
                            }`}
                          >
                            대표사진(기본)
                          </button>
                          {selectedProduct.images.map((img) => (
                            <button
                              key={img.productImageId}
                              type="button"
                              onClick={() => pickPhoto(img.productImageId)}
                              disabled={busy !== null}
                              className={`h-16 w-16 overflow-hidden rounded border-2 bg-gray-100 ${
                                selectedImageId === img.productImageId ? 'border-blue-500' : 'border-gray-200'
                              }`}
                            >
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img
                                src={resolveThumbUrl(img.imageUrl)}
                                alt={selectedProduct.productName}
                                className="h-full w-full object-contain"
                              />
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    {data.previewTargets.length > 1 && (
                      <select
                        className="rounded border border-gray-300 px-2 py-1 text-sm text-gray-900"
                        value={targetIndex}
                        onChange={(e) => setTargetIndex(Number(e.target.value))}
                      >
                        {data.previewTargets.map((t, i) => (
                          <option key={t.listingId ?? 'default'} value={i}>
                            {targetLabel(t)}
                          </option>
                        ))}
                      </select>
                    )}
                    {data.previewTargets.length === 1 && target && (
                      <p className="text-xs text-gray-500">미리보기 틀: {targetLabel(target)}</p>
                    )}
                    <Button
                      variant="secondary"
                      onClick={handlePreview}
                      isLoading={busy === 'preview'}
                      loadingText="그리는 중..."
                      disabled={busy !== null}
                    >
                      미리보기
                    </Button>
                    {previewUrl && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={previewUrl}
                        alt="콜라주 썸네일 미리보기"
                        className="h-72 w-72 rounded border border-gray-200 object-contain"
                      />
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 border-t border-gray-100 pt-3">
                  <Button onClick={handleSave} isLoading={busy === 'save'} loadingText="저장 중..." disabled={busy !== null}>
                    저장
                  </Button>
                  <Button variant="secondary" onClick={handleOff} isLoading={busy === 'off'} disabled={busy !== null}>
                    이 단계에서 콜라주 끄기
                  </Button>
                  {isOwn && (
                    <Button variant="secondary" onClick={() => setConfirmDelete(true)} disabled={busy !== null}>
                      따로 만든 것 지우기(위 단계를 따름)
                    </Button>
                  )}
                  {data.ownLayout === null && (
                    <Button variant="secondary" onClick={() => setDraft(null)} disabled={busy !== null}>
                      취소
                    </Button>
                  )}
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {data.inheritedLayout && displayW > 0 && displayH > 0 ? (
                  <div className="pointer-events-none opacity-50">
                    <CollageCanvas
                      layout={data.inheritedLayout}
                      products={data.products}
                      width={displayW}
                      height={displayH}
                      photoSizes={photoSizes}
                      onPhotoSize={reportPhotoSize}
                      readOnly
                    />
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">이 단계를 따르는 판매상품은 사진 한 장 썸네일입니다.</p>
                )}
                <div className="flex flex-wrap gap-2">
                  <Button onClick={startOwn} disabled={busy !== null}>
                    이 단계에서 따로 만들기
                  </Button>
                  {isOwn ? (
                    <Button variant="secondary" onClick={() => setConfirmDelete(true)} disabled={busy !== null}>
                      따로 만든 것 지우기(위 단계를 따름)
                    </Button>
                  ) : (
                    <Button variant="secondary" onClick={handleOff} isLoading={busy === 'off'} disabled={busy !== null}>
                      이 단계에서 콜라주 끄기
                    </Button>
                  )}
                </div>
              </div>
            )}
          </div>
        ) : (
          !error && <p className="text-sm text-gray-500">표시할 콜라주가 없습니다.</p>
        )}
      </Card>

      <ConfirmDialog
        isOpen={confirmDelete}
        title="따로 만든 콜라주 지우기"
        message={deleteMessage}
        confirmText="지우기"
        onConfirm={handleDelete}
        onCancel={() => setConfirmDelete(false)}
        isDangerous
        isLoading={busy === 'delete'}
      />
    </PageContainer>
  );
}
