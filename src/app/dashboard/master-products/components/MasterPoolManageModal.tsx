'use client';

import { useState } from 'react';

/**
 * 마스터 이미지 풀 관리 팝업 — 업로드한 마스터 이미지를 다중 선택해 삭제.
 * File: src/app/dashboard/master-products/components/MasterPoolManageModal.tsx
 *
 * hand-rolled `fixed inset-0`(MasterImagePickerModal 스타일 미러). 삭제 대상은 마스터 소유
 * 이미지뿐(제품 참조는 자동 관리라 여기 없음). 삭제는 부모 `onDelete(tokens)` 에 위임 —
 * 매핑된 이미지는 백엔드가 매핑까지 함께 정리.
 *
 * ⚠️ `url` 은 풀 imageUrl(완성 URL) → <img src> 직접(resolveThumbUrl 금지).
 */
export interface ManageImage {
  token: number;
  url: string;
  inUse: boolean;
}

interface MasterPoolManageModalProps {
  images: ManageImage[];
  onDelete: (tokens: number[]) => Promise<void>;
  onClose: () => void;
}

export function MasterPoolManageModal({ images, onDelete, onClose }: MasterPoolManageModalProps) {
  const [selected, setSelected] = useState<number[]>([]);
  const [busy, setBusy] = useState(false);

  const toggle = (token: number) => {
    setSelected((prev) => (prev.includes(token) ? prev.filter((t) => t !== token) : [...prev, token]));
  };

  const handleDelete = async () => {
    if (selected.length === 0) return;
    if (!window.confirm(`선택한 ${selected.length}개 이미지를 삭제할까요? 매핑돼 있으면 함께 해제됩니다.`))
      return;
    setBusy(true);
    try {
      await onDelete(selected);
      setSelected([]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
      <div className="flex max-h-[85vh] w-full max-w-2xl flex-col rounded-lg bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-200 px-5 py-3">
          <h3 className="text-base font-semibold text-gray-900">마스터 이미지 관리</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded px-2 py-1 text-sm text-gray-500 hover:bg-gray-100"
          >
            닫기
          </button>
        </div>

        <div className="min-h-40 flex-1 overflow-y-auto p-5">
          {images.length === 0 ? (
            <p className="py-8 text-center text-sm text-gray-500">관리할 마스터 이미지가 없습니다.</p>
          ) : (
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
              {images.map((img) => {
                const checked = selected.includes(img.token);
                return (
                  <button
                    key={img.token}
                    type="button"
                    onClick={() => toggle(img.token)}
                    className={`relative rounded-lg border-2 p-1 ${
                      checked ? 'border-red-500' : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="aspect-square overflow-hidden rounded bg-gray-100">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={img.url} alt="마스터 이미지" className="h-full w-full object-contain" />
                    </div>
                    {img.inUse && (
                      <span className="absolute left-1 top-1 rounded bg-blue-600 px-1 py-0.5 text-[10px] text-white">
                        사용중
                      </span>
                    )}
                    {checked && (
                      <span className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-600 text-[11px] text-white">
                        ✓
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-gray-200 px-5 py-3">
          <span className="text-xs text-gray-500">{selected.length}개 선택</span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-100"
            >
              닫기
            </button>
            <button
              type="button"
              onClick={handleDelete}
              disabled={selected.length === 0 || busy}
              className="rounded-lg bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
            >
              {busy ? '삭제 중...' : '선택 삭제'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
