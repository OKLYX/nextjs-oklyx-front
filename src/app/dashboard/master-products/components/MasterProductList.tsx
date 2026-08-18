'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { PageContainer } from '@/presentation/components/PageContainer';
import { Spinner } from '@/presentation/components/Spinner';
import { useAuthStore } from '@/infrastructure/stores/authStore';
import { resolveThumbUrl } from '@/infrastructure/utils/thumbUrl';
import { ROUTES } from '@/config/routes';
import { MasterProductUseCase } from '@/application/usecases/MasterProductUseCase';
import { MasterProductRepositoryImpl } from '@/infrastructure/repositories/MasterProductRepositoryImpl';
import { GetProductsUseCase } from '@/application/usecases/GetProductsUseCase';
import { ProductRepositoryImpl } from '@/infrastructure/repositories/ProductRepositoryImpl';
import { CarrierRateUseCase } from '@/application/usecases/CarrierRateUseCase';
import { CarrierRateRepositoryImpl } from '@/infrastructure/repositories/CarrierRateRepositoryImpl';
import { PackageUseCase } from '@/application/usecases/PackageUseCase';
import { PackageRepositoryImpl } from '@/infrastructure/repositories/PackageRepositoryImpl';
import { ThumbnailTemplateUseCase } from '@/application/usecases/ThumbnailTemplateUseCase';
import { ThumbnailTemplateRepositoryImpl } from '@/infrastructure/repositories/ThumbnailTemplateRepositoryImpl';
import { DetailContentUseCase } from '@/application/usecases/DetailContentUseCase';
import { DetailContentRepositoryImpl } from '@/infrastructure/repositories/DetailContentRepositoryImpl';
import type { MasterProductResponse } from '@/domain/entities/MasterProductEntity';
import { MasterProductFormModal } from './MasterProductFormModal';

/**
 * 판매상품 마스터 목록 + 생성/수정 모달 진입점.
 * File: src/app/dashboard/master-products/components/MasterProductList.tsx
 */
export function MasterProductList() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const isAdmin = user?.role === 'ADMIN';

  const useCase = useMemo(() => new MasterProductUseCase(new MasterProductRepositoryImpl()), []);
  const productsUseCase = useMemo(() => new GetProductsUseCase(new ProductRepositoryImpl()), []);
  const carrierRateUseCase = useMemo(() => new CarrierRateUseCase(new CarrierRateRepositoryImpl()), []);
  const packageUseCase = useMemo(() => new PackageUseCase(new PackageRepositoryImpl()), []);
  const thumbnailTemplateUseCase = useMemo(
    () => new ThumbnailTemplateUseCase(new ThumbnailTemplateRepositoryImpl()),
    [],
  );
  const detailUseCase = useMemo(
    () => new DetailContentUseCase(new DetailContentRepositoryImpl()),
    [],
  );

  const [masters, setMasters] = useState<MasterProductResponse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState<number | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingMaster, setEditingMaster] = useState<MasterProductResponse | null>(null);

  const load = useCallback(async () => {
    const list = await useCase.list();
    setMasters(list);
  }, [useCase]);

  useEffect(() => {
    if (!isAdmin) return;
    let alive = true;
    (async () => {
      setIsLoading(true);
      setError('');
      try {
        const list = await useCase.list();
        if (alive) setMasters(list);
      } catch {
        if (alive) setError('판매상품 마스터를 불러오지 못했습니다.');
      } finally {
        if (alive) setIsLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [useCase, isAdmin]);

  const openCreate = () => {
    setEditingMaster(null);
    setModalOpen(true);
  };

  const openEdit = (m: MasterProductResponse) => {
    setEditingMaster(m);
    setModalOpen(true);
  };

  const handleDelete = async (m: MasterProductResponse) => {
    if (!confirm(`마스터 "${m.name}" 을(를) 삭제하시겠습니까?`)) return;
    setError('');
    setBusyId(m.id);
    try {
      await useCase.remove(m.id);
      await load();
    } catch {
      setError('삭제에 실패했습니다.');
    } finally {
      setBusyId(null);
    }
  };

  if (!isAdmin) {
    return (
      <PageContainer>
        <p className="text-sm text-gray-500">접근 권한이 없습니다.</p>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-gray-900">판매상품 마스터</h1>
        <button
          type="button"
          onClick={openCreate}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          새 마스터
        </button>
      </div>

      {error && <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

      <div className="rounded-lg bg-white shadow list-table-scroll">
        {isLoading ? (
          <div className="flex min-h-32 items-center justify-center">
            <Spinner size={24} label="불러오는 중..." />
          </div>
        ) : (
          <table>
            <thead>
              <tr className="border-b border-gray-200 text-left text-sm text-gray-600">
                <th className="px-4 py-3">사진</th>
                <th className="px-4 py-3">이름</th>
                <th className="px-4 py-3">상태</th>
                <th className="px-4 py-3">구성상품</th>
                <th className="px-4 py-3">옵션</th>
                <th className="px-4 py-3">액션</th>
              </tr>
            </thead>
            <tbody>
              {masters.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-sm text-gray-500">
                    등록된 판매상품 마스터가 없습니다.
                  </td>
                </tr>
              ) : (
                masters.map((m) => (
                  <tr
                    key={m.id}
                    className="cursor-pointer border-b border-gray-100 text-sm text-gray-900 hover:bg-gray-50"
                    onClick={() => router.push(ROUTES.MASTER_PRODUCT_DETAIL(m.id))}
                  >
                    <td className="px-4 py-2">
                      <div className="h-12 w-12 overflow-hidden rounded bg-gray-100">
                        {m.sourceImageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={resolveThumbUrl(m.sourceImageUrl)}
                            alt={m.name}
                            className="h-full w-full object-contain"
                          />
                        ) : (
                          <span className="flex h-full w-full items-center justify-center text-[10px] text-gray-400">
                            없음
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 font-medium">{m.name}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded px-1.5 py-0.5 text-[10px] ${
                          m.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                        }`}
                      >
                        {m.active ? '활성' : '비활성'}
                      </span>
                    </td>
                    <td className="px-4 py-3">{m.components.length}</td>
                    <td className="px-4 py-3">{m.options.length}</td>
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => router.push(ROUTES.MASTER_PRODUCT_DETAIL(m.id))}
                          className="rounded border border-gray-300 px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-100"
                        >
                          상세
                        </button>
                        <button
                          type="button"
                          onClick={() => openEdit(m)}
                          disabled={busyId === m.id}
                          className="rounded border border-blue-300 px-2 py-1 text-xs font-medium text-blue-600 hover:bg-blue-50 disabled:opacity-50"
                        >
                          수정
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(m)}
                          disabled={busyId === m.id}
                          className="rounded border border-red-300 px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
                        >
                          삭제
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </div>

      {modalOpen && (
        <MasterProductFormModal
          master={editingMaster}
          useCase={useCase}
          productsUseCase={productsUseCase}
          carrierRateUseCase={carrierRateUseCase}
          packageUseCase={packageUseCase}
          thumbnailTemplateUseCase={thumbnailTemplateUseCase}
          detailUseCase={detailUseCase}
          onClose={() => setModalOpen(false)}
          onDataChanged={load}
        />
      )}
    </PageContainer>
  );
}
