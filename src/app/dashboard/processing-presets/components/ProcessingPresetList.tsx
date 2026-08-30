'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ROUTES } from '@/config/routes';
import { PageContainer } from '@/presentation/components/PageContainer';
import { Spinner } from '@/presentation/components/Spinner';
import { useAuthStore } from '@/infrastructure/stores/authStore';
import { ProcessingPresetUseCase } from '@/application/usecases/ProcessingPresetUseCase';
import { ProcessingPresetRepositoryImpl } from '@/infrastructure/repositories/ProcessingPresetRepositoryImpl';
import type { ProcessingPreset } from '@/domain/entities/ProcessingPresetEntity';

export function ProcessingPresetList() {
  const router = useRouter();
  const isAdmin = useAuthStore((state) => state.user?.role === 'ADMIN');
  const useCase = useMemo(
    () => new ProcessingPresetUseCase(new ProcessingPresetRepositoryImpl()),
    [],
  );

  const [presets, setPresets] = useState<ProcessingPreset[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [deletingId, setDeletingId] = useState<number | null>(null);

  // On-mount refetch: navigating back after save re-mounts this container.
  useEffect(() => {
    if (!isAdmin) return;
    let alive = true;
    (async () => {
      setIsLoading(true);
      setError('');
      try {
        const list = await useCase.list();
        if (!alive) return;
        setPresets(list);
      } catch {
        if (alive) setError('프리셋 목록을 불러오지 못했습니다.');
      } finally {
        if (alive) setIsLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [useCase, isAdmin]);

  const handleDelete = async (id: number) => {
    if (!confirm('이 프리셋을 삭제하시겠습니까?')) return;
    setDeletingId(id);
    try {
      await useCase.remove(id);
      setPresets((prev) => prev.filter((p) => p.id !== id));
    } catch {
      setError('삭제에 실패했습니다.');
    } finally {
      setDeletingId(null);
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

  return (
    <PageContainer>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">이미지 처리 프리셋</h1>
        <button
          type="button"
          onClick={() => router.push(ROUTES.PROCESSING_PRESET_NEW)}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          + 새 프리셋
        </button>
      </div>

      {error && <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}

      {isLoading ? (
        <div className="flex min-h-64 items-center justify-center">
          <Spinner size={24} label="불러오는 중..." />
        </div>
      ) : presets.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-300 bg-white p-10 text-center text-gray-500">
          등록된 프리셋이 없습니다.
        </div>
      ) : (
        <div className="rounded-lg bg-white shadow list-table-scroll">
          <table className="text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-left text-gray-600">
                <th className="px-4 py-3">ID</th>
                <th className="px-4 py-3">이름</th>
                <th className="px-4 py-3">오버레이 수</th>
                <th className="px-4 py-3">활성</th>
                <th className="px-4 py-3">작업</th>
              </tr>
            </thead>
            <tbody>
              {presets.map((p) => (
                <tr
                  key={p.id}
                  className="cursor-pointer border-b border-gray-100 hover:bg-gray-50"
                  onClick={() => router.push(ROUTES.PROCESSING_PRESET_EDIT(p.id))}
                >
                  <td className="px-4 py-3 text-gray-900">{p.id}</td>
                  <td className="px-4 py-3 font-medium text-gray-900">{p.name}</td>
                  <td className="px-4 py-3 text-gray-700">{p.operations?.length ?? 0}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded px-2 py-0.5 text-xs ${
                        p.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {p.active ? '활성' : '비활성'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(p.id);
                      }}
                      disabled={deletingId === p.id}
                      className="rounded border border-red-300 px-3 py-1 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
                    >
                      {deletingId === p.id ? '삭제 중...' : '삭제'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </PageContainer>
  );
}
