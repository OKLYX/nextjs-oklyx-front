'use client';

import { useEffect, useMemo, useState } from 'react';
import type { Carrier } from '@/domain/entities/CarrierEntity';
import { CarrierUseCase } from '@/application/usecases/CarrierUseCase';
import { CarrierRepositoryImpl } from '@/infrastructure/repositories/CarrierRepositoryImpl';
import type { CreateCarrierRequest, UpdateCarrierRequest } from '@/application/dto/CarrierDTOs';
import { PageContainer } from '@/presentation/components/PageContainer';
import { CarrierTable } from './CarrierTable';
import { CreateCarrierModal } from './CreateCarrierModal';
import { EditCarrierModal } from './EditCarrierModal';
import { DeleteCarrierConfirmation } from './DeleteCarrierConfirmation';

export function CarrierContainer() {
  const [carriers, setCarriers] = useState<Carrier[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editTarget, setEditTarget] = useState<Carrier | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Carrier | null>(null);
  const [isDeleteLoading, setIsDeleteLoading] = useState(false);

  const carrierUseCase = useMemo(() => new CarrierUseCase(new CarrierRepositoryImpl()), []);

  const loadCarriers = async () => {
    setIsLoading(true);
    setError('');
    try {
      const data = await carrierUseCase.getAll();
      setCarriers(data);
    } catch {
      setError('택배사 정보를 조회할 수 없습니다. 다시 시도해주세요.');
      setCarriers([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const init = async () => {
      await loadCarriers();
    };
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCreate = async (data: CreateCarrierRequest) => {
    setIsSubmitting(true);
    try {
      await carrierUseCase.create(data);
      setIsCreateOpen(false);
      await loadCarriers();
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdate = async (id: number, data: UpdateCarrierRequest) => {
    setIsSubmitting(true);
    try {
      await carrierUseCase.update(id, data);
      setEditTarget(null);
      await loadCarriers();
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleActive = async (carrier: Carrier) => {
    setError('');
    try {
      await carrierUseCase.update(carrier.id, {
        name: carrier.name,
        isActive: !carrier.isActive,
      });
      await loadCarriers();
    } catch {
      setError('활성 상태를 변경할 수 없습니다. 다시 시도해주세요.');
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleteLoading(true);
    setError('');
    try {
      await carrierUseCase.delete(deleteTarget.id);
      setDeleteTarget(null);
      await loadCarriers();
    } catch (err) {
      const status =
        typeof err === 'object' && err !== null && 'response' in err
          ? (err as { response?: { status?: number } }).response?.status
          : undefined;
      if (status === 409) {
        setError('요율에서 사용 중인 택배사는 삭제할 수 없습니다. 비활성화하세요.');
      } else {
        setError('택배사를 삭제할 수 없습니다. 다시 시도해주세요.');
      }
      setDeleteTarget(null);
    } finally {
      setIsDeleteLoading(false);
    }
  };

  return (
    <PageContainer contentClassName="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">택배사 관리</h1>
          <p className="text-gray-600">택배사 마스터를 관리합니다.</p>
        </div>
        <button
          onClick={() => setIsCreateOpen(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
        >
          택배사 추가
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700 text-sm">
          {error}
        </div>
      )}

      <CarrierTable
        carriers={carriers}
        isLoading={isLoading}
        onToggleActive={handleToggleActive}
        onEdit={setEditTarget}
        onDelete={setDeleteTarget}
      />

      <CreateCarrierModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onSubmit={handleCreate}
        isSubmitting={isSubmitting}
      />

      <EditCarrierModal
        carrier={editTarget}
        onClose={() => setEditTarget(null)}
        onSubmit={handleUpdate}
        isSubmitting={isSubmitting}
      />

      <DeleteCarrierConfirmation
        isOpen={deleteTarget !== null}
        carrierName={deleteTarget?.name ?? ''}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
        isLoading={isDeleteLoading}
      />
    </PageContainer>
  );
}
