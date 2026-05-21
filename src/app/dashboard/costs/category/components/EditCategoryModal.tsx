'use client';

import { useEffect } from 'react';
import { EditCategoryForm } from './EditCategoryForm';
import { PopupDialogModal } from '@/presentation/components/PopupDialogModal';
import type { Category } from '@/domain/entities/CategoryEntity';
import type { UpdateCategoryRequest } from '@/application/dto/UpdateCategoryRequest';

interface EditCategoryModalProps {
  isOpen: boolean;
  category: Category | null;
  onClose: () => void;
  onSubmit: (data: UpdateCategoryRequest) => Promise<void>;
  onDelete: (id: number) => Promise<void>;
  isLoading: boolean;
  isDeletingCategory: boolean;
  isDeleteConfirmOpen: boolean;
  onOpenDeleteConfirm: () => void;
  onCloseDeleteConfirm: () => void;
  deleteError?: string;
  categories: Category[];
}

export function EditCategoryModal({
  isOpen,
  category,
  onClose,
  onSubmit,
  onDelete,
  isLoading,
  isDeletingCategory,
  isDeleteConfirmOpen,
  onOpenDeleteConfirm,
  onCloseDeleteConfirm,
  deleteError,
  categories,
}: EditCategoryModalProps) {
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isLoading && !isDeletingCategory) {
        onClose();
      }
    };

    if (isOpen) {
      window.addEventListener('keydown', handleEsc);
      return () => window.removeEventListener('keydown', handleEsc);
    }
  }, [isOpen, isLoading, isDeletingCategory, onClose]);

  if (!isOpen) {
    return null;
  }

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
        <div className="bg-white rounded-lg shadow-lg max-w-md w-full mx-4">
          <div className="flex items-center justify-between p-4 border-b">
            <div>
              <h2 className="text-lg font-semibold">카테고리 수정</h2>
              {category && <p className="text-xs text-gray-500 mt-1">ID: {category.id}</p>}
            </div>
            <button
              onClick={onClose}
              disabled={isLoading || isDeletingCategory}
              className="text-gray-500 hover:text-gray-700 disabled:opacity-50"
            >
              ✕
            </button>
          </div>

          <div className="p-4">
            {deleteError && (
              <div className="rounded-md bg-red-50 p-3 text-sm text-red-700 mb-4">
                <p className="font-semibold">삭제 실패</p>
                <p>{deleteError}</p>
              </div>
            )}
            {category && (
              <EditCategoryForm
                category={category}
                categories={categories}
                isLoading={isLoading}
                isDeletingCategory={isDeletingCategory}
                onSubmit={onSubmit}
                onCancel={onClose}
                onOpenDeleteConfirm={onOpenDeleteConfirm}
              />
            )}
          </div>
        </div>
      </div>

      {category && (
        <PopupDialogModal
          isOpen={isDeleteConfirmOpen}
          title="카테고리 삭제"
          message={`카테고리 "${category.name}"을 삭제하시겠습니까?`}
          cancelText="취소"
          confirmText={isDeletingCategory ? '삭제 중...' : '삭제'}
          onCancel={onCloseDeleteConfirm}
          onConfirm={() => onDelete(category.id)}
          isDangerous
        />
      )}
    </>
  );
}
