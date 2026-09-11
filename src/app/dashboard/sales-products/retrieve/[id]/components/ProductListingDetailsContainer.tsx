'use client';

import { useMemo, useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ProductListingRepositoryImpl } from '@/infrastructure/repositories/ProductListingRepositoryImpl';
import { ProductListingUseCase } from '@/application/usecases/ProductListingUseCase';
import type { ProductListing } from '@/domain/entities/ProductListingEntity';
import { ROUTES } from '@/config/routes';
import { ProductListingDetailsCard } from './ProductListingDetailsCard';
import { ProductListingDetailsTable } from './ProductListingDetailsTable';
import { ProductListingDeleteDialog } from './ProductListingDeleteDialog';
import { Card } from '@/presentation/components/ui/Card';

interface ProductListingDetailsContainerProps {
  id: string;
}

export function ProductListingDetailsContainer({ id }: ProductListingDetailsContainerProps) {
  const router = useRouter();
  const [listing, setListing] = useState<ProductListing | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [apiError, setApiError] = useState('');

  const productListingUseCase = useMemo(() => {
    const repository = new ProductListingRepositoryImpl();
    return new ProductListingUseCase(repository);
  }, []);

  useEffect(() => {
    const fetchListing = async () => {
      try {
        setIsLoading(true);
        setError('');
        const result = await productListingUseCase.getById(parseInt(id, 10));
        setListing(result);
      } catch {
        setError('판매상품 조회에 실패했습니다. 다시 시도해주세요.');
        setListing(null);
      } finally {
        setIsLoading(false);
      }
    };

    fetchListing();
  }, [id, productListingUseCase]);

  const handleBack = () => {
    sessionStorage.setItem('sales-products-retrieve-scroll', window.scrollY.toString());
    router.back();
  };

  const handleEdit = () => {
    router.push(ROUTES.SALES_PRODUCTS_RETRIEVE_EDIT(id));
  };

  const handleDelete = async () => {
    try {
      setIsDeleting(true);
      setApiError('');
      await productListingUseCase.delete(parseInt(id, 10));
      sessionStorage.setItem('refresh-product-listing', 'true');
      router.push(ROUTES.SALES_PRODUCTS_RETRIEVE);
    } catch (err: unknown) {
      const error = err as { response?: { status: number } } & Error;
      const statusCode = error?.response?.status;
      if (statusCode === 404) {
        setApiError('판매상품을 찾을 수 없습니다.');
      } else if (error instanceof Error) {
        setApiError(error.message);
      } else {
        setApiError('삭제에 실패했습니다. 다시 시도해주세요.');
      }
      setIsDeleting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-8 bg-gray-200 rounded w-1/4"></div>
        <Card className="space-y-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-6 bg-gray-200 rounded"></div>
          ))}
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <button
          onClick={handleBack}
          className="text-blue-600 hover:text-blue-800 font-medium"
        >
          ← 돌아가기
        </button>
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
          {error}
        </div>
      </div>
    );
  }

  if (!listing) {
    return (
      <div className="space-y-4">
        <button
          onClick={handleBack}
          className="text-blue-600 hover:text-blue-800 font-medium"
        >
          ← 돌아가기
        </button>
        <div className="bg-white rounded-lg p-8 text-center text-gray-500 border border-gray-200">
          상품을 찾을 수 없습니다.
        </div>
      </div>
    );
  }

  // 2609_22/D32: 마스터에 연결된 셀은 legacy 수정·삭제 창구를 닫는다(서버도 400 이지만 눌러야 알게 하지 않는다).
  const masterProductId = listing.masterProductId;

  return (
    <>
      <div className="space-y-6">
        <ProductListingDetailsCard
          listing={listing}
          isLoading={isLoading}
          error={apiError}
          onBack={handleBack}
          onEdit={handleEdit}
          onDelete={() => {
            setApiError('');
            setShowDeleteDialog(true);
          }}
          actionsDisabled={masterProductId != null}
          actionsNotice={
            masterProductId != null ? (
              <span className="text-sm text-gray-500">
                마스터에 연결된 판매상품입니다. 마스터 상세에서 수정하세요.{' '}
                <Link
                  href={ROUTES.MASTER_PRODUCT_DETAIL(masterProductId)}
                  className="text-blue-600 underline hover:no-underline"
                >
                  마스터 상세
                </Link>
              </span>
            ) : undefined
          }
        />

        <ProductListingDetailsTable options={listing.options} isLoading={isLoading} />
      </div>

      <ProductListingDeleteDialog
        isOpen={showDeleteDialog}
        isLoading={isDeleting}
        listingId={listing.id}
        listingName={`${listing.platform} - ${listing.platformProductId}`}
        error={apiError}
        onConfirm={handleDelete}
        onCancel={() => {
          setShowDeleteDialog(false);
          setApiError('');
        }}
      />
    </>
  );
}
