'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
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
import type {
  ColorAdjustOp,
  ImageOp,
  ImageOpAnchor,
  OverlayOp,
} from '@/domain/entities/ProcessingPresetEntity';
import {
  applyColorAdjust,
  isNeutral,
  NEUTRAL_ADJUST,
  type ColorAdjust,
} from '@/infrastructure/utils/colorLut';
import type { TemplateAsset } from '@/domain/entities/ThumbnailEntity';
import { AssetPickerModal } from '@/app/dashboard/thumbnail-templates/components/AssetPickerModal';
import { Card } from '@/presentation/components/ui/Card';
import { Button } from '@/presentation/components/ui/Button';

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
function overlayStyle(op: OverlayOp): CSSProperties {
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

// Bundled sample backgrounds, painted straight onto the preview canvas (no image
// element → no canvas taint → getImageData stays available for the real color pass).
// Three tones so the user can gauge overlay contrast against light / dark / colorful
// bases, which is where a watermark most often becomes hard to read.
const PREVIEW_SIZE = 400;

const SAMPLE_GRADIENTS: { label: string; stops: [number, string][] }[] = [
  { label: '밝은 배경', stops: [[0, '#f8fafc'], [1, '#cbd5e1']] },
  { label: '어두운 배경', stops: [[0, '#334155'], [1, '#0f172a']] },
  { label: '컬러 배경', stops: [[0, '#ef4444'], [0.5, '#f59e0b'], [1, '#3b82f6']] },
];

// 색보정 슬라이더 4종. 라벨/힌트는 화면 문구, key 는 ColorAdjust 필드.
const ADJUST_CONTROLS: { key: keyof ColorAdjust; label: string; hint: string }[] = [
  { key: 'brightness', label: '밝기', hint: '어둡게 ↔ 밝게' },
  { key: 'contrast', label: '대비', hint: '약하게 ↔ 강하게' },
  { key: 'saturation', label: '채도', hint: '흑백 ↔ 선명하게' },
  { key: 'temperature', label: '색온도', hint: '차갑게(파랑) ↔ 따뜻하게(주황)' },
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
  // 오버레이 전용 리스트. 색보정은 순서와 무관하므로 리스트에 섞지 않는다(아래 adjust).
  const [ops, setOps] = useState<OverlayOp[]>([]);
  const [adjust, setAdjust] = useState<ColorAdjust>(NEUTRAL_ADJUST);
  const [isLoading, setIsLoading] = useState(!!presetId);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [nameError, setNameError] = useState('');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [sampleIdx, setSampleIdx] = useState(0); // preview base image toggle
  const canvasRef = useRef<HTMLCanvasElement>(null);
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
        const loaded = preset.operations ?? [];
        setOps(loaded.filter((o): o is OverlayOp => o.type === 'overlay'));
        // colorAdjust op 는 최대 1개(UI 가 1개만 만든다). 2개 이상이면 첫 번째만 —
        // 백엔드 엔진도 findFirst 라 미리보기와 실제 결과가 어긋나지 않는다.
        // ⚠️ `?? 0` 필수: 구 프리셋 JSON 에는 4필드가 없어 null 로 온다.
        const found = loaded.find((o): o is ColorAdjustOp => o.type === 'colorAdjust');
        setAdjust(
          found
            ? {
                brightness: found.brightness ?? 0,
                contrast: found.contrast ?? 0,
                saturation: found.saturation ?? 0,
                temperature: found.temperature ?? 0,
              }
            : NEUTRAL_ADJUST,
        );
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

  // 미리보기 = 실연산. 샘플 그라디언트를 매번 다시 칠한 뒤 보정한다(보정 위에 보정을
  // 누적하면 슬라이더를 되돌려도 색이 돌아오지 않는다). 백엔드와 같은 공식(colorLut.ts).
  useEffect(() => {
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    const grad = ctx.createLinearGradient(0, 0, PREVIEW_SIZE, PREVIEW_SIZE);
    for (const [offset, color] of SAMPLE_GRADIENTS[sampleIdx].stops) grad.addColorStop(offset, color);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, PREVIEW_SIZE, PREVIEW_SIZE);
    if (isNeutral(adjust)) return;
    const img = ctx.getImageData(0, 0, PREVIEW_SIZE, PREVIEW_SIZE);
    applyColorAdjust(img.data, adjust);
    ctx.putImageData(img, 0, 0);
  // ⚠️ isLoading 의존 필수: 로딩 중에는 canvas 가 렌더되지 않는다(스피너로 early return).
  // 로드 결과가 중립이면 adjust 참조가 그대로라 이 deps 없이는 effect 가 다시 돌지 않아
  // 빈 canvas 가 남는다.
  }, [sampleIdx, adjust, isLoading]);

  const patchOp = (index: number, patch: Partial<OverlayOp>) => {
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
      // 색보정은 맨 앞에 직렬화(백엔드는 순서 무관하지만 저장본을 읽을 때 "먼저 적용"이 보이게).
      // ⚠️ 중립이면 op 를 만들지 않는다(무연산 op 가 DB 에 쌓이지 않게).
      const operations: ImageOp[] = isNeutral(adjust)
        ? ops
        : [{ type: 'colorAdjust', ...adjust }, ...ops];
      // active fixed true (thumbnail-template rule parity); op count 0 allowed = no compositing.
      const payload = { name: name.trim(), operations, active: true };
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
    <PageContainer
      title={presetId ? '이미지 처리 프리셋 수정' : '이미지 처리 프리셋 생성'}
      action={
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
      }
    >
      {error && <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}

      {/* Meta */}
      <Card>
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
      </Card>

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-2">
        {/* Op list */}
        <div className="space-y-3">
          {/* 색보정 = 원본 전용. 순서와 무관하므로 리오더 가능한 op 행이 아니라 별도 카드. */}
          <Card
            title="색보정 (원본 이미지)"
            action={
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setAdjust(NEUTRAL_ADJUST)}
                disabled={isNeutral(adjust)}
              >
                초기화
              </Button>
            }
          >
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {ADJUST_CONTROLS.map((c) => (
                <label key={c.key} className="block">
                  <span className="block text-xs font-medium text-gray-600">
                    {c.label} {adjust[c.key]}
                  </span>
                  <input
                    type="range"
                    min={-100}
                    max={100}
                    step={1}
                    value={adjust[c.key]}
                    onChange={(e) =>
                      setAdjust((prev) => ({ ...prev, [c.key]: Number(e.target.value) }))
                    }
                    className="mt-2 w-full"
                  />
                  <span className="mt-1 block text-xs text-gray-400">{c.hint}</span>
                </label>
              ))}
            </div>
            <p className="mt-3 text-xs text-gray-500">
              워터마크·배지에는 적용되지 않습니다. 원본 이미지에만 적용됩니다.
            </p>
          </Card>

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
        <Card>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-gray-700">미리보기</h2>
            <div className="flex gap-1">
              {SAMPLE_GRADIENTS.map((s, i) => (
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
            <canvas
              ref={canvasRef}
              width={PREVIEW_SIZE}
              height={PREVIEW_SIZE}
              className="absolute inset-0 h-full w-full"
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
            색보정은 실제 결과와 동일한 연산입니다(샘플 배경 기준). 오버레이 배치는 여전히 근사이며, 최종 결과는 채널 상세 재생성 시 확인합니다.
          </p>
        </Card>
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
