'use client';

import { useEffect, useState, useMemo } from 'react';
import { SellerRepositoryImpl } from '@/infrastructure/repositories/SellerRepositoryImpl';
import { SellerUseCase } from '@/application/usecases/SellerUseCase';
import type { Seller } from '@/domain/entities/SellerEntity';
import type { CreateSellerRequest } from '@/application/dto/SellerDTOs';
import { EditSellerForm } from './EditSellerForm';
import { Modal } from '@/presentation/components/ui/Modal';

interface EditSellerModalProps {
  isOpen: boolean;
  sellerId: number | null;
  onClose: () => void;
  onSuccess: () => Promise<void>;
}

export function EditSellerModal({
  isOpen,
  sellerId,
  onClose,
  onSuccess,
}: EditSellerModalProps) {
  const [seller, setSeller] = useState<Seller | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(false);

  const sellerUseCase = useMemo(() => {
    const repository = new SellerRepositoryImpl();
    return new SellerUseCase(repository);
  }, []);

  useEffect(() => {
    if (!isOpen || !sellerId) {
      setSeller(null);
      return;
    }

    const fetchSeller = async () => {
      try {
        setIsFetching(true);
        const result = await sellerUseCase.getById(sellerId);
        setSeller(result);
      } catch {
        setSeller(null);
      } finally {
        setIsFetching(false);
      }
    };

    fetchSeller();
  }, [isOpen, sellerId, sellerUseCase]);

  const handleSubmit = async (data: CreateSellerRequest) => {
    try {
      setIsLoading(true);
      await sellerUseCase.update(sellerId!, data);
      onClose();
      await onSuccess();
    } catch (err) {
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) {
    return null;
  }

  return (
    <Modal
      isOpen
      onClose={onClose}
      title="판매자 정보 수정"
      disableClose={isLoading || isFetching}
    >
      {isFetching ? (
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i}>
              <div className="h-4 bg-gray-200 rounded w-24 animate-pulse mb-2"></div>
              <div className="h-8 bg-gray-200 rounded animate-pulse"></div>
            </div>
          ))}
        </div>
      ) : (
        <EditSellerForm
          seller={seller}
          isLoading={isLoading}
          onSubmit={handleSubmit}
          onCancel={onClose}
        />
      )}
    </Modal>
  );
}
