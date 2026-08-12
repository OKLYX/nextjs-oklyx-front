'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ROUTES } from '@/config/routes';
import { PageContainer } from '@/presentation/components/PageContainer';
import { Spinner } from '@/presentation/components/Spinner';
import { ThumbnailTemplateUseCase } from '@/application/usecases/ThumbnailTemplateUseCase';
import { ThumbnailTemplateRepositoryImpl } from '@/infrastructure/repositories/ThumbnailTemplateRepositoryImpl';
import type { BackgroundMode, TemplateElement, FontAsset } from '@/domain/entities/ThumbnailEntity';
import type { ThumbnailTemplateRequest } from '@/application/dto/ThumbnailDTOs';
import { TemplateCanvas } from './TemplateCanvas';
import { ElementPropertyPanel } from './ElementPropertyPanel';
import { PreviewPanel } from './PreviewPanel';

interface TemplateEditorProps {
  mode: 'new' | 'edit';
  id?: number;
}

const DISPLAY_MAX = 460; // largest canvas edge shown on screen (px)

function createElement(
  type: 'text' | 'image',
  canvasWidth: number,
  canvasHeight: number,
  defaultFontId: number | null
): TemplateElement {
  const w = Math.round(canvasWidth * 0.5);
  const h = Math.round(canvasHeight * 0.15);
  return {
    type,
    bind: type === 'text' ? 'productName' : 'productImage',
    src: null,
    region: {
      x: Math.round((canvasWidth - w) / 2),
      y: Math.round((canvasHeight - h) / 2),
      w,
      h,
    },
    align: { h: 'center', v: 'center' },
    // Text elements require a fontId (backend rejects null). Default to the first
    // available font so a freshly-added element renders without manual selection.
    fontId: type === 'text' ? defaultFontId : null,
    color: type === 'text' ? '#000000' : null,
    maxFontSize: 48,
    minFontSize: 16,
    maxLines: 2,
    lineSpacing: 1.0,
    opacity: 1,
  };
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
  const [elements, setElements] = useState<TemplateElement[]>([]);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  const [fonts, setFonts] = useState<FontAsset[]>([]);

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
        setElements(t.elements ?? []);
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
      elements,
      active: true, // active toggle removed from UI; templates are always active
      isDefault,
    }),
    [name, canvasWidth, canvasHeight, backgroundMode, gradientTopColor, gradientBottomColor, elements, isDefault]
  );

  const handleAddElement = (type: 'text' | 'image') => {
    setElements((prev) => [...prev, createElement(type, canvasWidth, canvasHeight, fonts[0]?.id ?? null)]);
    setSelectedIndex(elements.length);
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
    setElements((prev) => prev.filter((_, i) => i !== index));
    setSelectedIndex(null);
  };

  const handleUploadFont = async (file: File) => {
    const created = await useCase.uploadFont(file);
    setFonts((prev) => [...prev, created]);
    if (selectedIndex != null) handleElementPatch(selectedIndex, { fontId: created.id });
  };

  // Text elements without a font fail backend render (400 "fontId is required").
  // Returns a user-facing message for the first offending element, or null if valid.
  const missingFontError = useCallback((): string | null => {
    const idx = elements.findIndex((el) => el.type === 'text' && el.fontId == null);
    return idx === -1 ? null : `텍스트 요소 #${idx + 1}에 폰트를 선택하세요.`;
  }, [elements]);

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
    const fontError = missingFontError();
    if (fontError) {
      setError(fontError);
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
      </div>

      {/* Editor: left canvas, right panels */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[auto_1fr]">
        <div className="space-y-3">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => handleAddElement('text')}
              className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
            >
              + 텍스트
            </button>
            <button
              type="button"
              onClick={() => handleAddElement('image')}
              className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
            >
              + 이미지
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
            selectedIndex={selectedIndex}
            onSelect={setSelectedIndex}
            onRegionChange={handleRegionChange}
          />
          <p className="text-xs text-gray-500">
            박스를 드래그하면 위치, 모서리를 끌면 크기가 조정됩니다. 클릭하면 우측에서 속성을 편집합니다.
          </p>
        </div>

        <div className="space-y-6">
          {selected ? (
            <ElementPropertyPanel
              element={selected}
              fonts={fonts}
              onChange={(patch) => handleElementPatch(selectedIndex!, patch)}
              onUploadFont={handleUploadFont}
              onDelete={() => handleDeleteElement(selectedIndex!)}
            />
          ) : (
            <div className="rounded-lg border border-dashed border-gray-300 bg-white p-6 text-center text-sm text-gray-500">
              편집할 요소를 캔버스에서 선택하세요.
            </div>
          )}
          <PreviewPanel onPreview={handlePreview} validate={missingFontError} />
        </div>
      </div>
    </PageContainer>
  );
}
