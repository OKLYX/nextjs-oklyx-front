'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import { PageContainer } from '@/presentation/components/PageContainer';
import type { BoxKind, Package } from '@/domain/entities/PackageEntity';
import { boxKindOf } from '@/domain/entities/PackageEntity';
import type { CreatePackageRequest } from '@/application/dto/CreatePackageRequest';
import type { UpdatePackageRequest } from '@/application/dto/UpdatePackageRequest';
import { PackageUseCase } from '@/application/usecases/PackageUseCase';
import { PackageRepositoryImpl } from '@/infrastructure/repositories/PackageRepositoryImpl';
import { PackageSearchCard } from './PackageSearchCard';
import { PackageTable } from './PackageTable';
import { PackageInputModal } from './PackageInputModal';
import { PackageDetailsModal } from './PackageDetailsModal';
import { Pagination } from '@/presentation/components/Pagination';
import { DEFAULT_PACKAGE_SORT, comparePackages } from './packageSort';
import type { PackageSort } from './packageSort';

/** 한 페이지 줄 수. 행마다 88px 상자 그림이 들어가 20줄은 너무 길다(PLAN 2609_56 D6) */
const PAGE_SIZE = 10;

export function PackageContainer() {
  const [searchPackage, setSearchPackage] = useState('');
  // 🔴 상자 관리 목록만 유형을 넘기지 않는다 = 전 유형(PLAN 2609_40 D21). 칩은 받아온 뒤 거르는
  // 로컬 필터라 유형을 바꿔도 다시 조회하지 않는다.
  const [kindFilter, setKindFilter] = useState<BoxKind | null>(null);
  const [packages, setPackages] = useState<Package[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [currentPage, setCurrentPage] = useState(0);
  const [sort, setSort] = useState<PackageSort>(DEFAULT_PACKAGE_SORT);
  const [selectedPackageId, setSelectedPackageId] = useState<number | undefined>();
  const [isInputModalOpen, setIsInputModalOpen] = useState(false);
  const [isSubmittingInput, setIsSubmittingInput] = useState(false);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [selectedPackage, setSelectedPackage] = useState<Package | null>(null);
  const [isSubmittingDetails, setIsSubmittingDetails] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const packageUseCase = useMemo(() => {
    const repository = new PackageRepositoryImpl();
    return new PackageUseCase(repository);
  }, []);

  const loadPackages = useCallback(async () => {
    setError('');
    setIsLoading(true);

    try {
      const data = await packageUseCase.getPackages();
      setPackages(data);
    } catch (err) {
      const error = err as { response?: { status: number }; message?: string };
      const errorMessage = error?.response?.status === 500
        ? '서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.'
        : error?.message === 'Network Error'
        ? '네트워크 연결을 확인해주세요.'
        : '상자비 정보를 조회할 수 없습니다.';
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, [packageUseCase]);

  // 들어가면 바로 목록을 부른다(PLAN 2609_56 D1). packageUseCase 참조가 고정이라 1회만 돈다.
  // ⚠️ 이펙트 본문에서 곧바로 setState 를 부르면 프로젝트 lint(`react-hooks/set-state-in-effect`)가
  // 막는다 — 조회를 useCallback 으로 감싸 effect 는 호출만 한다.
  useEffect(() => {
    void (async () => {
      await loadPackages();
    })();
  }, [loadPackages]);

  const filteredPackages = useMemo(
    () =>
      packages.filter(
        (pkg) =>
          pkg.type.toLowerCase().includes(searchPackage.toLowerCase()) &&
          (kindFilter === null || boxKindOf(pkg) === kindFilter)
      ),
    [packages, searchPackage, kindFilter]
  );

  // 🔴 [...] 로 복사한다. sort() 는 원본을 뒤집는다 — packages state 를 직접 정렬하면
  //    다음 렌더의 입력이 이미 바뀌어 있다.
  const sortedPackages = useMemo(
    () => [...filteredPackages].sort((a, b) => comparePackages(a, b, sort)),
    [filteredPackages, sort]
  );

  const totalPages = Math.ceil(sortedPackages.length / PAGE_SIZE);

  // 목록이 줄어 지금 페이지가 사라지면 마지막 페이지를 보여준다(결과 0건이면 0페이지).
  // ⚠️ 이펙트에서 setCurrentPage 로 되돌리는 방식은 프로젝트 lint(`react-hooks/set-state-in-effect`)가
  // 막는다 — 렌더 때 값을 깎아 쓴다.
  const safePage = Math.min(currentPage, Math.max(0, totalPages - 1));
  const pagedPackages = sortedPackages.slice(
    safePage * PAGE_SIZE,
    safePage * PAGE_SIZE + PAGE_SIZE
  );

  // 검색어·칩이 걸려 있는가. 빈 상태 문구가 갈린다
  const hasFilter = searchPackage.trim() !== '' || kindFilter !== null;

  const handleSearchChange = (value: string) => {
    setSearchPackage(value);
    setCurrentPage(0);
  };

  const handleKindFilterChange = (kind: BoxKind | null) => {
    setKindFilter(kind);
    setCurrentPage(0);
  };

  const handleSortChange = (next: PackageSort) => {
    setSort(next);
    setCurrentPage(0);
  };

  const handleAddClick = () => {
    setIsInputModalOpen(true);
  };

  const handleCreatePackage = async (data: CreatePackageRequest) => {
    setIsSubmittingInput(true);
    try {
      await packageUseCase.createPackage(data);
      setIsInputModalOpen(false);
      await loadPackages();
    } catch (err) {
      throw err;
    } finally {
      setIsSubmittingInput(false);
    }
  };

  const handleOpenDetailsModal = (pkg: Package) => {
    setSelectedPackageId(pkg.id);
    setSelectedPackage(pkg);
    setIsDetailsModalOpen(true);
  };

  const handleCloseDetailsModal = () => {
    setIsDetailsModalOpen(false);
    setSelectedPackage(null);
    setSelectedPackageId(undefined);
  };

  const handleUpdatePackage = async (data: UpdatePackageRequest, imageFile: File | null) => {
    if (!selectedPackage) return;

    setIsSubmittingDetails(true);
    try {
      // 사진 업로드는 전용 엔드포인트다. 수정 요청에는 이미지 필드가 없으므로 순서는 상관없지만,
      // 먼저 올려야 목록 새로고침 한 번으로 사진과 값이 함께 보인다.
      if (imageFile) {
        await packageUseCase.uploadPackageImage(selectedPackage.id, imageFile);
      }
      await packageUseCase.updatePackage(selectedPackage.id, data);
      handleCloseDetailsModal();
      await loadPackages();
    } catch (err) {
      throw err;
    } finally {
      setIsSubmittingDetails(false);
    }
  };

  const handleRowClick = (pkg: Package) => {
    handleOpenDetailsModal(pkg);
  };

  const handleDeletePackage = async () => {
    if (!selectedPackage) return;

    setIsDeleting(true);
    try {
      await packageUseCase.deletePackage(selectedPackage.id);
      handleCloseDetailsModal();
      await loadPackages();
    } catch (err) {
      throw err;
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <PageContainer title="상자비">
        <PackageSearchCard
          searchPackage={searchPackage}
          onSearchChange={handleSearchChange}
          sort={sort}
          onSortChange={handleSortChange}
          isLoading={isLoading}
          resultCount={sortedPackages.length}
          onAddClick={handleAddClick}
          kindFilter={kindFilter}
          onKindFilterChange={handleKindFilterChange}
        />

        <PackageTable
          packages={pagedPackages}
          referenceScopePackages={sortedPackages}
          hasFilter={hasFilter}
          isLoading={isLoading}
          error={error}
          selectedId={selectedPackageId}
          onRowClick={handleRowClick}
        />

        {/* 🔴 TableCard 가 빈 목록일 때 children 을 안 그려서 페이지 UI 는 표 카드 바깥이다(D7) */}
        {totalPages > 1 && (
          <Pagination
            currentPage={safePage}
            totalPages={totalPages}
            onPageChange={setCurrentPage}
          />
        )}

        <PackageInputModal
          isOpen={isInputModalOpen}
          onClose={() => setIsInputModalOpen(false)}
          onSubmit={handleCreatePackage}
          isLoading={isSubmittingInput}
        />

        <PackageDetailsModal
          isOpen={isDetailsModalOpen}
          pkg={selectedPackage}
          onClose={handleCloseDetailsModal}
          onSubmit={handleUpdatePackage}
          onDelete={handleDeletePackage}
          isLoading={isSubmittingDetails}
          isDeleting={isDeleting}
        />
    </PageContainer>
  );
}
