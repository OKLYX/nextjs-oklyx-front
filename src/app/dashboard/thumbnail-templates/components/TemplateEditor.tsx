'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ROUTES } from '@/config/routes';
import { PageContainer } from '@/presentation/components/PageContainer';
import { Spinner } from '@/presentation/components/Spinner';
import { ThumbnailTemplateUseCase } from '@/application/usecases/ThumbnailTemplateUseCase';
import { ThumbnailTemplateRepositoryImpl } from '@/infrastructure/repositories/ThumbnailTemplateRepositoryImpl';
import type { BackgroundMode, TemplateElement, FontAsset, TemplateField, TemplateAsset } from '@/domain/entities/ThumbnailEntity';
import { BUILTIN_FIELD_KEYS } from '@/domain/entities/ThumbnailEntity';
import type { ThumbnailTemplateRequest } from '@/application/dto/ThumbnailDTOs';
import { TemplateCanvas } from './TemplateCanvas';
import { ElementPropertyPanel } from './ElementPropertyPanel';
import { PreviewPanel } from './PreviewPanel';
import { AssetPickerModal } from './AssetPickerModal';
import { LayerListPanel } from './LayerListPanel';

interface TemplateEditorProps {
  mode: 'new' | 'edit';
  id?: number;
}

const DISPLAY_MAX = 460; // largest canvas edge shown on screen (px)

// Reserved fields: always present, auto-filled from the product, not deletable.
const reservedFields = (): TemplateField[] => [
  { key: 'brandName', label: '브랜드명', defaultValue: '' },
  { key: 'productName', label: '상품명', defaultValue: '' },
];

const isReservedKey = (key: string): boolean => (BUILTIN_FIELD_KEYS as readonly string[]).includes(key);

function baseRegion(canvasWidth: number, canvasHeight: number) {
  const w = Math.round(canvasWidth * 0.5);
  const h = Math.round(canvasHeight * 0.15);
  return { x: Math.round((canvasWidth - w) / 2), y: Math.round((canvasHeight - h) / 2), w, h };
}

// Text element is created bound to a chosen field key; bind is fixed at creation.
function createTextElement(
  bind: string,
  canvasWidth: number,
  canvasHeight: number,
  fontId: number | null
): TemplateElement {
  return {
    type: 'text',
    bind,
    src: null,
    region: baseRegion(canvasWidth, canvasHeight),
    align: { h: 'center', v: 'center' },
    fontId,
    color: '#000000',
    maxFontSize: 48,
    minFontSize: 16,
    maxLines: 2,
    lineSpacing: 1.0,
    opacity: 1,
  };
}

// Product-image base layer: auto-included, always index 0 (bottom), full canvas,
// contain-fit at render. bind is read-only and it cannot be deleted/reordered.
function createProductImageElement(canvasWidth: number, canvasHeight: number): TemplateElement {
  return {
    type: 'image',
    bind: 'productImage',
    src: null,
    region: { x: 0, y: 0, w: canvasWidth, h: canvasHeight },
    align: { h: 'center', v: 'center' },
    fontId: null,
    color: null,
    maxFontSize: 48,
    minFontSize: 16,
    maxLines: 2,
    lineSpacing: 1.0,
    opacity: 1,
  };
}

// Fixed image element bound to a library asset (src = asset storageKey).
// Defaults to a centered 30% box.
function createFixedImageElement(
  storageKey: string,
  canvasWidth: number,
  canvasHeight: number
): TemplateElement {
  const w = Math.round(canvasWidth * 0.3);
  const h = Math.round(canvasHeight * 0.3);
  return {
    type: 'image',
    bind: null,
    src: storageKey,
    region: { x: Math.round((canvasWidth - w) / 2), y: Math.round((canvasHeight - h) / 2), w, h },
    align: { h: 'center', v: 'center' },
    fontId: null,
    color: null,
    maxFontSize: 48,
    minFontSize: 16,
    maxLines: 2,
    lineSpacing: 1.0,
    opacity: 1,
  };
}

const isProductBase = (el: TemplateElement): boolean => el.type === 'image' && el.bind === 'productImage';

// Enforce the invariant that the productImage base is exactly at index 0. If
// missing, prepend a full-canvas base (legacy templates). If present at index≠0,
// move the first one to index 0 (values preserved). Extra product-image elements
// beyond the first are left in place (matches backend firstProductImageElement).
function normalizeBaseLayer(
  els: TemplateElement[],
  canvasWidth: number,
  canvasHeight: number
): TemplateElement[] {
  const idx = els.findIndex(isProductBase);
  if (idx === -1) return [createProductImageElement(canvasWidth, canvasHeight), ...els];
  if (idx === 0) return els;
  const next = [...els];
  const [base] = next.splice(idx, 1);
  next.unshift(base);
  return next;
}

export function TemplateEditor({ mode, id }: TemplateEditorProps) {
  const router = useRouter();

  const useCase = useMemo(() => new ThumbnailTemplateUseCase(new ThumbnailTemplateRepositoryImpl()), []);

  const [name, setName] = useState('');
  const [canvasWidth, setCanvasWidth] = useState(1000);
  const [canvasHeight, setCanvasHeight] = useState(1000);
  const [backgroundMode, setBackgroundMode] = useState<BackgroundMode>('WHITE');
  const [gradientTopColor, setGradientTopColor] = useState('#ffffff');
  const [gradientBottomColor, setGradientBottomColor] = useState('#000000');
  const [isDefault, setIsDefault] = useState(false);
  const [fields, setFields] = useState<TemplateField[]>(reservedFields);
  const [addFieldKey, setAddFieldKey] = useState(''); // field selected in the "add text element" dropdown
  // New templates start with the product-image base at index 0 (always bottom).
  const [elements, setElements] = useState<TemplateElement[]>(() =>
    mode === 'new' ? [createProductImageElement(1000, 1000)] : []
  );
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [isAssetModalOpen, setIsAssetModalOpen] = useState(false);

  const [fonts, setFonts] = useState<FontAsset[]>([]);
  // storageKey → asset display name, so placed fixed-image elements (which only
  // store src) show a friendly name instead of the raw storage key.
  const [assetNames, setAssetNames] = useState<Record<string, string>>({});

  const [isLoading, setIsLoading] = useState(mode === 'edit');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  // Load fonts once.
  useEffect(() => {
    let active_ = true;
    (async () => {
      try {
        const fontList = await useCase.listFonts();
        if (!active_) return;
        setFonts(fontList);
      } catch {
        // Non-fatal: font dropdown just stays empty.
      }
    })();
    return () => {
      active_ = false;
    };
  }, [useCase]);

  const applyAssetNames = useCallback((assets: TemplateAsset[]) => {
    setAssetNames(Object.fromEntries(assets.map((a) => [a.storageKey, a.name])));
  }, []);

  // Load asset names once so already-placed fixed images resolve to their name.
  useEffect(() => {
    let active_ = true;
    (async () => {
      try {
        const assets = await useCase.listAssets();
        if (active_) applyAssetNames(assets);
      } catch {
        // Non-fatal: fixed images just fall back to showing their storage key.
      }
    })();
    return () => {
      active_ = false;
    };
  }, [useCase, applyAssetNames]);

  // Load existing template in edit mode.
  useEffect(() => {
    if (mode !== 'edit' || id == null) return;
    let active_ = true;
    (async () => {
      setIsLoading(true);
      setError('');
      try {
        const t = await useCase.getById(id);
        if (!active_) return;
        setName(t.name);
        setCanvasWidth(t.canvasWidth);
        setCanvasHeight(t.canvasHeight);
        setBackgroundMode(t.backgroundMode);
        setGradientTopColor(t.gradientTopColor ?? '#ffffff');
        setGradientBottomColor(t.gradientBottomColor ?? '#000000');
        setIsDefault(t.isDefault);
        // Legacy templates may have fields=null → restore the reserved pair.
        const loadedFields = t.fields?.length ? t.fields : reservedFields();
        setFields(loadedFields);
        // Legacy element bind correction: any text element whose bind is missing
        // from the loaded field keys (orphan) falls back to 'productName' (always
        // present) so the backend does not reject an unknown bind on save.
        const fieldKeys = new Set(loadedFields.map((f) => f.key));
        const corrected = (t.elements ?? []).map((el) =>
          el.type === 'text' && (!el.bind || !fieldKeys.has(el.bind)) ? { ...el, bind: 'productName' } : el
        );
        // Enforce the product-image base at index 0 (adds it for legacy templates).
        setElements(normalizeBaseLayer(corrected, t.canvasWidth, t.canvasHeight));
      } catch {
        if (active_) setError('템플릿을 불러오지 못했습니다.');
      } finally {
        if (active_) setIsLoading(false);
      }
    })();
    return () => {
      active_ = false;
    };
  }, [mode, id, useCase]);

  const scale = Math.min(DISPLAY_MAX / canvasWidth, DISPLAY_MAX / canvasHeight);

  const buildRequest = useCallback(
    (): ThumbnailTemplateRequest => ({
      name,
      canvasWidth,
      canvasHeight,
      backgroundMode,
      // Gradient colors only carry meaning in GRADIENT_MANUAL; send null otherwise.
      gradientTopColor: backgroundMode === 'GRADIENT_MANUAL' ? gradientTopColor : null,
      gradientBottomColor: backgroundMode === 'GRADIENT_MANUAL' ? gradientBottomColor : null,
      fields,
      elements,
      active: true, // active toggle removed from UI; templates are always active
      isDefault,
    }),
    [name, canvasWidth, canvasHeight, backgroundMode, gradientTopColor, gradientBottomColor, fields, elements, isDefault]
  );

  // --- Field management ---
  const handleFieldLabelChange = (key: string, label: string) =>
    setFields((prev) => prev.map((f) => (f.key === key ? { ...f, label } : f)));

  const handleFieldDefaultChange = (key: string, defaultValue: string) =>
    setFields((prev) => prev.map((f) => (f.key === key ? { ...f, defaultValue } : f)));

  const handleAddField = () => {
    setFields((prev) => {
      let key = `field_${Date.now()}`;
      let suffix = 1;
      // Guard against same-ms collisions (rapid clicks).
      while (prev.some((f) => f.key === key)) key = `field_${Date.now()}_${suffix++}`;
      return [...prev, { key, label: '새 필드', defaultValue: '' }];
    });
  };

  const handleDeleteField = (key: string) => {
    if (isReservedKey(key)) return;
    if (elements.some((e) => e.bind === key)) {
      alert('이 필드에 연결된 요소가 있어 삭제할 수 없습니다. 요소를 먼저 삭제하세요.');
      return;
    }
    setFields((prev) => prev.filter((f) => f.key !== key));
  };

  // --- Element add (text = pick a field, image = fixed) ---
  const handleAddTextElement = (key: string) => {
    if (!key) return;
    setElements((prev) => {
      setSelectedIndex(prev.length); // new element position
      return [...prev, createTextElement(key, canvasWidth, canvasHeight, fonts[0]?.id ?? null)];
    });
    setAddFieldKey('');
  };

  // Asset picked in the modal → add a fixed image element on top (end of array).
  const handleSelectAsset = (asset: TemplateAsset) => {
    setElements((prev) => {
      setSelectedIndex(prev.length);
      return [...prev, createFixedImageElement(asset.storageKey, canvasWidth, canvasHeight)];
    });
    setIsAssetModalOpen(false);
  };

  // Swap an overlay element with its neighbor. dir +1 = forward (toward top),
  // dir -1 = backward. The base (index 0) is excluded → swaps clamp to [1, len-1].
  const moveElement = (index: number, dir: 1 | -1) => {
    const target = index + dir;
    if (target < 1 || target > elements.length - 1) return;
    setElements((prev) => {
      const next = [...prev];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
    setSelectedIndex(target);
  };

  const handleElementPatch = (index: number, patch: Partial<TemplateElement>) => {
    setElements((prev) => prev.map((el, i) => (i === index ? { ...el, ...patch } : el)));
  };

  const handleRegionChange = (index: number, region: Partial<TemplateElement['region']>) => {
    setElements((prev) =>
      prev.map((el, i) => (i === index ? { ...el, region: { ...el.region, ...region } } : el))
    );
  };

  const handleDeleteElement = (index: number) => {
    if (isProductBase(elements[index])) return; // base cannot be deleted
    setElements((prev) => prev.filter((_, i) => i !== index));
    setSelectedIndex(null);
  };

  const handleUploadFont = async (file: File) => {
    const created = await useCase.uploadFont(file);
    setFonts((prev) => [...prev, created]);
    if (selectedIndex != null) handleElementPatch(selectedIndex, { fontId: created.id });
  };

  const handlePreview = async (sampleBindings: Record<string, string>): Promise<Blob> => {
    return useCase.preview({ template: buildRequest(), sampleBindings });
  };

  const handleSave = async () => {
    if (!name.trim()) {
      setError('템플릿 이름을 입력하세요.');
      return;
    }
    if (canvasWidth <= 0 || canvasHeight <= 0) {
      setError('캔버스 크기는 0보다 커야 합니다.');
      return;
    }
    // Custom fields require a default value (backend rejects blanks with 400).
    const missingDefault = fields.find((f) => !isReservedKey(f.key) && !f.defaultValue.trim());
    if (missingDefault) {
      setError(`커스텀 필드 '${missingDefault.label}'의 기본값을 입력하세요.`);
      return;
    }
    setIsSaving(true);
    setError('');
    try {
      if (mode === 'edit' && id != null) {
        await useCase.update(id, buildRequest());
      } else {
        await useCase.create(buildRequest());
      }
      router.push(ROUTES.THUMBNAIL_TEMPLATES);
    } catch {
      setError('저장에 실패했습니다.');
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <PageContainer>
        <div className="flex min-h-96 items-center justify-center">
          <Spinner size={24} label="불러오는 중..." />
        </div>
      </PageContainer>
    );
  }

  const selected = selectedIndex != null ? elements[selectedIndex] : null;
  const inputCls =
    'rounded border border-gray-300 px-2 py-1 text-sm text-gray-900 focus:border-blue-500 focus:outline-none';

  return (
    <PageContainer contentClassName="max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">
          {mode === 'edit' ? '썸네일 템플릿 수정' : '썸네일 템플릿 생성'}
        </h1>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => router.push(ROUTES.THUMBNAIL_TEMPLATES)}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
          >
            돌아가기
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
          >
            {isSaving ? <Spinner label="저장 중..." /> : '저장'}
          </button>
        </div>
      </div>

      {error && <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}

      {/* Template meta */}
      <div className="grid grid-cols-1 gap-4 rounded-lg border border-gray-200 bg-white p-4 md:grid-cols-6">
        <div className="md:col-span-2">
          <label className="mb-1 block text-xs font-medium text-gray-600">템플릿 이름</label>
          <input className={`${inputCls} w-full`} value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">canvas 너비</label>
          <input type="number" className={`${inputCls} w-full`} value={canvasWidth} onChange={(e) => setCanvasWidth(Number(e.target.value))} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">canvas 높이</label>
          <input type="number" className={`${inputCls} w-full`} value={canvasHeight} onChange={(e) => setCanvasHeight(Number(e.target.value))} />
        </div>
        <div className="flex items-end">
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" checked={isDefault} onChange={(e) => setIsDefault(e.target.checked)} />
            기본 템플릿
          </label>
        </div>
        <div className="md:col-span-6">
          <label className="mb-1 block text-xs font-medium text-gray-600">배경 (선택)</label>
          <div className="flex flex-wrap items-end gap-4">
            <select
              className={inputCls}
              value={backgroundMode}
              onChange={(e) => setBackgroundMode(e.target.value as BackgroundMode)}
            >
              <option value="WHITE">흰색</option>
              <option value="BLACK">검은색</option>
              <option value="GRAY">회색</option>
              <option value="GRADIENT_AUTO">자동 그라데이션</option>
              <option value="GRADIENT_MANUAL">수동 그라데이션</option>
            </select>
            {backgroundMode === 'GRADIENT_MANUAL' && (
              <>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600">상단 색</label>
                  <input
                    type="color"
                    className="h-9 w-16 rounded border border-gray-300"
                    value={gradientTopColor}
                    onChange={(e) => setGradientTopColor(e.target.value)}
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600">하단 색</label>
                  <input
                    type="color"
                    className="h-9 w-16 rounded border border-gray-300"
                    value={gradientBottomColor}
                    onChange={(e) => setGradientBottomColor(e.target.value)}
                  />
                </div>
              </>
            )}
          </div>
          {backgroundMode === 'GRADIENT_AUTO' && (
            <p className="mt-1 text-xs text-gray-500">
              자동 그라데이션은 실제 상품 이미지 색으로 합성됩니다 (미리보기는 회색).
            </p>
          )}
        </div>

        {/* Template input fields */}
        <div className="md:col-span-6">
          <div className="mb-2 flex items-center justify-between">
            <label className="block text-xs font-medium text-gray-600">입력 필드</label>
            <button
              type="button"
              onClick={handleAddField}
              className="rounded border border-gray-300 px-2 py-1 text-xs text-gray-700 hover:bg-gray-100"
            >
              + 필드 추가
            </button>
          </div>
          <div className="space-y-2">
            {fields.map((f) => {
              const reserved = isReservedKey(f.key);
              return (
                <div key={f.key} className="flex flex-wrap items-center gap-2">
                  {reserved ? (
                    <>
                      <span className={`${inputCls} w-40 bg-gray-50`}>{f.label}</span>
                      <span className="text-xs text-gray-500">자동채움 (상품값)</span>
                    </>
                  ) : (
                    <>
                      <input
                        className={`${inputCls} w-40`}
                        value={f.label}
                        placeholder="라벨"
                        onChange={(e) => handleFieldLabelChange(f.key, e.target.value)}
                      />
                      <input
                        className={`${inputCls} w-48`}
                        value={f.defaultValue}
                        placeholder="기본값 (필수)"
                        onChange={(e) => handleFieldDefaultChange(f.key, e.target.value)}
                      />
                      <button
                        type="button"
                        onClick={() => handleDeleteField(f.key)}
                        className="rounded border border-red-300 px-2 py-1 text-xs text-red-600 hover:bg-red-50"
                      >
                        삭제
                      </button>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Editor: left canvas, right panels */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[auto_1fr]">
        <div className="space-y-3">
          <div className="flex gap-2">
            <select
              className={inputCls}
              value={addFieldKey}
              onChange={(e) => setAddFieldKey(e.target.value)}
            >
              <option value="">텍스트 필드 선택</option>
              {fields.map((f) => (
                <option key={f.key} value={f.key}>
                  {f.label}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => handleAddTextElement(addFieldKey)}
              disabled={!addFieldKey}
              className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              추가
            </button>
            <button
              type="button"
              onClick={() => setIsAssetModalOpen(true)}
              className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
            >
              + 고정 이미지
            </button>
          </div>
          <TemplateCanvas
            elements={elements}
            canvasWidth={canvasWidth}
            canvasHeight={canvasHeight}
            scale={scale}
            backgroundMode={backgroundMode}
            gradientTopColor={gradientTopColor}
            gradientBottomColor={gradientBottomColor}
            assetNames={assetNames}
            selectedIndex={selectedIndex}
            onSelect={setSelectedIndex}
            onRegionChange={handleRegionChange}
          />
          <p className="text-xs text-gray-500">
            박스를 드래그하면 위치, 모서리를 끌면 크기가 조정됩니다. 클릭하면 우측에서 속성을 편집합니다.
          </p>
        </div>

        <div className="space-y-6">
          <LayerListPanel
            elements={elements}
            fields={fields}
            assetNames={assetNames}
            selectedIndex={selectedIndex}
            onSelect={setSelectedIndex}
            onMove={moveElement}
          />
          {selected ? (
            <ElementPropertyPanel
              element={selected}
              fields={fields}
              fonts={fonts}
              assetNames={assetNames}
              onChange={(patch) => handleElementPatch(selectedIndex!, patch)}
              onUploadFont={handleUploadFont}
              onDelete={() => handleDeleteElement(selectedIndex!)}
            />
          ) : (
            <div className="rounded-lg border border-dashed border-gray-300 bg-white p-6 text-center text-sm text-gray-500">
              편집할 요소를 캔버스에서 선택하세요.
            </div>
          )}
          <PreviewPanel
            fields={fields}
            onPreview={handlePreview}
            displayWidth={canvasWidth * scale}
            displayHeight={canvasHeight * scale}
          />
        </div>
      </div>

      <AssetPickerModal
        isOpen={isAssetModalOpen}
        onClose={() => setIsAssetModalOpen(false)}
        onSelect={handleSelectAsset}
        useCase={useCase}
        onAssetsChange={applyAssetNames}
      />
    </PageContainer>
  );
}
