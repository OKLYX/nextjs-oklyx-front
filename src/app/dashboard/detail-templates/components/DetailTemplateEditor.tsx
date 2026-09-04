'use client';

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { ROUTES } from '@/config/routes';
import { PageContainer } from '@/presentation/components/PageContainer';
import { Spinner } from '@/presentation/components/Spinner';
import { resolveThumbUrl } from '@/infrastructure/utils/thumbUrl';
import { useAuthStore } from '@/infrastructure/stores/authStore';
import { DetailContentUseCase } from '@/application/usecases/DetailContentUseCase';
import { DetailContentRepositoryImpl } from '@/infrastructure/repositories/DetailContentRepositoryImpl';
import { ProcessingPresetUseCase } from '@/application/usecases/ProcessingPresetUseCase';
import { ProcessingPresetRepositoryImpl } from '@/infrastructure/repositories/ProcessingPresetRepositoryImpl';
import { FontUseCase } from '@/application/usecases/FontUseCase';
import { FontRepositoryImpl } from '@/infrastructure/repositories/FontRepositoryImpl';
import { DetailImageGroupUseCase } from '@/application/usecases/DetailImageGroupUseCase';
import { DetailImageGroupRepositoryImpl } from '@/infrastructure/repositories/DetailImageGroupRepositoryImpl';
import type { DetailBlock } from '@/domain/entities/DetailTemplateEntity';
import type { ProcessingPreset } from '@/domain/entities/ProcessingPresetEntity';
import type { FontAsset } from '@/domain/entities/FontEntity';
import type { DetailImageGroup } from '@/domain/entities/DetailImageGroupEntity';
import { BUILTIN_FIELD_KEYS } from '@/domain/entities/ThumbnailEntity';
import { BlockRow } from './BlockRow';

type AppendableType = 'text' | 'spacer' | 'imageZone';

// Reserved keys are dev-facing; show their Korean label in the preview, never the raw key.
const BUILTIN_FIELD_LABELS: Record<string, string> = {
  brandName: '브랜드명',
  productName: '상품명',
};

// Initial block objects per type (SSOT = prompt 18 / backend 17). src=null keeps
// the DetailBlock shape complete for text/spacer/imageZone.
function createBlock(type: AppendableType): DetailBlock {
  switch (type) {
    case 'text':
      return { type, bind: '', src: null, defaultValue: '', align: 'left', widthPercent: 100, heightPx: null };
    case 'spacer':
      return { type, bind: null, src: null, defaultValue: null, align: null, widthPercent: null, heightPx: 24 };
    case 'imageZone':
      // processingPresetId=null → 템플릿 상단 프리셋을 상속 (FEATURE_2608_08/04).
      return {
        type,
        bind: '',
        src: null,
        defaultValue: null,
        align: 'center',
        widthPercent: 100,
        heightPx: null,
        processingPresetId: null,
      };
  }
}

interface DetailTemplateEditorProps {
  templateId?: number;
}

export function DetailTemplateEditor({ templateId }: DetailTemplateEditorProps) {
  const router = useRouter();
  const isAdmin = useAuthStore((state) => state.user?.role === 'ADMIN');
  const useCase = useMemo(() => new DetailContentUseCase(new DetailContentRepositoryImpl()), []);
  const presetUseCase = useMemo(
    () => new ProcessingPresetUseCase(new ProcessingPresetRepositoryImpl()),
    [],
  );
  const fontUseCase = useMemo(() => new FontUseCase(new FontRepositoryImpl()), []);
  const groupUseCase = useMemo(
    () => new DetailImageGroupUseCase(new DetailImageGroupRepositoryImpl()),
    [],
  );

  const [name, setName] = useState('');
  const [isDefault, setIsDefault] = useState(false);
  // Image-processing preset dropdown (secondary data — never blocks the CRUD).
  const [presets, setPresets] = useState<ProcessingPreset[]>([]);
  const [presetsLoading, setPresetsLoading] = useState(true);
  const [presetId, setPresetId] = useState(''); // '' = 미지정 (없음)
  // Once a preset is assigned, v1 has no clear path (backend keeps null/absent).
  // Lock the "없음" option so users can't try to revert (교체 only).
  const [presetLocked, setPresetLocked] = useState(false);
  // Tenant font library for the text-block font select (secondary data, same as presets).
  const [fonts, setFonts] = useState<FontAsset[]>([]);
  const [fontsLoading, setFontsLoading] = useState(true);
  const [isUploadingFont, setIsUploadingFont] = useState(false);
  const [fontsError, setFontsError] = useState(''); // inline notice only — never blocks the editor
  const fontInputRef = useRef<HTMLInputElement>(null);
  // Detail image zone catalog (FEATURE_2609_03): imageZone blocks bind to a catalog code.
  // ⚠️ An empty catalog is a valid state (create one); only a LOAD FAILURE blocks saving.
  const [groups, setGroups] = useState<DetailImageGroup[]>([]);
  const [groupsLoadFailed, setGroupsLoadFailed] = useState(false);
  const [blocks, setBlocks] = useState<DetailBlock[]>([]);
  const [isLoading, setIsLoading] = useState(!!templateId);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [nameError, setNameError] = useState('');
  const [blockErrors, setBlockErrors] = useState<Record<number, string>>({});
  // Preview-only sample text per block (not saved). null = untouched (shows the block's
  // default: defaultValue or the bind label); a string is the user's override. Kept
  // parallel to `blocks` (synced on append/move/delete).
  const [previewTexts, setPreviewTexts] = useState<(string | null)[]>([]);

  const setPreviewTextAt = (index: number, value: string | null) => {
    setPreviewTexts((prev) => {
      const next = prev.length === blocks.length ? [...prev] : blocks.map((_, i) => prev[i] ?? null);
      next[index] = value;
      return next;
    });
  };

  // Only the block picked in the structure preview is shown in the edit panel. null = none.
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  useEffect(() => {
    if (!templateId || !isAdmin) return;
    let alive = true;
    (async () => {
      setIsLoading(true);
      setError('');
      try {
        const tpl = await useCase.getTemplate(templateId);
        if (!alive) return;
        setName(tpl.name);
        setIsDefault(tpl.isDefault);
        setBlocks(tpl.blocks ?? []);
        const hasPreset = tpl.imageProcessingPresetId != null;
        setPresetId(hasPreset ? String(tpl.imageProcessingPresetId) : '');
        setPresetLocked(hasPreset);
      } catch {
        if (alive) setError('템플릿을 불러오지 못했습니다.');
      } finally {
        if (alive) setIsLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [templateId, isAdmin, useCase]);

  // Preset list is secondary data: failure falls back to [] and never blocks the CRUD.
  useEffect(() => {
    if (!isAdmin) return;
    let alive = true;
    (async () => {
      setPresetsLoading(true);
      try {
        const list = await presetUseCase.list();
        if (alive) setPresets(list);
      } catch {
        if (alive) setPresets([]);
      } finally {
        if (alive) setPresetsLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [isAdmin, presetUseCase]);

  // Font list is secondary data: failure falls back to [] and never blocks the CRUD.
  useEffect(() => {
    if (!isAdmin) return;
    let alive = true;
    (async () => {
      setFontsLoading(true);
      try {
        const list = await fontUseCase.list();
        if (alive) setFonts(list);
      } catch (e) {
        console.error(e);
        // Secondary data: keep [] and surface one inline line — never block the editor.
        if (alive) setFontsError('폰트 목록을 불러오지 못했습니다. 폰트 지정 없이 저장할 수 있습니다.');
      } finally {
        if (alive) setFontsLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [isAdmin, fontUseCase]);

  // Image group catalog. Unlike presets/fonts this one DOES gate saving on failure: an imageZone
  // block cannot be validated without it, and blocking at submit time would throw away the edit.
  useEffect(() => {
    if (!isAdmin) return;
    let alive = true;
    (async () => {
      try {
        const list = await groupUseCase.list();
        if (alive) {
          setGroups(list);
          setGroupsLoadFailed(false);
        }
      } catch {
        if (alive) setGroupsLoadFailed(true);
      }
    })();
    return () => {
      alive = false;
    };
  }, [isAdmin, groupUseCase]);

  // Inline "+ 새 그룹 만들기" from a block row: create, then merge into the local catalog so the
  // select shows it right away (the caller sets the returned code as the block's bind).
  const handleCreateGroup = async (name: string): Promise<DetailImageGroup> => {
    const created = await groupUseCase.create(name);
    setGroups((prev) => [...prev, created].sort((a, b) => a.sortOrder - b.sortOrder));
    return created;
  };

  // Register uploaded fonts so the local preview matches the rendered detail page.
  // Non-fatal: the fallback stack still shows. ⚠️ But a load failure here is a SIGNAL, not noise —
  // the buyer-facing @font-face uses the same URL, so it fails the same way. Most likely cause is a
  // missing S3 bucket CORS rule; check that before assuming the local profile's disk-path
  // storageKey is to blame.
  useEffect(() => {
    fonts.forEach((f) => {
      if (!f.webUrl) return;
      try {
        const face = new FontFace(`oclyx-font-${f.id}`, `url(${f.webUrl})`);
        face
          .load()
          .then((loaded) => document.fonts.add(loaded))
          .catch(() => console.warn(`[detail-font] ${f.displayName} 로드 실패 — S3 CORS 설정을 확인하세요`));
      } catch {
        /* ignore */
      }
    });
  }, [fonts]);

  const handleFontFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const ext = file.name.toLowerCase().slice(file.name.lastIndexOf('.'));
    if (ext !== '.ttf' && ext !== '.otf') {
      alert('폰트는 .ttf 또는 .otf 파일만 업로드할 수 있습니다.');
      e.target.value = '';
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      alert('폰트 파일은 5MB 이하만 업로드할 수 있습니다.');
      e.target.value = '';
      return;
    }
    setIsUploadingFont(true);
    try {
      const uploaded = await fontUseCase.upload(file);
      setFonts((prev) => [...prev, uploaded]); // no refetch: the response is the new item
      setFontsError('');
    } catch {
      setFontsError('폰트 업로드에 실패했습니다.');
    } finally {
      setIsUploadingFont(false);
      e.target.value = '';
    }
  };

  const patchBlock = (index: number, patch: Partial<DetailBlock>) => {
    setBlocks((prev) => prev.map((b, i) => (i === index ? { ...b, ...patch } : b)));
  };

  const moveBlock = (index: number, dir: -1 | 1) => {
    const target = index + dir;
    setBlocks((prev) => {
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
    setPreviewTexts((prev) => {
      if (target < 0 || target >= blocks.length) return prev;
      const next = blocks.map((_, i) => prev[i] ?? null);
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
    setSelectedIndex((sel) => {
      if (target < 0 || target >= blocks.length) return sel;
      if (sel === index) return target;
      if (sel === target) return index;
      return sel;
    });
  };

  const deleteBlock = (index: number) => {
    setBlocks((prev) => prev.filter((_, i) => i !== index));
    setPreviewTexts((prev) => blocks.map((_, i) => prev[i] ?? null).filter((_, i) => i !== index));
    setSelectedIndex((sel) => (sel == null ? null : sel === index ? null : sel > index ? sel - 1 : sel));
  };

  const appendBlock = (type: AppendableType) => {
    setBlocks((prev) => [...prev, createBlock(type)]);
    setPreviewTexts((prev) => [...blocks.map((_, i) => prev[i] ?? null), null]);
    setSelectedIndex(blocks.length); // new block = last index; select it for editing
  };

  // Local validation mirroring backend 17 rules. Returns per-index errors.
  const validate = (): { nameErr: string; errs: Record<number, string> } => {
    const errs: Record<number, string> = {};
    const isBuiltin = (key: string | null) =>
      (BUILTIN_FIELD_KEYS as readonly string[]).includes(key ?? '');
    blocks.forEach((b, i) => {
      if (b.type === 'text') {
        if (!b.bind?.trim()) errs[i] = '필드키를 선택하세요';
        else if (!isBuiltin(b.bind) && !b.defaultValue?.trim())
          errs[i] = '커스텀 필드는 기본값이 필수입니다';
      } else if (b.type === 'imageZone' && !b.bind?.trim()) errs[i] = '이미지 그룹을 선택하세요';
      else if (b.type === 'imageZone' && !groups.some((g) => g.code === b.bind))
        errs[i] = '이미지 그룹을 선택하세요';
      else if (b.type === 'asset' && !b.src?.trim()) errs[i] = '고정 이미지(src)가 없습니다';
      else if (b.type === 'spacer' && (!b.heightPx || b.heightPx < 1)) errs[i] = '여백 높이는 1 이상이어야 합니다';
    });
    return { nameErr: name.trim() ? '' : '이름을 입력하세요', errs };
  };

  const handleSave = async () => {
    const { nameErr, errs } = validate();
    setNameError(nameErr);
    setBlockErrors(errs);
    const violations = (nameErr ? 1 : 0) + Object.keys(errs).length;
    if (violations > 0) {
      setError(`${violations}개 항목 확인이 필요합니다.`);
      const firstErr = Object.keys(errs)
        .map(Number)
        .sort((a, b) => a - b)[0];
      if (firstErr != null) setSelectedIndex(firstErr); // reveal the first offending block
      return;
    }
    setError('');
    setIsSaving(true);
    try {
      // Empty preset value = omit the field (backend keeps existing; no clear in v1).
      const payload = {
        name: name.trim(),
        blocks,
        active: true,
        isDefault,
        ...(presetId ? { imageProcessingPresetId: Number(presetId) } : {}),
      };
      if (templateId) await useCase.updateTemplate(templateId, payload);
      else await useCase.createTemplate(payload);
      router.push(ROUTES.DETAIL_TEMPLATES);
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
          {templateId ? '상세 템플릿 수정' : '상세 템플릿 생성'}
        </h1>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => router.push(ROUTES.DETAIL_TEMPLATES)}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            취소
          </button>
          {groupsLoadFailed && (
            <span className="text-xs text-red-600">이미지 그룹 목록을 불러오지 못해 저장할 수 없습니다</span>
          )}
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving || groupsLoadFailed}
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
            placeholder="템플릿 이름"
          />
          {nameError && <span className="mt-1 block text-xs text-red-600">{nameError}</span>}
        </label>
        <label className="mt-3 flex items-center gap-2">
          <input
            type="checkbox"
            checked={isDefault}
            onChange={(e) => setIsDefault(e.target.checked)}
            className="h-4 w-4"
          />
          <span className="text-sm text-gray-700">기본 템플릿으로 지정</span>
        </label>

        <label className="mt-3 block">
          <span className="block text-xs font-medium text-gray-600">이미지 처리 프리셋</span>
          <select
            value={presetId}
            onChange={(e) => setPresetId(e.target.value)}
            disabled={presetsLoading}
            className="mt-1 w-full rounded border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-blue-500 focus:outline-none disabled:opacity-50"
          >
            <option value="" disabled={presetLocked}>
              없음 (합성 안 함)
            </option>
            {presets.map((p) => (
              <option key={p.id} value={String(p.id)}>
                {p.name}
              </option>
            ))}
          </select>
          <span className="mt-1 block text-xs text-gray-400">
            {presetId
              ? '해제는 추후 지원, 다른 프리셋으로 교체만 가능합니다.'
              : '합성 안 함 (상세 이미지에 워터마크·배지 미적용).'}
          </span>
        </label>

        <label className="mt-3 block">
          <span className="block text-xs font-medium text-gray-600">폰트</span>
          <button
            type="button"
            onClick={() => fontInputRef.current?.click()}
            disabled={isUploadingFont}
            className="mt-1 rounded border border-gray-300 px-3 py-1 text-xs text-gray-700 hover:bg-gray-100 disabled:opacity-50"
          >
            {isUploadingFont ? '업로드 중...' : '폰트 업로드 (.ttf/.otf)'}
          </button>
          <input ref={fontInputRef} type="file" accept=".ttf,.otf" onChange={handleFontFile} hidden />
          <span className="mt-1 block text-xs text-gray-400">
            업로드한 폰트는 상세 HTML에 폰트 파일 링크로 포함됩니다. 마켓이 이를 제거하면 구매자
            화면에는 기본 폰트로 표시될 수 있습니다.
          </span>
          {fontsError && <span className="mt-1 block text-xs text-red-600">{fontsError}</span>}
        </label>
      </div>

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-2">
        {/* Block list */}
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2 rounded-lg border border-gray-200 bg-white p-3">
            <span className="self-center text-xs font-medium text-gray-500">블록 추가:</span>
            <button
              type="button"
              onClick={() => appendBlock('text')}
              className="rounded border border-gray-300 px-3 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
            >
              + 텍스트
            </button>
            <button
              type="button"
              onClick={() => appendBlock('spacer')}
              className="rounded border border-gray-300 px-3 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
            >
              + 여백
            </button>
            <button
              type="button"
              onClick={() => appendBlock('imageZone')}
              className="rounded border border-gray-300 px-3 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
            >
              + 이미지
            </button>
          </div>

          {blocks.length === 0 ? (
            <div className="rounded-lg border border-dashed border-gray-300 bg-white p-8 text-center text-sm text-gray-500">
              블록이 없습니다. 위에서 추가하세요.
            </div>
          ) : selectedIndex == null || selectedIndex >= blocks.length ? (
            <div className="rounded-lg border border-dashed border-gray-300 bg-white p-8 text-center text-sm text-gray-500">
              구조 미리보기에서 블록을 선택하면 여기서 편집합니다.
            </div>
          ) : (
            <BlockRow
              key={selectedIndex}
              block={blocks[selectedIndex]}
              index={selectedIndex}
              error={blockErrors[selectedIndex]}
              fonts={fonts}
              fontsLoading={fontsLoading}
              presets={presets}
              presetsLoading={presetsLoading}
              groups={groups}
              groupsLoadFailed={groupsLoadFailed}
              onCreateGroup={handleCreateGroup}
              previewText={previewTexts[selectedIndex] ?? null}
              onPreviewTextChange={(v) => setPreviewTextAt(selectedIndex, v)}
              onChange={(patch) => patchBlock(selectedIndex, patch)}
              onDelete={() => deleteBlock(selectedIndex)}
            />
          )}
        </div>

        {/* Structure preview (derived from edit state, no fetch) */}
        <div className="rounded-lg bg-white p-4 shadow">
          <h2 className="mb-3 text-sm font-semibold text-gray-700">구조 미리보기</h2>
          <div className="space-y-2">
            {blocks.length === 0 && <p className="text-sm text-gray-400">블록 없음</p>}
            {blocks.map((block, index) => {
              let content: ReactNode;
              if (block.type === 'spacer') {
                content = (
                  <div className="rounded border border-gray-200 px-3 py-2">
                    <div
                      className="flex items-center justify-center rounded text-xs text-gray-500"
                      style={{ height: block.heightPx ?? 24 }}
                    >
                      여백 {block.heightPx ?? 24}px
                    </div>
                  </div>
                );
              } else if (block.type === 'imageZone') {
                content = (
                  <div className="rounded border border-dashed border-gray-300 p-4 text-center text-xs text-gray-500">
                    이미지: {block.bind || '(미지정)'}
                  </div>
                );
              } else if (block.type === 'asset') {
                content = (
                  <div className="flex justify-center">
                    {block.src ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={resolveThumbUrl(block.src)}
                        alt="asset"
                        className="max-h-32 rounded border border-gray-200 object-contain"
                      />
                    ) : (
                      <span className="text-xs text-gray-400">고정 이미지 (없음)</span>
                    )}
                  </div>
                );
              } else {
                // s = textStyle overrides; approximate preview (backend render is SSOT).
                const s = block.textStyle ?? {};
                const bindLabel = block.bind ? (BUILTIN_FIELD_LABELS[block.bind] ?? block.bind) : null;
                // Preview override (if the user typed one) else the block's default text.
                const previewText = previewTexts[index] ?? (block.defaultValue || bindLabel || '');
                content = (
                  <div
                    className="rounded border border-gray-200 px-3 py-2 text-sm text-gray-800"
                    style={{
                      whiteSpace: 'pre-wrap',
                      // line-height = 1 so the text box height equals the font size, matching a
                      // spacer whose inner bar height equals its heightPx (both + same chrome).
                      lineHeight: 1,
                      textAlign: (block.align as 'left' | 'center' | 'right') ?? 'left',
                      // Mirrors backend DetailFontResolver: @font-face family first, then the stack.
                      fontFamily: (() => {
                        const f = fonts.find((x) => String(x.id) === s.fontFamily);
                        if (!f) return undefined;
                        return f.webUrl
                          ? `'oclyx-font-${f.id}',${f.webStack ?? 'sans-serif'}`
                          : (f.webStack ?? undefined);
                      })(),
                      fontSize: s.fontSize ? `${s.fontSize}px` : undefined,
                      color: s.color || undefined,
                      fontWeight: s.bold === 'true' ? 700 : undefined,
                      fontStyle: s.italic === 'true' ? 'italic' : undefined,
                    }}
                  >
                    {previewText || '텍스트를 입력해 주세요'}
                  </div>
                );
              }
              return (
                <div
                  key={index}
                  role="button"
                  tabIndex={0}
                  onClick={() => setSelectedIndex(index)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setSelectedIndex(index);
                    }
                  }}
                  className={`relative cursor-pointer rounded ${
                    selectedIndex === index ? 'ring-2 ring-blue-400' : ''
                  }`}
                >
                  {content}
                  <div className="absolute right-1 top-1 flex gap-1">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        moveBlock(index, -1);
                      }}
                      disabled={index === 0}
                      className="h-6 w-6 rounded border border-gray-300 bg-white text-xs text-gray-700 hover:bg-gray-50 disabled:opacity-40"
                      aria-label="위로 이동"
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        moveBlock(index, 1);
                      }}
                      disabled={index === blocks.length - 1}
                      className="h-6 w-6 rounded border border-gray-300 bg-white text-xs text-gray-700 hover:bg-gray-50 disabled:opacity-40"
                      aria-label="아래로 이동"
                    >
                      ↓
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
          <p className="mt-3 text-xs text-gray-400">
            실제 값이 채워진 HTML 미리보기는 상세 편집기(채널별)에서 확인합니다.
          </p>
        </div>
      </div>
    </PageContainer>
  );
}
