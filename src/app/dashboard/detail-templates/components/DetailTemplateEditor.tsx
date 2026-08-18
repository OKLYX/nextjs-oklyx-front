'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ROUTES } from '@/config/routes';
import { PageContainer } from '@/presentation/components/PageContainer';
import { Spinner } from '@/presentation/components/Spinner';
import { resolveThumbUrl } from '@/infrastructure/utils/thumbUrl';
import { useAuthStore } from '@/infrastructure/stores/authStore';
import { DetailContentUseCase } from '@/application/usecases/DetailContentUseCase';
import { DetailContentRepositoryImpl } from '@/infrastructure/repositories/DetailContentRepositoryImpl';
import type { DetailBlock } from '@/domain/entities/DetailTemplateEntity';
import { BUILTIN_FIELD_KEYS } from '@/domain/entities/ThumbnailEntity';
import { BlockRow } from './BlockRow';

type AppendableType = 'text' | 'spacer' | 'imageZone';

// Initial block objects per type (SSOT = prompt 18 / backend 17). src=null keeps
// the DetailBlock shape complete for text/spacer/imageZone.
function createBlock(type: AppendableType): DetailBlock {
  switch (type) {
    case 'text':
      return { type, bind: '', src: null, defaultValue: '', align: 'left', widthPercent: 100, heightPx: null };
    case 'spacer':
      return { type, bind: null, src: null, defaultValue: null, align: null, widthPercent: null, heightPx: 24 };
    case 'imageZone':
      return { type, bind: '', src: null, defaultValue: null, align: 'center', widthPercent: 100, heightPx: null };
  }
}

interface DetailTemplateEditorProps {
  templateId?: number;
}

export function DetailTemplateEditor({ templateId }: DetailTemplateEditorProps) {
  const router = useRouter();
  const isAdmin = useAuthStore((state) => state.user?.role === 'ADMIN');
  const useCase = useMemo(() => new DetailContentUseCase(new DetailContentRepositoryImpl()), []);

  const [name, setName] = useState('');
  const [isDefault, setIsDefault] = useState(false);
  const [blocks, setBlocks] = useState<DetailBlock[]>([]);
  const [isLoading, setIsLoading] = useState(!!templateId);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [nameError, setNameError] = useState('');
  const [blockErrors, setBlockErrors] = useState<Record<number, string>>({});

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
  };

  const deleteBlock = (index: number) => {
    setBlocks((prev) => prev.filter((_, i) => i !== index));
  };

  const appendBlock = (type: AppendableType) => {
    setBlocks((prev) => [...prev, createBlock(type)]);
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
      } else if (b.type === 'imageZone' && !b.bind?.trim()) errs[i] = '존 ID(bind)를 입력하세요';
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
      return;
    }
    setError('');
    setIsSaving(true);
    try {
      const payload = { name: name.trim(), blocks, active: true, isDefault };
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
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Block list */}
        <div className="space-y-3">
          {blocks.length === 0 ? (
            <div className="rounded-lg border border-dashed border-gray-300 bg-white p-8 text-center text-sm text-gray-500">
              블록이 없습니다. 아래에서 추가하세요.
            </div>
          ) : (
            blocks.map((block, index) => (
              <BlockRow
                key={index}
                block={block}
                index={index}
                total={blocks.length}
                error={blockErrors[index]}
                onChange={(patch) => patchBlock(index, patch)}
                onMoveUp={() => moveBlock(index, -1)}
                onMoveDown={() => moveBlock(index, 1)}
                onDelete={() => deleteBlock(index)}
              />
            ))
          )}

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
              + 이미지 존
            </button>
          </div>
        </div>

        {/* Structure preview (derived from edit state, no fetch) */}
        <div className="rounded-lg bg-white p-4 shadow">
          <h2 className="mb-3 text-sm font-semibold text-gray-700">구조 미리보기</h2>
          <div className="space-y-2">
            {blocks.length === 0 && <p className="text-sm text-gray-400">블록 없음</p>}
            {blocks.map((block, index) => {
              if (block.type === 'spacer') {
                return (
                  <div
                    key={index}
                    className="flex items-center justify-center rounded bg-gray-100 text-xs text-gray-500"
                    style={{ height: Math.max(8, Math.min(120, block.heightPx ?? 24)) }}
                  >
                    여백 {block.heightPx ?? 24}px
                  </div>
                );
              }
              if (block.type === 'imageZone') {
                return (
                  <div
                    key={index}
                    className="rounded border border-dashed border-gray-300 p-4 text-center text-xs text-gray-500"
                  >
                    이미지 존: {block.bind || '(미지정)'}
                  </div>
                );
              }
              if (block.type === 'asset') {
                return (
                  <div key={index} className="flex justify-center">
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
              }
              return (
                <div
                  key={index}
                  className="rounded border border-gray-200 px-3 py-2 text-sm text-gray-800"
                  style={{ textAlign: (block.align as 'left' | 'center' | 'right') ?? 'left' }}
                >
                  {block.defaultValue || (block.bind ? `{${block.bind}}` : '(빈 텍스트)')}
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
