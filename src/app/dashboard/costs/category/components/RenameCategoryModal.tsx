'use client';

import { useState } from 'react';
import type { Category } from '@/domain/entities/CategoryEntity';

/**
 * 표준 카테고리 이름 수정 모달(표준명만 — platform/코드 입력 없음).
 * hand-rolled `fixed inset-0`. 저장은 부모가 `onSubmit(name)` 으로 처리.
 */
interface RenameCategoryModalProps {
  open: boolean;
  category: Category;
  isSubmitting: boolean;
  onSubmit: (name: string) => Promise<void>;
  onClose: () => void;
}

export function RenameCategoryModal({
  open,
  category,
  isSubmitting,
  onSubmit,
  onClose,
}: RenameCategoryModalProps) {
  const [name, setName] = useState(category.name);
  const [error, setError] = useState('');

  if (!open) return null;

  const handleSave = async () => {
    if (!name.trim()) {
      setError('카테고리명은 필수입니다.');
      return;
    }
    setError('');
    await onSubmit(name.trim());
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-lg shadow-lg w-full max-w-md">
        <div className="flex items-center justify-between p-4 border-b">
          <div>
            <h2 className="text-lg font-semibold">카테고리 이름 수정</h2>
            <p className="text-xs text-gray-500 mt-1">ID: {category.id}</p>
          </div>
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="text-gray-500 hover:text-gray-700 disabled:opacity-50"
          >
            ✕
          </button>
        </div>

        <div className="p-4 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
              {error}
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">표준 카테고리명</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={isSubmitting}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
            />
          </div>

          <div className="flex gap-2 justify-end pt-4 border-t border-gray-200">
            <button
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-sm border border-gray-300 rounded hover:bg-gray-100 disabled:opacity-50"
            >
              취소
            </button>
            <button
              onClick={() => void handleSave()}
              disabled={isSubmitting}
              className="px-4 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400"
            >
              {isSubmitting ? '저장 중...' : '저장'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
