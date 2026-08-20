'use client';

import { useEffect, useState } from 'react';
import { Spinner } from '@/presentation/components/Spinner';
import type { MasterProductUseCase } from '@/application/usecases/MasterProductUseCase';

interface MasterTagsPanelProps {
  masterId: number;
  useCase: MasterProductUseCase; // owned by parent container (CoverageMatrix)
}

/**
 * 마스터 등록상품명(자동) + 태그 풀 read-only 노출 패널 (마스터 상세).
 * File: src/app/dashboard/master-products/[id]/components/MasterTagsPanel.tsx
 *
 * ⚠️ 편집은 하지 않는다 — 태그 입력은 마스터 생성/수정 모달(MasterProductFormModal)로 이동했다.
 * 이 패널은 조회 전용: 등록상품명(백엔드 32 규칙 자동생성)과 마스터 태그 풀(백엔드 33)을 보여준다.
 * 태그는 override 가 아니라 마스터 풀 + 채널 raw 의 결합이며, 결합·상한·이력은 push 시점 처리된다.
 */
export function MasterTagsPanel({ masterId, useCase }: MasterTagsPanelProps) {
  const [tags, setTags] = useState<string[]>([]);
  const [registrationName, setRegistrationName] = useState<string | null | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    (async () => {
      setIsLoading(true);
      setError('');
      try {
        const master = await useCase.getById(masterId);
        if (!alive) return;
        setTags(master.tags ?? []);
        setRegistrationName(master.registrationName);
      } catch {
        if (alive) setError('태그 정보를 불러오지 못했습니다.');
      } finally {
        if (alive) setIsLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [useCase, masterId]);

  return (
    <div className="rounded-lg bg-white p-4 shadow">
      <h2 className="mb-3 text-sm font-semibold text-gray-900">등록상품명 · 태그</h2>

      {error && <p className="mb-3 rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      {isLoading ? (
        <div className="flex min-h-16 items-center justify-center">
          <Spinner size={20} label="불러오는 중..." />
        </div>
      ) : (
        <>
          <div className="mb-4">
            <label className="mb-1 block text-xs font-medium text-gray-600">등록상품명 (자동)</label>
            <p className="rounded bg-gray-50 px-3 py-2 text-sm text-gray-800">
              {registrationName ?? '옵션·구성상품 설정 후 자동 생성됩니다'}
            </p>
            <p className="mt-1 text-xs text-gray-400">
              옵션/구성상품에서 규칙으로 생성됩니다 — 마켓 전송용.
            </p>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">태그 (마스터 풀)</label>
            {tags.length === 0 ? (
              <p className="text-sm text-gray-400">등록된 태그가 없습니다. 마스터 수정에서 추가하세요.</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {tags.map((tag, index) => (
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
              편집은 목록의 마스터 수정에서 합니다. 채널별 태그는 셀의 [태그 편집]에서 조정하세요.
            </p>
          </div>
        </>
      )}
    </div>
  );
}
