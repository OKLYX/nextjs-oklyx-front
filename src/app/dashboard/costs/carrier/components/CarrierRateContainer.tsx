'use client';

import { useState, useMemo } from 'react';
import type { CarrierRate } from '@/domain/entities/CarrierRateEntity';
import { CarrierRateUseCase } from '@/application/usecases/CarrierRateUseCase';
import { CarrierRateRepositoryImpl } from '@/infrastructure/repositories/CarrierRateRepositoryImpl';
import { CarrierRateSearchCard } from './CarrierRateSearchCard';
import { CarrierRateTable } from './CarrierRateTable';
import { CreateCarrierRateModal } from './CreateCarrierRateModal';
import { EditCarrierRateModal } from './EditCarrierRateModal';
import type { CreateCarrierRateRequest } from '@/application/dto/CreateCarrierRateRequest';
import type { UpdateCarrierRateRequest } from '@/application/dto/UpdateCarrierRateRequest';

export function CarrierRateContainer() {
  const [searchCarrier, setSearchCarrier] = useState('');
  const [carrierRates, setCarrierRates] = useState<CarrierRate[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [hasSearched, setHasSearched] = useState(false);

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedCarrierRate, setSelectedCarrierRate] = useState<CarrierRate | null>(null);
  const [isSubmittingEdit, setIsSubmittingEdit] = useState(false);

  const carrierRateUseCase = useMemo(() => {
    const repository = new CarrierRateRepositoryImpl();
    return new CarrierRateUseCase(repository);
  }, []);

  const handleSearch = async () => {
    setError('');
    setIsLoading(true);
    setHasSearched(true);

    try {
      const data = await carrierRateUseCase.getCarrierRates();
      setCarrierRates(data);
    } catch {
      setError('택배비 정보를 조회할 수 없습니다.');
      setCarrierRates([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenCreateModal = () => {
    setIsCreateModalOpen(true);
  };

  const handleCloseCreateModal = () => {
    setIsCreateModalOpen(false);
  };

  const handleCreateCarrierRate = async (data: CreateCarrierRateRequest) => {
    setIsSubmitting(true);
    try {
      await carrierRateUseCase.createCarrierRate(data);
      handleCloseCreateModal();
      await handleSearch();
    } catch (err) {
      throw err;
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenEditModal = (carrierRate: CarrierRate) => {
    setSelectedCarrierRate(carrierRate);
    setIsEditModalOpen(true);
  };

  const handleCloseEditModal = () => {
    setIsEditModalOpen(false);
    setSelectedCarrierRate(null);
  };

  const handleEditCarrierRate = async (data: UpdateCarrierRateRequest) => {
    if (!selectedCarrierRate) {
      throw new Error('선택된 택배비가 없습니다.');
    }

    setIsSubmittingEdit(true);
    try {
      await carrierRateUseCase.updateCarrierRate(selectedCarrierRate.id, data);
      handleCloseEditModal();
      await handleSearch();
    } catch (err) {
      throw err;
    } finally {
      setIsSubmittingEdit(false);
    }
  };

  const filteredRates = carrierRates.filter((rate) =>
    rate.carrier.toLowerCase().includes(searchCarrier.toLowerCase())
  );

  return (
    <div className="p-6 bg-gray-50 min-h-full">
      <div className="max-w-6xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">택배비</h1>
          <p className="text-gray-600">배송사별 택배비를 관리합니다.</p>
        </div>
        <CarrierRateSearchCard
          searchCarrier={searchCarrier}
          onSearchChange={setSearchCarrier}
          onSearch={handleSearch}
          isLoading={isLoading}
          resultCount={filteredRates.length}
          onAddClick={handleOpenCreateModal}
        />
        <CarrierRateTable
          carrierRates={filteredRates}
          isLoading={isLoading}
          error={error}
          hasSearched={hasSearched}
          selectedId={selectedCarrierRate?.id}
          onRowClick={handleOpenEditModal}
        />
        <CreateCarrierRateModal
          isOpen={isCreateModalOpen}
          onClose={handleCloseCreateModal}
          onSubmit={handleCreateCarrierRate}
          isLoading={isSubmitting}
        />
        <EditCarrierRateModal
          isOpen={isEditModalOpen}
          carrierRate={selectedCarrierRate}
          onClose={handleCloseEditModal}
          onSubmit={handleEditCarrierRate}
          isLoading={isSubmittingEdit}
        />
      </div>
    </div>
  );
}
