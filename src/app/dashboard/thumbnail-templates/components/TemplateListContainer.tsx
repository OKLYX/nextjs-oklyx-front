'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ROUTES } from '@/config/routes';
import { PageContainer } from '@/presentation/components/PageContainer';
import { Spinner } from '@/presentation/components/Spinner';
import { ThumbnailTemplateUseCase } from '@/application/usecases/ThumbnailTemplateUseCase';
import { ThumbnailTemplateRepositoryImpl } from '@/infrastructure/repositories/ThumbnailTemplateRepositoryImpl';
import type { ThumbnailTemplate } from '@/domain/entities/ThumbnailEntity';

export function TemplateListContainer() {
  const router = useRouter();
  const useCase = useMemo(() => new ThumbnailTemplateUseCase(new ThumbnailTemplateRepositoryImpl()), []);

  const [templates, setTemplates] = useState<ThumbnailTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [deletingId, setDeletingId] = useState<number | null>(null);

  // On-mount refetch: navigating back after save re-mounts this container, so the
  // single-default reassignment (silent un-set of the previous default) is reflected.
  useEffect(() => {
    let alive = true;
    (async () => {
      setIsLoading(true);
      setError('');
      try {
        const list = await useCase.list();
        if (!alive) return;
        setTemplates(list);
      } catch {
        if (alive) setError('템플릿 목록을 불러오지 못했습니다.');
      } finally {
        if (alive) setIsLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [useCase]);

  const handleDelete = async (id: number) => {
    if (!confirm('이 템플릿을 삭제하시겠습니까?')) return;
    setDeletingId(id);
    try {
      await useCase.remove(id);
      setTemplates((prev) => prev.filter((t) => t.id !== id));
    } catch {
      setError('삭제에 실패했습니다.');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <PageContainer>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">썸네일 템플릿</h1>
        <button
          type="button"
          onClick={() => router.push(ROUTES.THUMBNAIL_TEMPLATE_NEW)}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          + 템플릿 생성
        </button>
      </div>

      {error && <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}

      {isLoading ? (
        <div className="flex min-h-64 items-center justify-center">
          <Spinner size={24} label="불러오는 중..." />
        </div>
      ) : templates.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-300 bg-white p-10 text-center text-gray-500">
          등록된 템플릿이 없습니다.
        </div>
      ) : (
        <div className="rounded-lg bg-white shadow list-table-scroll">
          <table className="text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-left text-gray-600">
                <th className="px-4 py-3">ID</th>
                <th className="px-4 py-3">이름</th>
                <th className="px-4 py-3">기본</th>
                <th className="px-4 py-3">캔버스</th>
                <th className="px-4 py-3">요소</th>
                <th className="px-4 py-3">활성</th>
                <th className="px-4 py-3">작업</th>
              </tr>
            </thead>
            <tbody>
              {templates.map((t) => (
                <tr
                  key={t.id}
                  className="cursor-pointer border-b border-gray-100 hover:bg-gray-50"
                  onClick={() => router.push(ROUTES.THUMBNAIL_TEMPLATE_EDIT(t.id))}
                >
                  <td className="px-4 py-3 text-gray-900">{t.id}</td>
                  <td className="px-4 py-3 font-medium text-gray-900">{t.name}</td>
                  <td className="px-4 py-3">
                    {t.isDefault && (
                      <span className="rounded bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
                        기본
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-700">
                    {t.canvasWidth}×{t.canvasHeight}
                  </td>
                  <td className="px-4 py-3 text-gray-700">{t.elements?.length ?? 0}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded px-2 py-0.5 text-xs ${
                        t.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {t.active ? '활성' : '비활성'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(t.id);
                      }}
                      disabled={deletingId === t.id}
                      className="rounded border border-red-300 px-3 py-1 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
                    >
                      {deletingId === t.id ? '삭제 중...' : '삭제'}
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
