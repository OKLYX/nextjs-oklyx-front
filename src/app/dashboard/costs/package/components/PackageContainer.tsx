'use client';

import { useState, useMemo } from 'react';
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

export function PackageContainer() {
  const [searchPackage, setSearchPackage] = useState('');
  // 🔴 상자 관리 목록만 유형을 넘기지 않는다 = 전 유형(PLAN 2609_40 D21). 칩은 받아온 뒤 거르는
  // 로컬 필터라 유형을 바꿔도 다시 조회하지 않는다.
  const [kindFilter, setKindFilter] = useState<BoxKind | null>(null);
  const [packages, setPackages] = useState<Package[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [hasSearched, setHasSearched] = useState(false);
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

  const handleSearch = async () => {
    setError('');
    setIsLoading(true);
    setHasSearched(true);

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
  };

  const filteredPackages = packages.filter(
    (pkg) =>
      pkg.type.toLowerCase().includes(searchPackage.toLowerCase()) &&
      (kindFilter === null || boxKindOf(pkg) === kindFilter)
  );

  const handleAddClick = () => {
    setIsInputModalOpen(true);
  };

  const handleCreatePackage = async (data: CreatePackageRequest) => {
    setIsSubmittingInput(true);
    try {
      await packageUseCase.createPackage(data);
      setIsInputModalOpen(false);
      await handleSearch();
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
      await handleSearch();
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
      await handleSearch();
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
          onSearchChange={setSearchPackage}
          onSearch={handleSearch}
          isLoading={isLoading}
          resultCount={filteredPackages.length}
          onAddClick={handleAddClick}
          kindFilter={kindFilter}
          onKindFilterChange={setKindFilter}
        />

        <PackageTable
          packages={filteredPackages}
          isLoading={isLoading}
          error={error}
          hasSearched={hasSearched}
          selectedId={selectedPackageId}
          onRowClick={handleRowClick}
        />

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
