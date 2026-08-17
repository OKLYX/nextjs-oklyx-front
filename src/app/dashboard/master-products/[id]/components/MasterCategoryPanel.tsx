'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Spinner } from '@/presentation/components/Spinner';
import { PLATFORMS } from '@/app/dashboard/sales-products/register/components/ProductListingForm';
import type { MasterProductUseCase } from '@/application/usecases/MasterProductUseCase';
import type { CategoryUseCase } from '@/application/usecases/CategoryUseCase';
import type { MasterCategoryResponse } from '@/domain/entities/MasterProductEntity';
import type { Category } from '@/domain/entities/CategoryEntity';

interface MasterCategoryPanelProps {
  masterId: number;
  useCase: MasterProductUseCase; // owned by parent container (CoverageMatrix)
  categoryUseCase: CategoryUseCase;
}

/**
 * 플랫폼별 카테고리 관리 패널 (마스터 상세).
 * File: src/app/dashboard/master-products/[id]/components/MasterCategoryPanel.tsx
 *
 * 채널 추가의 선행 조건: 마스터에 해당 플랫폼 카테고리가 없으면 채널추가가 400 이 된다.
 * 백엔드 13 응답(MasterCategoryResponse)에 categoryName 이 포함되므로 그대로 표시한다.
 */
export function MasterCategoryPanel({ masterId, useCase, categoryUseCase }: MasterCategoryPanelProps) {
  const [rows, setRows] = useState<MasterCategoryResponse[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  const [platform, setPlatform] = useState('');
  const [categoryId, setCategoryId] = useState<number | ''>('');
  const [isSaving, setIsSaving] = useState(false);
  const [busyPlatform, setBusyPlatform] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      const list = await useCase.getCategories(masterId);
      setRows(list);
    } catch {
      setError('플랫폼별 카테고리를 불러오지 못했습니다.');
    } finally {
      setIsLoading(false);
    }
  }, [useCase, masterId]);

  useEffect(() => {
    void (async () => {
      await load();
    })();
  }, [load]);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const list = await categoryUseCase.getCategories();
        if (alive) setCategories(list);
      } catch {
        if (alive) setError('카테고리 목록을 불러오지 못했습니다.');
      }
    })();
    return () => {
      alive = false;
    };
  }, [categoryUseCase]);

  // CategoryEntity carries `platform`, so scope the picker to the chosen platform.
  const visibleCategories = useMemo(
    () => (platform ? categories.filter((c) => c.platform === platform) : categories),
    [categories, platform],
  );

  const handleUpsert = async () => {
    setError('');
    if (!platform || categoryId === '') {
      setError('플랫폼과 카테고리를 선택하세요.');
      return;
    }
    setIsSaving(true);
    try {
      await useCase.upsertCategory(masterId, { platform, categoryId: Number(categoryId) });
      setCategoryId('');
      await load();
    } catch {
      setError('카테고리 저장에 실패했습니다.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (row: MasterCategoryResponse) => {
    if (!window.confirm(`${row.platform} 카테고리 "${row.categoryName}" 을(를) 삭제하시겠습니까?`)) return;
    setError('');
    setBusyPlatform(row.platform);
    try {
      await useCase.deleteCategory(masterId, row.platform);
      await load();
    } catch {
      setError('카테고리 삭제에 실패했습니다.');
    } finally {
      setBusyPlatform(null);
    }
  };

  return (
    <div className="rounded-lg bg-white p-4 shadow">
      <h2 className="mb-3 text-sm font-semibold text-gray-900">플랫폼별 카테고리</h2>

      {error && <p className="mb-3 rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      {isLoading ? (
        <div className="flex min-h-16 items-center justify-center">
          <Spinner size={20} label="불러오는 중..." />
        </div>
      ) : rows.length === 0 ? (
        <p className="mb-3 text-sm text-gray-500">
          플랫폼별 카테고리가 없습니다. 채널을 추가하려면 먼저 해당 플랫폼 카테고리를 지정하세요.
        </p>
      ) : (
        <div className="mb-3 list-table-scroll">
          <table>
            <thead>
              <tr className="border-b border-gray-200 text-left text-sm text-gray-600">
                <th className="px-3 py-2">플랫폼</th>
                <th className="px-3 py-2">카테고리</th>
                <th className="px-3 py-2">액션</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.platform} className="border-b border-gray-100 text-sm text-gray-900">
                  <td className="px-3 py-2">{row.platform}</td>
                  <td className="px-3 py-2">{row.categoryName}</td>
                  <td className="px-3 py-2">
                    <button
                      type="button"
                      onClick={() => handleDelete(row)}
                      disabled={busyPlatform === row.platform}
                      className="rounded border border-red-300 px-2 py-0.5 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
                    >
                      삭제
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex flex-wrap items-end gap-2">
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">플랫폼</label>
          <select
            className="rounded border border-gray-300 px-2 py-1.5 text-sm text-gray-900"
            value={platform}
            onChange={(e) => {
              setPlatform(e.target.value);
              setCategoryId('');
            }}
          >
            <option value="">선택</option>
            {PLATFORMS.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">카테고리</label>
          <select
            className="rounded border border-gray-300 px-2 py-1.5 text-sm text-gray-900"
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value ? Number(e.target.value) : '')}
          >
            <option value="">선택</option>
            {visibleCategories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <button
          type="button"
          onClick={handleUpsert}
          disabled={isSaving}
          className="rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {isSaving ? <Spinner label="저장 중..." /> : '추가/변경'}
        </button>
      </div>
    </div>
  );
}
