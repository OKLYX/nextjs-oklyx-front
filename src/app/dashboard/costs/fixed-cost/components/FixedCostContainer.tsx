'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { PageContainer } from '@/presentation/components/PageContainer';
import { PopupDialogModal } from '@/presentation/components/PopupDialogModal';
import { useAuthStore } from '@/infrastructure/stores/authStore';
import { extractErrorMessage } from '@/infrastructure/utils/errorMessage';
import { FixedCostUseCase } from '@/application/usecases/FixedCostUseCase';
import { FixedCostRepositoryImpl } from '@/infrastructure/repositories/FixedCostRepositoryImpl';
import type {
  CreateFixedCostRequest,
  PlatformFixedCost,
  UpdateFixedCostRequest,
} from '@/domain/entities/FixedCost';
import { FixedCostTable } from './FixedCostTable';
import { FixedCostInputModal } from './FixedCostInputModal';

// 연결이 남은 항목은 서버가 409 로 막는다 — 사용자가 다음에 할 일을 바로 붙여 준다.
const IN_USE_HINT = '사용 중인 채널이 있어 삭제할 수 없습니다. 대신 [수정]에서 사용을 끄세요.';

function statusOf(err: unknown): number | undefined {
  return (err as { response?: { status?: number } })?.response?.status;
}

/**
 * 채널 고정비 카탈로그 관리 (FEATURE_2609_33 / PLAN 2609_33 D1 · D9 · D10).
 *
 * 🔴 금액·임계의 소유자는 이 화면이다 — 채널은 항목을 연결만 한다. 채널 화면에는 금액 입력칸이 없다.
 * 🔴 부과 여부(그 달에 실제로 붙는지)는 서버가 달마다 판정한다(D2) — 여기서 매출을 보지 않는다.
 */
export function FixedCostContainer() {
  const isAdmin = useAuthStore((state) => state.user?.role === 'ADMIN');

  const useCase = useMemo(() => new FixedCostUseCase(new FixedCostRepositoryImpl()), []);

  const [items, setItems] = useState<PlatformFixedCost[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<PlatformFixedCost | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<PlatformFixedCost | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      setItems(await useCase.list());
    } catch (e) {
      setError(extractErrorMessage(e, '고정비 목록을 불러오지 못했습니다.'));
      setItems([]);
    } finally {
      setIsLoading(false);
    }
  }, [useCase]);

  // 인라인 async IIFE — 이펙트 본문에서 setState 를 동기 호출하지 않기 위한 프로젝트 관례.
  useEffect(() => {
    if (!isAdmin) return;
    void (async () => {
      await load();
    })();
  }, [isAdmin, load]);

  const handleCreate = async (data: CreateFixedCostRequest) => {
    setIsSubmitting(true);
    try {
      await useCase.create(data);
      setIsModalOpen(false);
      await load();
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdate = async (id: number, data: UpdateFixedCostRequest) => {
    setIsSubmitting(true);
    try {
      await useCase.update(id, data);
      setIsModalOpen(false);
      setEditTarget(null);
      await load();
    } finally {
      setIsSubmitting(false);
    }
  };

  // PopupDialogModal 에는 disabled prop 이 없다 → 재진입 가드는 호출부가 진다.
  const handleDelete = async () => {
    if (isDeleting || !deleteTarget) return;
    setIsDeleting(true);
    setError('');
    try {
      await useCase.remove(deleteTarget.id);
      setDeleteTarget(null);
      await load();
    } catch (e) {
      const serverMessage = extractErrorMessage(e, '고정비 항목을 삭제하지 못했습니다.');
      setError(statusOf(e) === 409 ? `${serverMessage} ${IN_USE_HINT}` : serverMessage);
      setDeleteTarget(null);
    } finally {
      setIsDeleting(false);
    }
  };

  if (!isAdmin) {
    return (
      <PageContainer width="md">
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          관리자만 접근할 수 있습니다.
        </p>
      </PageContainer>
    );
  }

  return (
    <PageContainer title="채널 고정비" width="md">
      <div className="space-y-1 text-sm text-gray-600">
        <p>여기서 금액·임계를 고치면 이 항목을 쓰는 모든 채널에 반영됩니다.</p>
        <p>그 달 상품 매출(배송비 제외)이 임계 이상인 달에만 부과됩니다.</p>
      </div>

      {error && (
        <div role="alert" className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-800">
          {error}
        </div>
      )}

      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">{items.length}건</p>
        <button
          onClick={() => {
            setEditTarget(null);
            setIsModalOpen(true);
          }}
          className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700"
        >
          고정비 항목 추가
        </button>
      </div>

      <FixedCostTable
        items={items}
        isLoading={isLoading}
        onEditClick={(item) => {
          setEditTarget(item);
          setIsModalOpen(true);
        }}
        onDeleteClick={(item) => setDeleteTarget(item)}
      />

      {/* 열 때마다 새 마운트 = 입력 초기화(이펙트 리셋 금지 — 프로젝트 lint). */}
      {isModalOpen && (
        <FixedCostInputModal
          item={editTarget}
          isLoading={isSubmitting}
          onClose={() => {
            setIsModalOpen(false);
            setEditTarget(null);
          }}
          onCreate={handleCreate}
          onUpdate={handleUpdate}
        />
      )}

      <PopupDialogModal
        isOpen={deleteTarget !== null}
        title="고정비 항목 삭제"
        message={`"${deleteTarget?.name ?? ''}"을(를) 삭제하시겠습니까?`}
        cancelText="취소"
        confirmText={isDeleting ? '삭제 중...' : '삭제'}
        onCancel={() => {
          if (isDeleting) return;
          setDeleteTarget(null);
        }}
        onConfirm={handleDelete}
        isDangerous
      />
    </PageContainer>
  );
}
