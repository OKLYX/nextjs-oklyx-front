'use client';

import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react';
import { useRouter } from 'next/navigation';
import { ROUTES } from '@/config/routes';
import { PageContainer } from '@/presentation/components/PageContainer';
import { Spinner } from '@/presentation/components/Spinner';
import { resolveThumbUrl } from '@/infrastructure/utils/thumbUrl';
import { useAuthStore } from '@/infrastructure/stores/authStore';
import { ProcessingPresetUseCase } from '@/application/usecases/ProcessingPresetUseCase';
import { ProcessingPresetRepositoryImpl } from '@/infrastructure/repositories/ProcessingPresetRepositoryImpl';
import { ThumbnailTemplateUseCase } from '@/application/usecases/ThumbnailTemplateUseCase';
import { ThumbnailTemplateRepositoryImpl } from '@/infrastructure/repositories/ThumbnailTemplateRepositoryImpl';
import type { ImageOp, ImageOpAnchor } from '@/domain/entities/ProcessingPresetEntity';
import type { TemplateAsset } from '@/domain/entities/ThumbnailEntity';
import { AssetPickerModal } from '@/app/dashboard/thumbnail-templates/components/AssetPickerModal';

// 3×3 grid in reading order (row-major) so a `grid-cols-3` render matches the
// spatial position each anchor maps to on the base image.
const ANCHORS: { value: ImageOpAnchor; label: string; title: string }[] = [
  { value: 'TOP_LEFT', label: '↖', title: '좌상단' },
  { value: 'TOP_CENTER', label: '↑', title: '상단 중앙' },
  { value: 'TOP_RIGHT', label: '↗', title: '우상단' },
  { value: 'CENTER_LEFT', label: '←', title: '좌측 중앙' },
  { value: 'CENTER', label: '●', title: '가운데' },
  { value: 'CENTER_RIGHT', label: '→', title: '우측 중앙' },
  { value: 'BOTTOM_LEFT', label: '↙', title: '좌하단' },
  { value: 'BOTTOM_CENTER', label: '↓', title: '하단 중앙' },
  { value: 'BOTTOM_RIGHT', label: '↘', title: '우하단' },
];

// Approximate CSS placement of an overlay on the square preview box. scalePercent
// = overlay long side as a percent of the base short side (= preview width here),
// marginPercent = edge inset. The real result is baked at channel detail regen.
function overlayStyle(op: ImageOp): CSSProperties {
  const m = `${op.marginPercent}%`;
  const base: CSSProperties = {
    position: 'absolute',
    width: `${op.scalePercent}%`,
    height: 'auto',
    opacity: op.opacity,
  };
  switch (op.anchor) {
    case 'TOP_LEFT':
      return { ...base, top: m, left: m };
    case 'TOP_CENTER':
      return { ...base, top: m, left: '50%', transform: 'translateX(-50%)' };
    case 'TOP_RIGHT':
      return { ...base, top: m, right: m };
    case 'CENTER_LEFT':
      return { ...base, top: '50%', left: m, transform: 'translateY(-50%)' };
    case 'CENTER':
      return { ...base, top: '50%', left: '50%', transform: 'translate(-50%, -50%)' };
    case 'CENTER_RIGHT':
      return { ...base, top: '50%', right: m, transform: 'translateY(-50%)' };
    case 'BOTTOM_LEFT':
      return { ...base, bottom: m, left: m };
    case 'BOTTOM_CENTER':
      return { ...base, bottom: m, left: '50%', transform: 'translateX(-50%)' };
    case 'BOTTOM_RIGHT':
      return { ...base, bottom: m, right: m };
  }
}

// Bundled sample backgrounds (inline SVG data URIs — no network/asset dependency).
// Three tones so the user can gauge overlay contrast against light / dark / colorful
// bases, which is where a watermark most often becomes hard to read.
const svgDataUri = (svg: string) => `data:image/svg+xml,${encodeURIComponent(svg)}`;

const SAMPLE_IMAGES: { label: string; src: string }[] = [
  {
    label: '밝은 배경',
    src: svgDataUri(
      `<svg xmlns='http://www.w3.org/2000/svg' width='400' height='400'>` +
        `<defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'>` +
        `<stop offset='0' stop-color='#f8fafc'/><stop offset='1' stop-color='#cbd5e1'/></linearGradient></defs>` +
        `<rect width='400' height='400' fill='url(#g)'/></svg>`,
    ),
  },
  {
    label: '어두운 배경',
    src: svgDataUri(
      `<svg xmlns='http://www.w3.org/2000/svg' width='400' height='400'>` +
        `<defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'>` +
        `<stop offset='0' stop-color='#334155'/><stop offset='1' stop-color='#0f172a'/></linearGradient></defs>` +
        `<rect width='400' height='400' fill='url(#g)'/></svg>`,
    ),
  },
  {
    label: '컬러 배경',
    src: svgDataUri(
      `<svg xmlns='http://www.w3.org/2000/svg' width='400' height='400'>` +
        `<defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'>` +
        `<stop offset='0' stop-color='#ef4444'/><stop offset='0.5' stop-color='#f59e0b'/>` +
        `<stop offset='1' stop-color='#3b82f6'/></linearGradient></defs>` +
        `<rect width='400' height='400' fill='url(#g)'/></svg>`,
    ),
  },
];

interface ProcessingPresetEditorProps {
  presetId?: number;
}

export function ProcessingPresetEditor({ presetId }: ProcessingPresetEditorProps) {
  const router = useRouter();
  const isAdmin = useAuthStore((state) => state.user?.role === 'ADMIN');
  // Parent-owned usecases (never created inside modal/child).
  const useCase = useMemo(
    () => new ProcessingPresetUseCase(new ProcessingPresetRepositoryImpl()),
    [],
  );
  const assetUseCase = useMemo(
    () => new ThumbnailTemplateUseCase(new ThumbnailTemplateRepositoryImpl()),
    [],
  );

  const [name, setName] = useState('');
  const [ops, setOps] = useState<ImageOp[]>([]);
  const [isLoading, setIsLoading] = useState(!!presetId);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [nameError, setNameError] = useState('');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [sampleIdx, setSampleIdx] = useState(0); // preview base image toggle
  // storageKey → display name (ops store only the key; names come from the asset
  // library — merged on mount, on pick, and on picker changes[upload/rename/delete]).
  const [assetNames, setAssetNames] = useState<Record<string, string>>({});

  const mergeAssetNames = useCallback((assets: TemplateAsset[]) => {
    setAssetNames((prev) => {
      const next = { ...prev };
      for (const a of assets) next[a.storageKey] = a.name;
      return next;
    });
  }, []);

  // Fallback to the storageKey's basename when the name isn't known (secondary data).
  const assetLabel = (key: string) => assetNames[key] ?? key.split('/').pop() ?? key;

  useEffect(() => {
    if (!presetId || !isAdmin) return;
    let alive = true;
    (async () => {
      setIsLoading(true);
      setError('');
      try {
        const preset = await useCase.get(presetId);
        if (!alive) return;
        setName(preset.name);
        setOps(preset.operations ?? []);
      } catch {
        if (alive) setError('프리셋을 불러오지 못했습니다.');
      } finally {
        if (alive) setIsLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [presetId, isAdmin, useCase]);

  // Load asset display names once (secondary data — never blocks the editor).
  useEffect(() => {
    if (!isAdmin) return;
    let alive = true;
    (async () => {
      try {
        const assets = await assetUseCase.listAssets();
        if (alive) mergeAssetNames(assets);
      } catch {
        // names fall back to the storageKey basename
      }
    })();
    return () => {
      alive = false;
    };
  }, [isAdmin, assetUseCase, mergeAssetNames]);

  const patchOp = (index: number, patch: Partial<ImageOp>) => {
    setOps((prev) => prev.map((o, i) => (i === index ? { ...o, ...patch } : o)));
  };

  const moveOp = (index: number, dir: -1 | 1) => {
    const target = index + dir;
    setOps((prev) => {
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const deleteOp = (index: number) => {
    setOps((prev) => prev.filter((_, i) => i !== index));
  };

  const handlePickAsset = (asset: TemplateAsset) => {
    mergeAssetNames([asset]);
    setOps((prev) => [
      ...prev,
      {
        type: 'overlay',
        assetStorageKey: asset.storageKey,
        anchor: 'BOTTOM_RIGHT',
        opacity: 1,
        scalePercent: 20,
        marginPercent: 0,
      },
    ]);
    setPickerOpen(false);
  };

  const handleSave = async () => {
    if (!name.trim()) {
      setNameError('이름을 입력하세요');
      setError('이름을 입력하세요.');
      return;
    }
    setNameError('');
    setError('');
    setIsSaving(true);
    try {
      // active fixed true (thumbnail-template rule parity); op count 0 allowed = no compositing.
      const payload = { name: name.trim(), operations: ops, active: true };
      if (presetId) await useCase.update(presetId, payload);
      else await useCase.create(payload);
      router.push(ROUTES.PROCESSING_PRESETS);
    } catch {
      setError('저장에 실패했습니다.');
      setIsSaving(false);
    }
  };

  if (!isAdmin) {
    return (
      <PageContainer>
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          관리자만 접근할 수 있습니다.
        </p>
      </PageContainer>
    );
  }

  if (isLoading) {
    return (
      <PageContainer>
        <div className="flex min-h-64 items-center justify-center">
          <Spinner size={24} label="불러오는 중..." />
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer contentClassName="max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">
          {presetId ? '이미지 처리 프리셋 수정' : '이미지 처리 프리셋 생성'}
        </h1>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => router.push(ROUTES.PROCESSING_PRESETS)}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            취소
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {isSaving ? <Spinner label="저장 중..." /> : '저장'}
          </button>
        </div>
      </div>

      {error && <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}

      {/* Meta */}
      <div className="rounded-lg bg-white p-4 shadow">
        <label className="block">
          <span className="block text-xs font-medium text-gray-600">이름</span>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none"
            placeholder="프리셋 이름"
          />
          {nameError && <span className="mt-1 block text-xs text-red-600">{nameError}</span>}
        </label>
      </div>

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-2">
        {/* Op list */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white p-3">
            <button
              type="button"
              onClick={() => setPickerOpen(true)}
              className="rounded border border-gray-300 px-3 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
            >
              + 오버레이
            </button>
            <span className="text-xs text-gray-500">고정 이미지(워터마크·배지)를 순서대로 합성</span>
          </div>

          {ops.length === 0 ? (
            <div className="rounded-lg border border-dashed border-gray-300 bg-white p-8 text-center text-sm text-gray-500">
              오버레이가 없습니다. 위에서 추가하세요. (0개 = 합성 없음)
            </div>
          ) : (
            ops.map((op, index) => (
              <div key={index} className="space-y-3 rounded-lg border border-gray-200 bg-white p-3">
                <div className="flex items-center justify-between gap-2">
                  <p
                    className="truncate text-sm font-medium text-gray-800"
                    title={assetLabel(op.assetStorageKey)}
                  >
                    {assetLabel(op.assetStorageKey)}
                  </p>
                  <button
                    type="button"
                    onClick={() => deleteOp(index)}
                    className="shrink-0 rounded border border-red-300 px-3 py-1 text-xs font-medium text-red-600 hover:bg-red-50"
                  >
                    삭제
                  </button>
                </div>
                <div className="flex items-start gap-3">
                  <div className="shrink-0">
                    <span className="block text-xs font-medium text-gray-600">이미지</span>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={resolveThumbUrl(op.assetStorageKey)}
                      alt={assetLabel(op.assetStorageKey)}
                      className="mt-1 h-[92px] w-[92px] rounded border border-gray-200 object-contain"
                    />
                  </div>
                  <div className="flex-1">
                    <span className="block text-xs font-medium text-gray-600">앵커 (위치)</span>
                    <div className="mt-1 grid w-[92px] grid-cols-3 gap-1">
                      {ANCHORS.map((a) => (
                        <button
                          key={a.value}
                          type="button"
                          title={a.title}
                          onClick={() => patchOp(index, { anchor: a.value })}
                          className={`h-7 w-7 rounded border text-xs ${
                            op.anchor === a.value
                              ? 'border-blue-500 bg-blue-50 text-blue-700'
                              : 'border-gray-300 text-gray-600 hover:bg-gray-50'
                          }`}
                        >
                          {a.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-col gap-1">
                    <button
                      type="button"
                      onClick={() => moveOp(index, -1)}
                      disabled={index === 0}
                      className="h-6 w-6 rounded border border-gray-300 text-xs text-gray-700 hover:bg-gray-50 disabled:opacity-40"
                      aria-label="위로 이동"
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      onClick={() => moveOp(index, 1)}
                      disabled={index === ops.length - 1}
                      className="h-6 w-6 rounded border border-gray-300 text-xs text-gray-700 hover:bg-gray-50 disabled:opacity-40"
                      aria-label="아래로 이동"
                    >
                      ↓
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <label className="block">
                    <span className="block text-xs font-medium text-gray-600">
                      불투명도 {op.opacity.toFixed(2)}
                    </span>
                    <input
                      type="range"
                      min={0}
                      max={1}
                      step={0.05}
                      value={op.opacity}
                      onChange={(e) => patchOp(index, { opacity: Number(e.target.value) })}
                      className="mt-2 w-full"
                    />
                  </label>
                  <label className="block">
                    <span className="block text-xs font-medium text-gray-600">크기 %</span>
                    <input
                      type="number"
                      value={op.scalePercent}
                      onChange={(e) => patchOp(index, { scalePercent: Number(e.target.value) })}
                      className="mt-1 w-full rounded border border-gray-300 px-2 py-1 text-sm text-gray-900 focus:border-blue-500 focus:outline-none"
                    />
                  </label>
                  <label className="block">
                    <span className="block text-xs font-medium text-gray-600">여백 %</span>
                    <input
                      type="number"
                      value={op.marginPercent}
                      onChange={(e) => patchOp(index, { marginPercent: Number(e.target.value) })}
                      className="mt-1 w-full rounded border border-gray-300 px-2 py-1 text-sm text-gray-900 focus:border-blue-500 focus:outline-none"
                    />
                  </label>
                </div>

              </div>
            ))
          )}
        </div>

        {/* Approximate preview (CSS overlays over a switchable sample background) */}
        <div className="rounded-lg bg-white p-4 shadow">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-gray-700">미리보기</h2>
            <div className="flex gap-1">
              {SAMPLE_IMAGES.map((s, i) => (
                <button
                  key={s.label}
                  type="button"
                  onClick={() => setSampleIdx(i)}
                  className={`rounded border px-2 py-1 text-xs ${
                    sampleIdx === i
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-gray-300 text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
          <div className="relative mx-auto aspect-square w-full max-w-sm overflow-hidden rounded border border-gray-200 bg-gray-100">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={SAMPLE_IMAGES[sampleIdx].src}
              alt="샘플 배경"
              className="absolute inset-0 h-full w-full object-cover"
            />
            {ops.map((op, index) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={index}
                src={resolveThumbUrl(op.assetStorageKey)}
                alt="overlay preview"
                style={overlayStyle(op)}
              />
            ))}
          </div>
          <p className="mt-3 text-xs text-gray-400">
            배경을 바꿔 워터마크·배지의 대비를 확인하세요. 실제 결과는 채널 상세 재생성 시 확인합니다(배치 근사·특정 상품 미리보기 불가).
          </p>
        </div>
      </div>

      <AssetPickerModal
        isOpen={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onSelect={handlePickAsset}
        useCase={assetUseCase}
        onAssetsChange={mergeAssetNames}
      />
    </PageContainer>
  );
}
