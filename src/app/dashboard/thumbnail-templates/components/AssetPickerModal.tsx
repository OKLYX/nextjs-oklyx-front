'use client';

import { useEffect, useRef, useState } from 'react';
import { Spinner } from '@/presentation/components/Spinner';
import { resolveThumbUrl } from '@/infrastructure/utils/thumbUrl';
import type { ThumbnailTemplateUseCase } from '@/application/usecases/ThumbnailTemplateUseCase';
import type { TemplateAsset } from '@/domain/entities/ThumbnailEntity';

/**
 * Tenant-shared fixed-image asset picker (watermark, badges, ...).
 * File: src/app/dashboard/thumbnail-templates/components/AssetPickerModal.tsx
 *
 * Hand-rolled `fixed inset-0` modal (shadcn not adopted — ShipmentConfirmModal
 * style). Loads assets on open, supports upload + delete, and returns the picked
 * asset via `onSelect`. The useCase instance is reused from the parent editor.
 *
 * ⚠️ Deleting an asset only removes it from the library; already-placed element
 * `src` references keep their value (dangling refs are a follow-up concern).
 */
interface AssetPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (asset: TemplateAsset) => void;
  useCase: ThumbnailTemplateUseCase;
  // Called with the latest asset list whenever it changes (load/upload/rename/delete)
  // so the editor can refresh its storageKey→name labels for placed fixed images.
  onAssetsChange?: (assets: TemplateAsset[]) => void;
}

export function AssetPickerModal({ isOpen, onClose, onSelect, useCase, onAssetsChange }: AssetPickerModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [assets, setAssets] = useState<TemplateAsset[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState('');
  const [savingId, setSavingId] = useState<number | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    let alive = true;
    (async () => {
      setIsLoading(true);
      setError('');
      try {
        const list = await useCase.listAssets();
        if (alive) {
          setAssets(list);
          onAssetsChange?.(list);
        }
      } catch {
        if (alive) setError('자산 목록을 불러오지 못했습니다.');
      } finally {
        if (alive) setIsLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [isOpen, useCase, onAssetsChange]);

  const handleUploadFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setError('');
    setIsUploading(true);
    try {
      const created = await useCase.uploadAsset(file);
      const next = [created, ...assets];
      setAssets(next);
      onAssetsChange?.(next); // outside the setState updater (updaters must be pure)
    } catch {
      setError('업로드에 실패했습니다.');
    } finally {
      setIsUploading(false);
    }
  };

  const startRename = (asset: TemplateAsset) => {
    setEditingId(asset.id);
    setEditName(asset.name);
  };

  const handleRenameSave = async (id: number) => {
    const name = editName.trim();
    if (!name) return;
    setError('');
    setSavingId(id);
    try {
      const updated = await useCase.renameAsset(id, name);
      const next = assets.map((a) => (a.id === id ? updated : a));
      setAssets(next);
      onAssetsChange?.(next); // outside the setState updater (updaters must be pure)
      setEditingId(null);
    } catch {
      setError('이름 변경에 실패했습니다.');
    } finally {
      setSavingId(null);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('이 자산을 라이브러리에서 삭제하시겠습니까?')) return;
    setError('');
    setDeletingId(id);
    try {
      await useCase.deleteAsset(id);
      const next = assets.filter((a) => a.id !== id);
      setAssets(next);
      onAssetsChange?.(next); // outside the setState updater (updaters must be pure)
    } catch {
      setError('삭제에 실패했습니다.');
    } finally {
      setDeletingId(null);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="flex max-h-[85vh] w-full max-w-2xl flex-col rounded-lg bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-200 px-5 py-3">
          <h3 className="text-base font-semibold text-gray-900">고정 이미지 선택</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded px-2 py-1 text-sm text-gray-500 hover:bg-gray-100"
          >
            닫기
          </button>
        </div>

        <div className="flex items-center gap-2 border-b border-gray-200 px-5 py-3">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {isUploading ? <Spinner label="업로드 중..." /> : '+ 이미지 업로드'}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png"
            onChange={handleUploadFile}
            hidden
          />
          <span className="text-xs text-gray-500">JPG / PNG</span>
        </div>

        {error && <p className="mx-5 mt-3 rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}

        <div className="min-h-40 flex-1 overflow-y-auto p-5">
          {isLoading ? (
            <div className="flex min-h-32 items-center justify-center">
              <Spinner size={24} label="불러오는 중..." />
            </div>
          ) : assets.length === 0 ? (
            <p className="py-8 text-center text-sm text-gray-500">
              등록된 자산이 없습니다. 이미지를 업로드하세요.
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
              {assets.map((asset) => {
                const deleting = deletingId === asset.id;
                const editing = editingId === asset.id;
                const saving = savingId === asset.id;
                return (
                  <div key={asset.id} className="group relative rounded-lg border border-gray-200 p-2">
                    <button
                      type="button"
                      onClick={() => onSelect(asset)}
                      className="block w-full"
                    >
                      <div className="relative mb-1 aspect-square overflow-hidden rounded bg-gray-100">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={resolveThumbUrl(asset.storageKey)}
                          alt={asset.name}
                          className="h-full w-full object-contain"
                        />
                        {deleting && (
                          <div className="absolute inset-0 flex items-center justify-center bg-white/60">
                            <Spinner size={20} />
                          </div>
                        )}
                      </div>
                    </button>
                    {editing ? (
                      <div className="flex items-center gap-1">
                        <input
                          autoFocus
                          className="min-w-0 flex-1 rounded border border-gray-300 px-1.5 py-0.5 text-xs text-gray-900 focus:border-blue-500 focus:outline-none"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleRenameSave(asset.id);
                            if (e.key === 'Escape') setEditingId(null);
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => handleRenameSave(asset.id)}
                          disabled={saving || !editName.trim()}
                          className="shrink-0 rounded border border-blue-300 px-1.5 py-0.5 text-xs text-blue-600 hover:bg-blue-50 disabled:opacity-50"
                        >
                          {saving ? '…' : '저장'}
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => startRename(asset)}
                        title="이름 변경"
                        className="block w-full truncate text-left text-xs text-gray-700 hover:text-blue-600"
                      >
                        {asset.name} <span className="text-gray-400">✎</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => handleDelete(asset.id)}
                      disabled={deleting}
                      className="mt-1 w-full rounded border border-red-300 px-2 py-0.5 text-xs text-red-600 hover:bg-red-50 disabled:opacity-50"
                    >
                      삭제
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
