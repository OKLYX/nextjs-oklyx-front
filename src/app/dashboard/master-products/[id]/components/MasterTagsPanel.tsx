'use client';

import { useState } from 'react';
import { Spinner } from '@/presentation/components/Spinner';
import { TagChipsInput } from '@/presentation/components/TagChipsInput';
import { extractErrorMessage } from '@/infrastructure/utils/errorMessage';
import type { MasterProductResponse } from '@/domain/entities/MasterProductEntity';
import type { MasterProductUseCase } from '@/application/usecases/MasterProductUseCase';

interface MasterTagsPanelProps {
  master: MasterProductResponse; // initial values come from the parent (no getById here)
  useCase: MasterProductUseCase; // owned by parent container (CoverageMatrix)
  onSaved: (patched: MasterProductResponse) => void; // parent updates its master state in place
}

/**
 * 마스터 등록상품명(자동, 읽기 전용) + 태그 풀 인라인 편집 패널 (마스터 상세).
 * File: src/app/dashboard/master-products/[id]/components/MasterTagsPanel.tsx
 *
 * 태그는 override 가 아니라 마스터 풀(백엔드 33) + 채널 raw 의 결합이며, 결합·상한·이력은
 * push 시점에 처리된다. 빈 리스트 저장(=전체 제거)도 허용된다.
 * 등록상품명은 백엔드 32 규칙으로 자동 생성되는 값이라 여기서 편집하지 않는다.
 *
 * 초기값은 부모가 내려준 `master`(`tags`/`registrationName`)를 쓴다 — 패널이 `getById` 를
 * 다시 부르지 않는다(상세 페이지의 `getById` 는 부모 1회). 저장 후 `onSaved(patched)` 로만
 * 통지하고 매트릭스는 재조회하지 않는다(태그는 매트릭스 셀 표시를 바꾸지 않는다).
 */
export function MasterTagsPanel({ master, useCase, onSaved }: MasterTagsPanelProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [tags, setTags] = useState<string[]>(master.tags ?? []);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  const currentTags = master.tags ?? [];

  const startEdit = () => {
    setTags(master.tags ?? []);
    setError('');
    setSaved(false);
    setIsEditing(true);
  };

  const handleSave = async () => {
    try {
      setIsSaving(true);
      setError('');
      setSaved(false);
      const patched = await useCase.updateTags(master.id, { tags });
      setIsEditing(false);
      setSaved(true);
      // Transient confirmation — auto-dismiss (project has no toast system).
      setTimeout(() => setSaved(false), 2500);
      onSaved(patched);
    } catch (err) {
      setError(extractErrorMessage(err, '태그 저장에 실패했습니다.'));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="p-4">
      {error && <p className="mb-3 rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <div className="mb-4">
        <label className="mb-1 block text-xs font-medium text-gray-600">등록상품명 (자동)</label>
        <p className="rounded bg-gray-50 px-3 py-2 text-sm text-gray-800">
          {master.registrationName ?? '옵션·구성상품 설정 후 자동 생성됩니다'}
        </p>
        <p className="mt-1 text-xs text-gray-400">
          옵션/구성상품에서 규칙으로 생성됩니다 — 마켓 전송용.
        </p>
      </div>

      <div className="space-y-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">태그 (마스터 풀)</label>
          {isEditing ? (
            <>
              <TagChipsInput tags={tags} onChange={setTags} disabled={isSaving} />
              <p className="mt-1 text-[11px] text-gray-500">Enter 또는 콤마로 추가하세요.</p>
            </>
          ) : currentTags.length === 0 ? (
            <p className="text-sm text-gray-400">등록된 태그가 없습니다.</p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {currentTags.map((tag, index) => (
                <span
                  key={`${tag}-${index}`}
                  className="rounded bg-gray-100 px-2 py-0.5 text-sm text-gray-800"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
          <p className="mt-1 text-xs text-gray-400">
            채널별 태그는 셀의 [태그 편집]에서 조정하세요.
          </p>
        </div>

        {saved && !error && <p className="text-sm text-green-700">태그를 저장했습니다.</p>}

        {isEditing ? (
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              className="px-3 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 disabled:bg-blue-400 disabled:cursor-not-allowed transition-colors inline-flex items-center gap-2"
            >
              {isSaving ? <Spinner label="저장 중..." /> : '저장'}
            </button>
            <button
              type="button"
              onClick={() => {
                setIsEditing(false);
                setError('');
              }}
              disabled={isSaving}
              className="px-3 py-2 border border-gray-300 text-gray-700 text-sm font-medium rounded-md hover:bg-gray-100 disabled:opacity-50 transition-colors"
            >
              취소
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={startEdit}
            className="px-3 py-2 border border-gray-300 text-gray-700 text-sm font-medium rounded-md hover:bg-gray-100 transition-colors"
          >
            수정
          </button>
        )}
      </div>
    </div>
  );
}
