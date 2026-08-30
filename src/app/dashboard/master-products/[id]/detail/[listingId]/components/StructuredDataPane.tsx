'use client';

import { useState } from 'react';
import { Spinner } from '@/presentation/components/Spinner';
import { resolveThumbUrl } from '@/infrastructure/utils/thumbUrl';
import type { GeneratedProductResponse } from '@/domain/entities/ListingRegistrationEntity';
import type { DetailTemplateResponse } from '@/domain/entities/DetailTemplateEntity';
import type { ListingRegistrationUseCase } from '@/application/usecases/ListingRegistrationUseCase';
import type { DetailContentUseCase } from '@/application/usecases/DetailContentUseCase';
import type { OnGenerated } from './DetailEditorTabs';
import {
  MasterImagePool,
  type ImageField,
} from '@/app/dashboard/master-products/components/MasterImagePool';

interface StructuredDataPaneProps {
  masterId: number;
  listingId: number;
  template: DetailTemplateResponse;
  generated: GeneratedProductResponse;
  listingUseCase: ListingRegistrationUseCase;
  detailUseCase: DetailContentUseCase;
  onGenerated: OnGenerated;
}

/**
 * 탭2 — 구조 데이터 편집(자체 구현 블록 리스트). WYSIWYG 아님.
 * File: src/app/dashboard/master-products/[id]/detail/[listingId]/components/StructuredDataPane.tsx
 *
 * ⚠️ text 값 = 채널(리스팅) override(updateFieldValues, 이 채널에만 적용).
 * ⚠️ zone 이미지 = 마스터 소유(같은 마스터의 모든 채널 공유, 재생성 시 전 채널 반영).
 */
export function StructuredDataPane({
  masterId,
  listingId,
  template,
  generated,
  listingUseCase,
  detailUseCase,
  onGenerated,
}: StructuredDataPaneProps) {
  const [draft, setDraft] = useState<Record<string, string>>({ ...generated.fieldValues });
  const [zoneDirty, setZoneDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  const textDirty = JSON.stringify(draft) !== JSON.stringify(generated.fieldValues);
  const canSave = textDirty || zoneDirty;

  // Detail zones only (no cover-photo field — that lives in the master form).
  const zoneFields: ImageField[] = template.blocks
    .filter((b) => b.type === 'imageZone' && b.bind)
    .map((b) => ({ key: b.bind as string, label: b.bind as string }));

  const handleSave = async () => {
    if (!canSave) return;
    if (
      generated.source === 'MANUAL_OVERRIDE' &&
      !window.confirm('수동 수정본이 유지되고 썸네일·판매가만 갱신됩니다. 계속하시겠습니까?')
    ) {
      return;
    }
    setIsSaving(true);
    setError('');
    try {
      let res: GeneratedProductResponse;
      if (textDirty) {
        // Omit blank keys so the backend keeps product/template fallbacks.
        // This call also regenerates, so pending zone changes are picked up too.
        const fieldValues: Record<string, string> = {};
        for (const [key, value] of Object.entries(draft)) {
          if (value.trim() !== '') fieldValues[key] = value;
        }
        res = await listingUseCase.updateFieldValues(listingId, { fieldValues });
      } else {
        // Only zone images changed (already saved server-side) → regenerate to reflect.
        res = await listingUseCase.regenerate(listingId);
      }
      onGenerated(res);
      setDraft({ ...res.fieldValues });
      setZoneDirty(false);
    } catch {
      setError('저장에 실패했습니다.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="space-y-1 text-xs text-gray-500">
        <p>· 텍스트값은 이 채널에만 적용됩니다(다른 채널에 영향 없음).</p>
        <p>· zone 이미지는 마스터 공유 → 재생성 시 같은 마스터의 다른 채널에도 반영됩니다.</p>
      </div>

      {error && <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <div className="space-y-4">
        {template.blocks.map((block, idx) => {
          if (block.type === 'text' && block.bind) {
            const key = block.bind;
            return (
              <div key={`text-${key}-${idx}`}>
                <label className="mb-1 block text-xs font-medium text-gray-600">{key}</label>
                <input
                  className="w-full max-w-md rounded border border-gray-300 px-2 py-1 text-sm text-gray-900"
                  value={draft[key] ?? ''}
                  placeholder={block.defaultValue ?? '(상품정보에서 파생)'}
                  onChange={(e) => setDraft((prev) => ({ ...prev, [key]: e.target.value }))}
                />
              </div>
            );
          }
          // imageZone blocks render together in one MasterImagePool below.
          if (block.type === 'imageZone') return null;
          if (block.type === 'asset' && block.src) {
            return (
              <div key={`asset-${idx}`}>
                <label className="mb-1 block text-xs font-medium text-gray-600">
                  고정 요소 (읽기전용)
                </label>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={resolveThumbUrl(block.src)}
                  alt="고정 요소"
                  className="max-h-40 rounded border border-gray-200 object-contain"
                />
              </div>
            );
          }
          return null;
        })}

        {zoneFields.length > 0 && (
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">
              상세페이지 이미지 (마스터 공유)
            </label>
            <MasterImagePool
              masterId={masterId}
              detailUseCase={detailUseCase}
              fields={zoneFields}
              onDirty={() => setZoneDirty(true)}
            />
          </div>
        )}
      </div>

      <div className="border-t border-gray-100 pt-3">
        <button
          type="button"
          onClick={handleSave}
          disabled={!canSave || isSaving}
          className="flex items-center gap-1 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {isSaving ? <Spinner label="저장 중..." /> : '저장 및 재생성'}
        </button>
      </div>
    </div>
  );
}
