'use client';

import { useState, useMemo } from 'react';
import type { Package } from '@/domain/entities/PackageEntity';
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

  const filteredPackages = packages.filter((pkg) =>
    pkg.type.toLowerCase().includes(searchPackage.toLowerCase())
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

  const handleUpdatePackage = async (data: UpdatePackageRequest) => {
    if (!selectedPackage) return;

    setIsSubmittingDetails(true);
    try {
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

  return (
    <div className="p-6 bg-gray-50 min-h-full">
      <div className="max-w-6xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">상자비</h1>
          <p className="text-gray-600">배송 상자별 비용을 관리합니다.</p>
        </div>

        <PackageSearchCard
          searchPackage={searchPackage}
          onSearchChange={setSearchPackage}
          onSearch={handleSearch}
          isLoading={isLoading}
          resultCount={filteredPackages.length}
          onAddClick={handleAddClick}
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
          isLoading={isSubmittingDetails}
        />
      </div>
    </div>
  );
}
